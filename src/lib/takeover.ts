// 接管规则：按句子文字把旧课程的学员数据（录音、掌握状态、练习进度）
// 接到新课程上。规则：
//   keep   原句文字未变（仅译文/标签/难度等资料更新）→ 录音与掌握状态原样跟随
//   edit   句子改过字 → 旧稿（带录音与进度）移入历史区，按新文字建立新练习项
//   add    新增句子 → 建立全新练习项
//   archive 新课程不再收录 → 移入历史区
// edit 类在操作页允许逐句改判：
//   edit  改字（默认）   keep  其实是同一句（数据跟随新句）   split  新旧并存（旧句进历史区时保留为“留存稿”）

import type { Level, PreparedSentence } from './coursePack';
import { normalizeText } from './coursePack';

export type MasteryStatus = 'new' | 'practice' | 'mastered';

export interface Recording {
  /** 模拟音频本体的占位标识；真机可替换为音频 blob 的存储键 */
  blobKey?: string;
  durationSec?: number;
  recordedAt?: string;
}

export interface Phrase {
  id: string;
  text: string;
  translation: string;
  tag: string;
  level: Level;
  status: MasteryStatus;
  attempts: number;
  last?: string;
  recording?: Recording;
  /** 接管自哪一句（旧句 id），以及在课程包中的顺序 */
  carriedFromId?: string;
  incomingIndex?: number;
}

export interface ArchivedPhrase extends Phrase {
  archivedAt: string;
  archiveReason: 'edit' | 'removed' | 'manual' | 'split';
  /** edit 情况下指向接管它的新句 id，便于追溯 */
  supersededById?: string;
  /** split 情况下，新句被另建为独立练习项，旧稿仅留存 */
  preserved?: boolean;
}

export type EditDecision = 'edit' | 'keep' | 'split';

export type ImportItem =
  | { kind: 'keep'; incomingIndex: number; incoming: PreparedSentence; old: Phrase; metaChanged: boolean }
  | { kind: 'edit'; incomingIndex: number; incoming: PreparedSentence; old: Phrase; similarity: number }
  | { kind: 'add'; incomingIndex: number; incoming: PreparedSentence };

export interface ImportPlan {
  items: ImportItem[];
  archives: { phrase: Phrase; reason: ArchivedPhrase['archiveReason']; supersededById?: string; preserved?: boolean }[];
  counts: { keep: number; edit: number; add: number; archive: number };
}

export interface CourseMeta {
  name?: string;
  version?: string;
  updatedAt?: string;
  appliedAt?: string;
}

const SIMILAR_THRESHOLD = 0.55;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** 分析新旧课程，生成接管草案；尚未逐句决定的 edit 默认按“改过字”处理。 */
export function buildImportPlan(current: Phrase[], incoming: PreparedSentence[]): ImportPlan {
  const exactByNorm = new Map<string, Phrase>();
  current.forEach((p) => exactByNorm.set(normalizeText(p.text), p));

  const exactMatched = new Set<string>();
  const candidates: { old: Phrase; incoming: PreparedSentence; incomingIndex: number; similarity: number }[] = [];
  const items: ImportItem[] = [];

  incoming.forEach((incoming, incomingIndex) => {
    const exact = exactByNorm.get(normalizeText(incoming.text));
    if (exact) {
      exactMatched.add(exact.id);
      const metaChanged =
        exact.translation !== incoming.translation ||
        exact.tag !== incoming.tag ||
        (exact.level !== incoming.level);
      items.push({ kind: 'keep', incomingIndex, incoming, old: exact, metaChanged });
      return;
    }
    let best: Phrase | undefined;
    let bestScore = 0;
    for (const old of current) {
      if (exactMatched.has(old.id)) continue;
      const score = similarity(old.text, incoming.text);
      if (score > bestScore) {
        bestScore = score;
        best = old;
      }
    }
    if (best && bestScore >= SIMILAR_THRESHOLD) {
      candidates.push({ old: best, incoming, incomingIndex, similarity: bestScore });
    } else {
      items.push({ kind: 'add', incomingIndex, incoming });
    }
  });

  // 相似度配对可能互相争抢，按分数从高到低做一对一锁定
  const pairedOld = new Set<string>();
  candidates
    .sort((a, b) => b.similarity - a.similarity)
    .forEach((c) => {
      if (pairedOld.has(c.old.id)) {
        items.push({ kind: 'add', incomingIndex: c.incomingIndex, incoming: c.incoming });
        return;
      }
      pairedOld.add(c.old.id);
      items.push({ kind: 'edit', incomingIndex: c.incomingIndex, incoming: c.incoming, old: c.old, similarity: c.similarity });
    });

  items.sort((a, b) => a.incomingIndex - b.incomingIndex);

  const keptIds = new Set(items.filter((i) => i.kind === 'keep').map((i) => (i as Extract<ImportItem, { kind: 'keep' }>).old.id));
  const editOldIds = new Set(items.filter((i) => i.kind === 'edit').map((i) => (i as Extract<ImportItem, { kind: 'edit' }>).old.id));

  const archives: ImportPlan['archives'] = [];
  current.forEach((p) => {
    if (keptIds.has(p.id)) return;
    if (editOldIds.has(p.id)) return;
    archives.push({ phrase: p, reason: 'removed' });
  });

  const counts = {
    keep: items.filter((i) => i.kind === 'keep').length,
    edit: items.filter((i) => i.kind === 'edit').length,
    add: items.filter((i) => i.kind === 'add').length,
    archive: archives.length,
  };

  return { items, archives, counts };
}

let idSeq = 1;
/** 本机新练习项 id；时间戳加序号，避免连续建项撞号 */
export function makePhraseId(): string {
  return `p_${Date.now().toString(36)}_${(idSeq++).toString(36)}`;
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export function statusLabel(status: MasteryStatus): string {
  return status === 'mastered' ? '已掌握' : status === 'practice' ? '练习中' : '未开始';
}

export function hasRecording(p: { recording?: Recording }): boolean {
  return Boolean(p.recording && (p.recording.blobKey || p.recording.durationSec));
}

export function formatDuration(sec?: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

/**
 * 按确认后的决定执行接管，返回新课程与历史区。
 * 只有调用方点了“确认保存新课程”后才会走到这里。
 */
export function applyImport(
  current: Phrase[],
  plan: ImportPlan,
  decisions: Record<number, EditDecision>,
): { phrases: Phrase[]; archives: ArchivedPhrase[]; archived: ArchivedPhrase[] } {
  const archivedAt = todayLabel();
  const archives: ArchivedPhrase[] = [];
  const phrases: Phrase[] = [];
  const archivedOldIds = new Set<string>();

  plan.items.forEach((item) => {
    const fresh = (): Phrase => ({
      id: makePhraseId(),
      text: item.incoming.text,
      translation: item.incoming.translation,
      tag: item.incoming.tag,
      level: item.incoming.level,
      status: 'new',
      attempts: 0,
      incomingIndex: item.incomingIndex,
    });

    if (item.kind === 'keep') {
      // 原句继续使用：录音、掌握状态、练习次数全部跟随，仅资料字段刷新
      phrases.push({
        ...item.old,
        text: item.incoming.text,
        translation: item.incoming.translation,
        tag: item.incoming.tag,
        level: item.incoming.level,
        incomingIndex: item.incomingIndex,
      });
      return;
    }

    if (item.kind === 'add') {
      phrases.push(fresh());
      return;
    }

    // edit：逐句决定
    const decision = decisions[item.incomingIndex] ?? 'edit';
    if (decision === 'keep') {
      // 老师判为同一句微调：数据跟随到新文字
      phrases.push({
        ...item.old,
        text: item.incoming.text,
        translation: item.incoming.translation,
        tag: item.incoming.tag,
        level: item.incoming.level,
        incomingIndex: item.incomingIndex,
      });
      return;
    }

    const id = makePhraseId();
    const newPhrase: Phrase = { ...fresh(), id };
    if (decision === 'split') {
      // 新旧并存：新句是全新练习项；旧稿作为留存稿进历史区
      phrases.push(newPhrase);
      archives.push({
        ...item.old,
        archivedAt,
        archiveReason: 'split',
        supersededById: id,
        preserved: true,
      });
    } else {
      // edit（默认）：旧稿留档（录音与进度随旧稿保存），新句重新练
      phrases.push(newPhrase);
      archives.push({
        ...item.old,
        archivedAt,
        archiveReason: 'edit',
        supersededById: id,
      });
    }
    archivedOldIds.add(item.old.id);
  });

  // 被移走的句子收进历史区
  plan.archives.forEach((a) => {
    if (archivedOldIds.has(a.phrase.id)) return;
    archives.push({ ...a.phrase, archivedAt, archiveReason: a.reason });
  });

  phrases.sort((a, b) => (a.incomingIndex ?? 0) - (b.incomingIndex ?? 0));
  return { phrases, archives, archived: archives };
}

/** 手动删除当前练习句：进历史区而非直接消失 */
export function archivePhrase(phrase: Phrase): ArchivedPhrase {
  return { ...phrase, archivedAt: todayLabel(), archiveReason: 'manual' };
}
