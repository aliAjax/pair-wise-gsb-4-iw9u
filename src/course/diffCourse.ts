import type { ArchivedPhrase, CoursePackage, CourseState, Phrase, SentenceDraft } from './types';

// 接管规则引擎：
// 身份完全由“句子文字”决定，与课程包编号、本地 id 无关。
// 1. 文字一致      → 原句继续使用，录音与掌握状态原样跟过去；
// 2. 改过字（疑似）→ 默认留一份旧稿（进历史区）再建立全新练习项，也可逐句改判；
// 3. 被移走        → 旧句收进历史区，录音随旧稿保留。

export interface EditedDecision {
  /**
   * keep-draft：留旧稿进历史区 + 建立新练习项（默认）
   * take-over：视作同一句直接改字，录音和进度跟过去，不留旧稿
   * drop-old：丢弃旧稿，建立新练习项
   */
  action: 'keep-draft' | 'take-over' | 'drop-old';
}
export interface RemovedDecision {
  /** archive：收进历史区（默认）；keep：仍留在练习库里 */
  action: 'archive' | 'keep';
}
export interface AddedDecision {
  /** add：加入练习库（默认）；skip：这次不导入 */
  action: 'add' | 'skip';
}
export type Decisions = {
  edited: Record<string, EditedDecision['action']>;
  removed: Record<string, RemovedDecision['action']>;
  added: Record<string, AddedDecision['action']>;
};

export interface UnchangedItem {
  kind: 'unchanged';
  key: string;
  phrase: Phrase;
  draft: SentenceDraft;
  metaChanges: string[];
}
export interface EditedItem {
  kind: 'edited';
  key: string;
  phrase: Phrase;
  draft: SentenceDraft;
  similarity: number;
}
export interface RemovedItem {
  kind: 'removed';
  key: string;
  phrase: Phrase;
}
export interface AddedItem {
  kind: 'added';
  key: string;
  draft: SentenceDraft;
}
export type DiffItem = UnchangedItem | EditedItem | RemovedItem | AddedItem;

export interface CourseDiff {
  courseId: string;
  courseName: string;
  version: number;
  publishedAt: string;
  notes?: string;
  unchanged: UnchangedItem[];
  edited: EditedItem[];
  removed: RemovedItem[];
  added: AddedItem[];
}

/** 归一化文字：去首尾空白、合并空白、统一标点、转小写 */
export function normalizeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[\s.,!?;:"'()–—-]+/g, ' ')
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter(Boolean));
}

/** 0~1 的词集合相似度（Jaccard） */
export function similarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach(t => { if (sb.has(t)) inter += 1; });
  return inter / (sa.size + sb.size - inter);
}

/** 疑似改过字的匹配门槛 */
const EDITED_THRESHOLD = 0.5;

export function diffCourse(state: CourseState, incoming: CoursePackage): CourseDiff {
  const phrases = state.phrases;

  const result: CourseDiff = {
    courseId: incoming.courseId,
    courseName: incoming.courseName,
    version: incoming.version,
    publishedAt: incoming.publishedAt,
    notes: incoming.notes,
    unchanged: [],
    edited: [],
    removed: [],
    added: [],
  };

  const remainingOld = new Map<number, Phrase>();
  phrases.forEach(p => remainingOld.set(p.id, p));
  const remainingNew = new Map<string, SentenceDraft>();
  incoming.sentences.forEach(d => remainingNew.set(d.ref, d));

  // 1) 文字完全一致 → unchanged
  const newByNorm = new Map<string, SentenceDraft>();
  incoming.sentences.forEach(d => newByNorm.set(normalizeText(d.text), d));
  phrases.forEach(p => {
    const draft = newByNorm.get(normalizeText(p.text));
    if (draft && remainingNew.has(draft.ref)) {
      remainingOld.delete(p.id);
      remainingNew.delete(draft.ref);
      result.unchanged.push({
        kind: 'unchanged',
        key: `u-${p.id}`,
        phrase: p,
        draft,
        metaChanges: describeMetaChanges(p, draft),
      });
    }
  });

  // 2) 剩余两两打分，贪心配对疑似改过字的句子
  const pairs: { phrase: Phrase; draft: SentenceDraft; score: number }[] = [];
  remainingOld.forEach(p => {
    remainingNew.forEach(d => {
      const score = similarity(p.text, d.text);
      if (score >= EDITED_THRESHOLD) pairs.push({ phrase: p, draft: d, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  for (const pair of pairs) {
    if (!remainingOld.has(pair.phrase.id) || !remainingNew.has(pair.draft.ref)) continue;
    remainingOld.delete(pair.phrase.id);
    remainingNew.delete(pair.draft.ref);
    result.edited.push({
      kind: 'edited',
      key: `e-${pair.phrase.id}-${pair.draft.ref}`,
      phrase: pair.phrase,
      draft: pair.draft,
      similarity: pair.score,
    });
  }

  // 3) 剩下的旧句 = 被移走
  remainingOld.forEach(p => result.removed.push({ kind: 'removed', key: `r-${p.id}`, phrase: p }));
  // 4) 剩下的新句 = 全新加入
  remainingNew.forEach(d => result.added.push({ kind: 'added', key: `a-${d.ref}`, draft: d }));

  return result;
}

function describeMetaChanges(p: Phrase, d: SentenceDraft): string[] {
  const changes: string[] = [];
  if (p.translation !== d.translation) changes.push('译文更新');
  if (p.tag !== d.tag) changes.push(`分类 ${p.tag} → ${d.tag}`);
  if (p.level !== d.level) changes.push(`难度 ${p.level} → ${d.level}`);
  return changes;
}

export function defaultDecisions(diff: CourseDiff): Decisions {
  return {
    edited: Object.fromEntries(diff.edited.map(i => [i.key, 'keep-draft' as const])),
    removed: Object.fromEntries(diff.removed.map(i => [i.key, 'archive' as const])),
    added: Object.fromEntries(diff.added.map(i => [i.key, 'add' as const])),
  };
}

export function buildPhraseFromDraft(draft: SentenceDraft, id: number): Phrase {
  return {
    id,
    text: draft.text,
    translation: draft.translation,
    tag: draft.tag,
    level: draft.level,
    status: 'new',
    attempts: 0,
    recordings: [],
  };
}

/** 需要学员逐个留意的条目数：改过字（默认留旧稿）与被移走（默认进历史区） */
export function reviewCount(diff: CourseDiff): number {
  return diff.edited.length + diff.removed.length;
}

/** 按确认后的决定生成新课程状态；未确认前不会写入任何数据 */
export function applyImport(
  state: CourseState,
  diff: CourseDiff,
  decisions: Decisions,
  nowISO: string,
): CourseState {
  const phrases: Phrase[] = [];
  const archive: ArchivedPhrase[] = [...state.archive];
  let nextId = state.phrases.reduce((m, p) => Math.max(m, p.id), 0) + 1;

  // 原句继续使用：进度/录音原样跟过去，仅覆盖老师更新的译文等资料
  for (const item of diff.unchanged) {
    phrases.push({
      ...item.phrase,
      translation: item.draft.translation,
      tag: item.draft.tag,
      level: item.draft.level,
    });
  }

  // 改过字的句子
  for (const item of diff.edited) {
    const action = decisions.edited[item.key] ?? 'keep-draft';
    if (action === 'take-over') {
      // 直接接管：录音、掌握状态跟过去，只换文字与资料
      phrases.push({
        ...item.phrase,
        text: item.draft.text,
        translation: item.draft.translation,
        tag: item.draft.tag,
        level: item.draft.level,
      });
    } else {
      const newId = nextId++;
      phrases.push(buildPhraseFromDraft(item.draft, newId));
      if (action === 'keep-draft') {
        archive.push({ ...item.phrase, archivedAt: nowISO, reason: 'rewritten', successorId: newId });
      }
    }
  }

  // 被移走的句子
  for (const item of diff.removed) {
    const action = decisions.removed[item.key] ?? 'archive';
    if (action === 'archive') {
      archive.push({ ...item.phrase, archivedAt: nowISO, reason: 'removed' });
    } else {
      phrases.push(item.phrase);
    }
  }

  // 全新加入
  for (const item of diff.added) {
    if ((decisions.added[item.key] ?? 'add') === 'add') {
      phrases.push(buildPhraseFromDraft(item.draft, nextId++));
    }
  }

  phrases.sort((a, b) => a.id - b.id);
  return {
    courseId: diff.courseId,
    courseName: diff.courseName,
    version: diff.version,
    importedAt: nowISO,
    phrases,
    archive,
  };
}
