// 课程包资料：老师发布的练习句集合。设备本地存储，不上传服务器。
export type Level = '入门' | '进阶' | '挑战';
export type LearnStatus = 'new' | 'practice' | 'mastered';

/** 课程包中的句子定义（老师提供的原始资料） */
export interface SentenceDraft {
  /** 课程包内的稳定编号，仅用于打包，不作为学员本地数据的身份依据 */
  ref: string;
  text: string;
  translation: string;
  tag: string;
  level: Level;
}

/** 老师发布的课程包 */
export interface CoursePackage {
  courseId: string;
  courseName: string;
  version: number;
  publishedAt: string;
  notes?: string;
  sentences: SentenceDraft[];
}

/** 一条跟读录音（本地模拟录音，仅保存元信息） */
export interface Recording {
  id: string;
  /** ISO 时间 */
  at: string;
  durationSec: number;
}

/** 学员正在练习的句子，录音与掌握状态都挂在这条记录上 */
export interface Phrase {
  id: number;
  text: string;
  translation: string;
  tag: string;
  level: Level;
  status: LearnStatus;
  attempts: number;
  /** 最近练习，ISO 时间；旧版种子数据里可能是“今天 09:24”这样的展示文案 */
  last?: string;
  recordings: Recording[];
}

/** 历史区里的句子：被移走或被改写后封存的旧稿 */
export interface ArchivedPhrase extends Phrase {
  archivedAt: string;
  /** 归档原因 */
  reason: 'removed' | 'rewritten';
  /** 若因改写而封存，指向接管它的新练习项 */
  successorId?: number;
}

export interface CourseState {
  courseId: string;
  courseName: string;
  version: number;
  importedAt: string;
  phrases: Phrase[];
  archive: ArchivedPhrase[];
}

export const STORAGE_KEY = 'sound-lab-course-v2';
