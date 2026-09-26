import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, FileUp, History, Mic, Package, PencilLine, Plus, X } from 'lucide-react';
import { builtinPackages } from '../course/sampleCourse';
import { parseCoursePackage } from '../course/packageIO';
import {
  applyImport, defaultDecisions, diffCourse, reviewCount, similarity,
  type CourseDiff, type Decisions,
} from '../course/diffCourse';
import type { CoursePackage, CourseState } from '../course/types';
import { formatDate } from '../course/time';

interface Props {
  state: CourseState;
  onClose: () => void;
  onConfirm: (next: CourseState, pkg: CoursePackage) => void;
}

type Step = 'select' | 'review';

export default function ImportWizard({ state, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [pkg, setPkg] = useState<CoursePackage | null>(null);
  const [diff, setDiff] = useState<CourseDiff | null>(null);
  const [decisions, setDecisions] = useState<Decisions | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const sameCourse = pkg?.courseId === state.courseId;

  const choosePackage = (p: CoursePackage) => {
    setError('');
    if (p.version < state.version) {
      setError(`${p.courseName} v${p.version} 比当前 v${state.version} 旧，不能用旧课程包覆盖。`);
      return;
    }
    if (p.version === state.version) {
      setError(`当前已经是 v${p.version}，无需重复导入。`);
      return;
    }
    const d = diffCourse(state, p);
    setPkg(p);
    setDiff(d);
    setDecisions(defaultDecisions(d));
    setStep('review');
  };

  const acceptText = () => {
    const r = parseCoursePackage(pasteText);
    if (!r.ok) { setError(r.error); return; }
    choosePackage(r.pkg);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = parseCoursePackage(String(reader.result ?? ''));
      if (!r.ok) { setError(r.error); return; }
      choosePackage(r.pkg);
    };
    reader.readAsText(file);
  };

  const setEdited = (key: string, action: Decisions['edited'][string]) =>
    setDecisions(d => d && { ...d, edited: { ...d.edited, [key]: action } });
  const setRemoved = (key: string, action: Decisions['removed'][string]) =>
    setDecisions(d => d && { ...d, removed: { ...d.removed, [key]: action } });
  const setAdded = (key: string, action: Decisions['added'][string]) =>
    setDecisions(d => d && { ...d, added: { ...d.added, [key]: action } });

  const counts = useMemo(() => diff ? ({
    drafts: diff.edited.filter(i => decisions?.edited[i.key] === 'keep-draft').length,
    takeovers: diff.edited.filter(i => decisions?.edited[i.key] === 'take-over').length,
    archives: diff.removed.filter(i => decisions?.removed[i.key] === 'archive').length,
    adds: diff.added.filter(i => decisions?.added[i.key] === 'add').length,
  }) : null, [diff, decisions]);

  const confirm = () => {
    if (!pkg || !diff || !decisions) return;
    onConfirm(applyImport(state, diff, decisions, new Date().toISOString()), pkg);
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal wizard" onClick={e => e.stopPropagation()}>
      <div className="modal-head">
        <h2><Package size={18} /> 导入老师的新课程包</h2>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      {step === 'select' && <div className="wizard-body">
        <p className="wizard-intro">
          导入前会先对比新旧句子：<b>原句保留录音与进度</b>，改过字的句子默认留旧稿另建新项，被移走的句子收进历史区。确认后才会保存。
        </p>
        <div className="wizard-current">
          <span>当前课程</span>
          <strong>{state.courseName} · v{state.version}</strong>
        </div>

        <div className="wizard-label">内置课程包</div>
        <div className="pkg-options">
          {builtinPackages.map(p => <button key={p.version} className="pkg-option" onClick={() => choosePackage(p)}>
            <div className="pkg-option-icon"><Package size={16} /></div>
            <div className="pkg-option-copy">
              <strong>{p.courseName} · v{p.version}</strong>
              <span>发布于 {formatDate(p.publishedAt)} · {p.sentences.length} 句{p.notes ? ` · ${p.notes}` : ''}</span>
            </div>
            <ChevronRight size={16} />
          </button>)}
        </div>

        <div className="wizard-label">或使用老师发来的课程包</div>
        <div className="pkg-drop">
          <FileUp size={18} />
          <span>拖放 JSON 文件到这里，或</span>
          <button className="secondary" onClick={() => fileRef.current?.click()}>选择文件</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
        <textarea
          className="pkg-paste"
          placeholder="也可以直接粘贴课程包 JSON…"
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          spellCheck={false}
        />
        {pasteText.trim() && <button className="secondary pkg-paste-btn" onClick={acceptText}>解析粘贴内容</button>}
        {error && <p className="wizard-error"><AlertTriangle size={14} /> {error}</p>}
      </div>}

      {step === 'review' && diff && decisions && pkg && <div className="wizard-body">
        <div className="review-banner">
          <div><strong>{pkg.courseName} · v{pkg.version}</strong><span>发布于 {formatDate(pkg.publishedAt)}</span></div>
          {!sameCourse && <span className="review-course-warn"><AlertTriangle size={13} /> 与当前课程（{state.courseId}）不是同一门课，将整库接管</span>}
          {sameCourse && reviewCount(diff) > 0 && <span className="review-need"><AlertTriangle size={13} /> {reviewCount(diff)} 处需要你逐个确认</span>}
          {sameCourse && reviewCount(diff) === 0 && <span className="review-ok"><Check size={13} /> 没有需要逐句决定的改动</span>}
        </div>

        <div className="review-scroll">
          {diff.unchanged.length > 0 && <ReviewGroup title="原句继续使用" tone="green" count={diff.unchanged.length}
            hint="录音与掌握状态原样跟过去">
            {diff.unchanged.map(i => <div key={i.key} className="diff-row keep">
              <div className="diff-icon green"><Check size={14} /></div>
              <div className="diff-copy">
                <strong>{i.phrase.text}</strong>
                <span className="diff-sub">
                  {i.phrase.status === 'mastered' ? '已掌握' : i.phrase.status === 'practice' ? `练习中 · ${i.phrase.attempts} 次跟读` : '尚未开始'}
                  {i.phrase.recordings.length > 0 && ` · ${i.phrase.recordings.length} 条录音`}
                  {i.metaChanges.length > 0 && ` · ${i.metaChanges.join('、')}（随包更新）`}
                </span>
              </div>
              <span className="diff-tag green">进度跟过去</span>
            </div>)}
          </ReviewGroup>}

          {diff.edited.length > 0 && <ReviewGroup title="改过字（逐个决定）" tone="amber" count={diff.edited.length}
            hint="默认保留旧稿进历史区，并建立全新练习项">
            {diff.edited.map(i => <div key={i.key} className="diff-row edit">
              <div className="diff-icon amber"><PencilLine size={14} /></div>
              <div className="diff-copy">
                <div className="diff-texts">
                  <span className="old-text">{i.phrase.text}</span>
                  <ChevronRight size={13} className="diff-arrow" />
                  <span className="new-text">{i.draft.text}</span>
                </div>
                <span className="diff-sub">
                  文字相似度 {Math.round(similarity(i.phrase.text, i.draft.text) * 100)}% · 旧句
                  {i.phrase.status === 'mastered' ? '已掌握' : `有 ${i.phrase.attempts} 次跟读`}
                  {i.phrase.recordings.length > 0 && `、${i.phrase.recordings.length} 条录音`}
                </span>
                <div className="decision">
                  <button className={decisions.edited[i.key] === 'keep-draft' ? 'dec active warn' : 'dec'}
                    onClick={() => setEdited(i.key, 'keep-draft')}>留旧稿 + 新建练习项</button>
                  <button className={decisions.edited[i.key] === 'take-over' ? 'dec active take' : 'dec'}
                    onClick={() => setEdited(i.key, 'take-over')}>同一句改字，录音进度跟过去</button>
                  <button className={decisions.edited[i.key] === 'drop-old' ? 'dec active danger' : 'dec'}
                    onClick={() => setEdited(i.key, 'drop-old')}>丢弃旧稿，新建练习项</button>
                </div>
              </div>
            </div>)}
          </ReviewGroup>}

          {diff.removed.length > 0 && <ReviewGroup title="新版中被移走" tone="gray" count={diff.removed.length}
            hint="默认收进历史区，录音随旧稿保留">
            {diff.removed.map(i => <div key={i.key} className="diff-row remove">
              <div className="diff-icon gray"><History size={14} /></div>
              <div className="diff-copy">
                <strong>{i.phrase.text}</strong>
                <span className="diff-sub">
                  {i.phrase.status === 'mastered' ? '已掌握' : i.phrase.status === 'practice' ? `练习中 · ${i.phrase.attempts} 次跟读` : '尚未开始'}
                  {i.phrase.recordings.length > 0 && ` · ${i.phrase.recordings.length} 条录音`}
                </span>
                <div className="decision">
                  <button className={decisions.removed[i.key] === 'archive' ? 'dec active warn' : 'dec'}
                    onClick={() => setRemoved(i.key, 'archive')}>收进历史区</button>
                  <button className={decisions.removed[i.key] === 'keep' ? 'dec active neutral' : 'dec'}
                    onClick={() => setRemoved(i.key, 'keep')}>仍留在练习库</button>
                </div>
              </div>
            </div>)}
          </ReviewGroup>}

          {diff.added.length > 0 && <ReviewGroup title="全新加入的句子" tone="blue" count={diff.added.length}
            hint="作为新练习项加入，从零开始">
            {diff.added.map(i => <div key={i.key} className="diff-row add">
              <div className="diff-icon blue"><Plus size={14} /></div>
              <div className="diff-copy">
                <strong>{i.draft.text}</strong>
                <span className="diff-sub">{i.draft.translation} · {i.draft.tag} · {i.draft.level}</span>
                <div className="decision">
                  <button className={decisions.added[i.key] === 'add' ? 'dec active take' : 'dec'}
                    onClick={() => setAdded(i.key, 'add')}>加入练习库</button>
                  <button className={decisions.added[i.key] === 'skip' ? 'dec active neutral' : 'dec'}
                    onClick={() => setAdded(i.key, 'skip')}>这次跳过</button>
                </div>
              </div>
            </div>)}
          </ReviewGroup>}
        </div>

        <div className="wizard-foot">
          <div className="confirm-summary">
            {counts && counts.drafts > 0 && <span><i className="amber-dot" />{counts.drafts} 句留旧稿新建</span>}
            {counts && counts.takeovers > 0 && <span><i className="green-dot" />{counts.takeovers} 句直接接管</span>}
            {counts && counts.archives > 0 && <span><i className="gray-dot" />{counts.archives} 句进历史区</span>}
            {counts && counts.adds > 0 && <span><i className="blue-dot" />{counts.adds} 句新加入</span>}
            {diff.unchanged.length > 0 && <span><Mic size={12} />{diff.unchanged.length} 句录音进度保留</span>}
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setStep('select')}>返回</button>
            <button className="primary" onClick={confirm}>确认无误，保存新课程</button>
          </div>
        </div>
      </div>}
    </div>
  </div>;
}

function ReviewGroup({ title, hint, count, tone, children }: {
  title: string; hint: string; count: number; tone: 'green' | 'amber' | 'gray' | 'blue'; children: ReactNode;
}) {
  return <section className={`review-group ${tone}`}>
    <h3><i className={`group-dot ${tone}`} />{title} <b>{count}</b><span>{hint}</span></h3>
    {children}
  </section>;
}
