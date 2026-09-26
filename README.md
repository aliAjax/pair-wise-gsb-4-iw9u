# 声线练习室 · 英语跟读

纯前端英语跟读练习应用（React + TypeScript + Vite）。练习句、跟读录音、掌握状态全部保存在本设备的 localStorage 中，不上传服务器。

## 课程包更新与旧数据接管

老师更新整套练习句后，通过顶栏「导入新课程包」导入。系统**按句子文字**识别新旧关系，导入前先展示差异、逐句决定，确认后才保存：

| 情况 | 默认处理 |
|---|---|
| 原句文字不变 | 录音、练习次数、掌握状态原样跟过去；译文/分类/难度随包更新 |
| 改过字（疑似同一句） | 旧稿收进历史区，另建全新练习项；可逐句改为「直接接管（进度跟过去）」或「丢弃旧稿」 |
| 新版中被移走 | 收进历史区，录音随旧稿保留；也可选择仍留在练习库 |
| 全新加入的句子 | 作为新练习项从零开始；可逐句跳过 |

侧边栏「历史区」可查看被移走的旧句和改写旧稿，并可恢复回练习库。

## 模块组织

- `src/course/types.ts` — 数据结构（课程包、练习句、录音、历史区）
- `src/course/sampleCourse.ts` — 课程包资料（内置 v1/v2 示例，v2 演示各类替换场景）
- `src/course/packageIO.ts` — 课程包 JSON 解析与校验（文件/粘贴）
- `src/course/diffCourse.ts` — 接管规则：文字归一化、相似度配对、逐句决定、生成新课程
- `src/course/storage.ts` — 设备本地存储、旧版数据迁移、初始示例数据
- `src/course/time.ts` — ISO 存储与相对时间展示
- `src/components/ImportWizard.tsx` — 导入操作页面（选包 → 差异审阅 → 确认保存）
- `src/components/HistoryView.tsx` — 历史区页面

## 课程包格式

```json
{
  "courseId": "daily-shadowing",
  "courseName": "日常跟读训练",
  "version": 2,
  "publishedAt": "2026-09-22",
  "notes": "可选说明",
  "sentences": [
    { "ref": "s1", "text": "English text.", "translation": "中文译文", "tag": "日常", "level": "入门" }
  ]
}
```

`level` 取值：入门 / 进阶 / 挑战。接管以文字为准，`ref` 仅用于打包排版。

## 开发

```bash
npm install
npm run dev
npm run build
```
