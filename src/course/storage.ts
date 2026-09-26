import type { CourseState, Phrase, Recording } from './types';
import { STORAGE_KEY } from './types';
import { courseV1 } from './sampleCourse';

// 数据全部留在本设备：localStorage 保存练习状态与录音元信息，不经过任何服务器。

const LEGACY_KEY = 'sound-lab-phrases';

function hoursAgoISO(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

/** 设备初始练习：与课程包 v1 一致，并带有示范的录音与学习进度 */
export function createSeedState(): CourseState {
  const phrases: Phrase[] = courseV1.sentences.map((d, i) => ({
    id: i + 1,
    text: d.text,
    translation: d.translation,
    tag: d.tag,
    level: d.level,
    status: 'new',
    attempts: 0,
    recordings: [],
  }));
  // 句子 1：练习中，3 次跟读
  phrases[0] = {
    ...phrases[0],
    status: 'practice',
    attempts: 3,
    last: hoursAgoISO(26),
    recordings: [
      { id: 'rec-seed-1', at: hoursAgoISO(50), durationSec: 6 },
      { id: 'rec-seed-2', at: hoursAgoISO(26), durationSec: 7 },
    ],
  };
  // 句子 3：已掌握，8 次跟读
  phrases[2] = {
    ...phrases[2],
    status: 'mastered',
    attempts: 8,
    last: hoursAgoISO(2),
    recordings: [{ id: 'rec-seed-3', at: hoursAgoISO(2), durationSec: 9 }],
  };
  return {
    courseId: courseV1.courseId,
    courseName: courseV1.courseName,
    version: 1,
    importedAt: hoursAgoISO(24 * 20),
    phrases,
    archive: [],
  };
}

/** 兼容旧版本（接管功能上线前）的练习数据 */
function migrateLegacy(raw: string): CourseState | null {
  try {
    const old = JSON.parse(raw) as Array<Partial<Phrase>>;
    if (!Array.isArray(old)) return null;
    const phrases: Phrase[] = old.map((p, i) => ({
      id: typeof p.id === 'number' ? p.id : i + 1,
      text: String(p.text ?? ''),
      translation: String(p.translation ?? ''),
      tag: String(p.tag ?? '自定义'),
      level: p.level === '进阶' || p.level === '挑战' ? p.level : '入门',
      status: p.status === 'mastered' || p.status === 'practice' ? p.status : 'new',
      attempts: typeof p.attempts === 'number' ? p.attempts : 0,
      last: p.last,
      recordings: [],
    }));
    return {
      courseId: courseV1.courseId,
      courseName: courseV1.courseName,
      version: 1,
      importedAt: new Date().toISOString(),
      phrases,
      archive: [],
    };
  } catch {
    return null;
  }
}

export function loadState(): CourseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as CourseState;
      if (state && Array.isArray(state.phrases)) {
        return { ...createSeedState(), ...state, archive: state.archive ?? [] };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateLegacy(legacy);
      if (migrated) return migrated;
    }
  } catch {
    // 读取失败时回落到示例数据
  }
  return createSeedState();
}

export function saveState(state: CourseState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function newRecording(durationSec: number): Recording {
  return { id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), durationSec };
}
