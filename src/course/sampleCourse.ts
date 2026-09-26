import type { CoursePackage } from './types';

// 内置课程包资料：v1 与设备初始练习一致；v2 演示老师更新整套句子时的各种情况。
export const courseV1: CoursePackage = {
  courseId: 'daily-shadowing',
  courseName: '日常跟读训练',
  version: 1,
  publishedAt: '2026-09-01',
  notes: '第一版课程包',
  sentences: [
    { ref: 's1', text: 'The morning light feels different today.', translation: '今天的晨光感觉不一样。', tag: '日常', level: '入门' },
    { ref: 's2', text: 'Could you walk me through the next step?', translation: '你能带我了解下一步吗？', tag: '工作', level: '进阶' },
    { ref: 's3', text: 'I appreciate your patience and thoughtful feedback.', translation: '感谢你的耐心和细致反馈。', tag: '表达', level: '挑战' },
    { ref: 's4', text: 'Let’s make room for a little curiosity.', translation: '给好奇心留一点空间。', tag: '灵感', level: '入门' },
  ],
};

export const courseV2: CoursePackage = {
  courseId: 'daily-shadowing',
  courseName: '日常跟读训练',
  version: 2,
  publishedAt: '2026-09-22',
  notes: '修订部分句子、下线旧话题并补充新句型',
  sentences: [
    // 原句继续使用：录音与掌握状态直接跟过去（译文老师做了润色）
    { ref: 's1', text: 'The morning light feels different today.', translation: '清晨的光线今天感觉不太一样。', tag: '日常', level: '入门' },
    // 改过字：需要逐句决定——默认留旧稿、另建新练习项
    { ref: 's2', text: 'Could you walk me through the setup step by step?', translation: '你能带我一步步完成设置吗？', tag: '工作', level: '进阶' },
    // 改过字（另一处）
    { ref: 's3', text: 'I truly appreciate your patience and honest feedback.', translation: '我真心感谢你的耐心和坦诚反馈。', tag: '表达', level: '挑战' },
    // 全新加入的句子
    { ref: 's5', text: 'Small steps every day lead to big changes.', translation: '每天一小步，带来大改变。', tag: '励志', level: '入门' },
    // s4「Let’s make room for a little curiosity.」在新版中被移走
  ],
};

/** 老师可以导入的内置课程包 */
export const builtinPackages: CoursePackage[] = [courseV2];
