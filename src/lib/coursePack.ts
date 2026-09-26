// 课程包资料：老师下发的英语练习句包，只负责解析与校验，不碰学员数据。
// 支持两种形态：
//   { "name": "课程名", "version": "2026秋 v2", "sentences": [ { "text": "...", "translation": "...", "tag": "...", "level": "入门" } ] }
//   [ { "text": "..." }, ... ]

export type Level = '入门' | '进阶' | '挑战';

export interface CourseSentence {
  text: string;
  translation?: string;
  tag?: string;
  level?: string;
}

export interface CoursePack {
  name?: string;
  version?: string;
  updatedAt?: string;
  sentences: CourseSentence[];
}

export interface PreparedSentence {
  text: string;
  translation: string;
  tag: string;
  level: Level;
}

export interface ParseResult {
  pack: CoursePack | null;
  sentences: PreparedSentence[];
  errors: string[];
  warnings: string[];
}

const LEVELS: Level[] = ['入门', '进阶', '挑战'];

/** 用于新旧句子比对：大小写、弯引号、标点与多余空白都归一化，避免“伪改字”。 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function parseCoursePack(raw: string): ParseResult {
  const result: ParseResult = { pack: null, sentences: [], errors: [], warnings: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    result.errors.push(`不是有效的 JSON 文件：${e instanceof Error ? e.message : '解析失败'}`);
    return result;
  }

  const pack: CoursePack = {
    name: asNonEmptyString((data as Record<string, unknown>)?.name) ?? undefined,
    version: asNonEmptyString((data as Record<string, unknown>)?.version) ?? undefined,
    updatedAt: asNonEmptyString((data as Record<string, unknown>)?.updatedAt) ?? undefined,
    sentences: [],
  };

  let list: unknown;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as { sentences?: unknown }).sentences)) {
    list = (data as { sentences: unknown[] }).sentences;
    result.pack = pack;
  } else {
    result.errors.push('课程包需要是句子数组，或包含 sentences 数组的对象。');
    return result;
  }

  const seen = new Set<string>();
  (list as unknown[]).forEach((item, i) => {
    const at = `第 ${i + 1} 条`;
    if (!item || typeof item !== 'object') {
      result.warnings.push(`${at}：不是有效条目，已跳过。`);
      return;
    }
    const record = item as Record<string, unknown>;
    const text = asNonEmptyString(record.text);
    if (!text) {
      result.warnings.push(`${at}：缺少英文句子（text），已跳过。`);
      return;
    }
    const norm = normalizeText(text);
    if (seen.has(norm)) {
      result.warnings.push(`${at}：与包内另一句完全重复，已跳过。`);
      return;
    }
    seen.add(norm);

    let level: Level = '入门';
    const rawLevel = asNonEmptyString(record.level);
    if (rawLevel) {
      if ((LEVELS as string[]).includes(rawLevel)) level = rawLevel as Level;
      else result.warnings.push(`${at}：难度「${rawLevel}」无法识别，已按「入门」处理。`);
    }
    result.sentences.push({
      text,
      translation: asNonEmptyString(record.translation) ?? '待补充译文',
      tag: asNonEmptyString(record.tag) ?? '未分类',
      level,
    });
  });

  if (result.sentences.length === 0) {
    result.errors.push('课程包里没有可用的句子，请检查后重试。');
  }
  return result;
}

export const SAMPLE_PACK = JSON.stringify(
  {
    name: '日常英语精练',
    version: '2026 秋季 v2',
    updatedAt: '2026-09-25',
    sentences: [
      { text: 'The morning light feels different today.', translation: '今早的晨光感觉有些不同。', tag: '日常', level: '入门' },
      { text: "Could you walk me through the first step?", translation: '你能带我了解第一步吗？', tag: '工作', level: '进阶' },
      { text: "Let's make room for a little curiosity.", translation: '给好奇心留一点空间。', tag: '灵感', level: '入门' },
      { text: 'Small steps every day lead to big changes.', translation: '每天一小步，积累成大改变。', tag: '成长', level: '入门' },
    ],
  },
  null,
  2,
);
