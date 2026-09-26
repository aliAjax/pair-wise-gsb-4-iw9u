import type { CoursePackage, Level } from './types';

// 课程包资料的解析与校验：支持老师分享的 JSON 文件 / 粘贴文本。

const LEVELS: Level[] = ['入门', '进阶', '挑战'];

export type ParseResult =
  | { ok: true; pkg: CoursePackage }
  | { ok: false; error: string };

export function parseCoursePackage(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '不是有效的 JSON，请检查课程包内容。' };
  }
  const obj = data as Partial<CoursePackage>;
  if (!obj || typeof obj !== 'object') return { ok: false, error: '课程包顶层必须是一个对象。' };
  if (!obj.courseId || typeof obj.courseId !== 'string') return { ok: false, error: '缺少 courseId（课程标识）。' };
  if (!obj.courseName || typeof obj.courseName !== 'string') return { ok: false, error: '缺少 courseName（课程名称）。' };
  if (typeof obj.version !== 'number' || obj.version < 1) return { ok: false, error: '缺少有效的 version（版本号，正整数）。' };
  if (!Array.isArray(obj.sentences) || obj.sentences.length === 0) return { ok: false, error: 'sentences 为空，至少需要一个句子。' };

  const seen = new Set<string>();
  const sentences = obj.sentences.map((s, i) => {
    const d = s as Partial<CoursePackage['sentences'][number]>;
    const where = `第 ${i + 1} 句`;
    if (!d || typeof d !== 'object') throw new Error(`${where}格式不正确。`);
    if (!d.text || !d.text.trim()) throw new Error(`${where}缺少英文 text。`);
    const text = d.text.trim();
    const key = text.toLowerCase();
    if (seen.has(key)) throw new Error(`${where}与包内其它句子文字完全重复：${text}`);
    seen.add(key);
    if (!d.translation || !d.translation.trim()) throw new Error(`${where}缺少中文 translation。`);
    if (!d.tag || !d.tag.trim()) throw new Error(`${where}缺少 tag 分类。`);
    if (!d.level || !LEVELS.includes(d.level as Level)) throw new Error(`${where}的 level 必须是 入门 / 进阶 / 挑战。`);
    return {
      ref: typeof d.ref === 'string' && d.ref ? d.ref : `s${i + 1}`,
      text,
      translation: d.translation.trim(),
      tag: d.tag.trim(),
      level: d.level as Level,
    };
  });

  return {
    ok: true,
    pkg: {
      courseId: obj.courseId,
      courseName: obj.courseName,
      version: obj.version,
      publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt : '',
      notes: typeof obj.notes === 'string' ? obj.notes : undefined,
      sentences,
    },
  };
}
