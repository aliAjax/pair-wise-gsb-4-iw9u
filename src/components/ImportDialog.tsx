import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  FileUp,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Mic,
  PenLine,
  PencilLine,
  PlusCircle,
  ShieldCheck,
  Split,
  X,
} from 'lucide-react';
import { parseCoursePack, SAMPLE_PACK } from '../lib/coursePack';
import type { PreparedSentence } from '../lib/coursePack';
import {
  applyImport,
  buildImportPlan,
  formatDuration,
  hasRecording,
  statusLabel,
} from '../lib/takeover';
import type { ArchivedPhrase, EditDecision, ImportItem, Phrase } from '../lib/takeover';

interface ImportDialogProps {
  phrases: Phrase[];
  onClose: () => void;
  onApply: (result: { phrases: Phrase[]; archives: ArchivedPhrase[]; summary: string }) => void;
}

type Step = 'paste' | 'review';

export default function ImportDialog({ phrases, onClose, onApply }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('paste');
  const [raw, setRaw] = useState(SAMPLE_PACK);
  const [sentences, setSentences] = useState<PreparedSentence[]>([]);
  const [packMeta, setPackMeta] = useState<{ name?: string; version?: string; updatedAt?: string }>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, EditDecision>>({});

  const plan = useMemo(
    () => (step === 'review' ? buildImportPlan(phrases, sentences) : null),
    [step, phrases, sentences],
  );

  const analyze = () => {
    const parsed = parseCoursePack(raw);
    setErrors(parsed.errors);
    setWarnings(parsed.warnings);
    if (parsed.errors.length > 0 || parsed.sentences.length === 0) return;
    setSentences(parsed.sentences);
    setPackMeta({ name: parsed.pack?.name, version: parsed.pack?.version, updatedAt: parsed.pack?.updatedAt });
    setDecisions({});
    setConfirmed(false);
    setStep('review');
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result || ''));
    reader.readAsText(file);
  };

  const save = () => {
    if (!plan || !confirmed) return;
    const result = applyImport(phrases, plan, decisions);
    const parts: string[] = [];
    if (plan.counts.keep) parts.push(`${plan.counts.keep} 句数据原样跟随`);
    const edited = plan.items.filter((i) => i.kind === 'edit' && (decisions[i.incomingIndex] ?? 'edit') === 'edit').length;
    const kept = plan.items.filter((i) => i.kind === 'edit' && decisions[i.incomingIndex] === 'keep').length;
    const split = plan.items.filter((i) => i.kind === 'edit' && decisions[i.incomingIndex] === 'split').length;
    if (edited) parts.push(`${edited} 句改字（旧稿已留档）`);
    if (kept) parts.push(`${kept} 句判为同一句（数据跟随）`);
    if (split) parts.push(`${split} 句新旧并存`);
    if (plan.counts.add) parts.push(`${plan.counts.add} 句新增`);
    if (result.archives.filter((a) => a.archiveReason === 'removed').length)
      parts.push(`${result.archives.filter((a) => a.archiveReason === 'removed').length} 句移入历史区`);
    onApply({
      phrases: result.phrases,
      archives: result.archives,
      summary: parts.join('，'),
    });
  };

  return (
    <div className="modal-backdrop imp-backdrop" onClick={onClose}>
      <div className="modal imp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="imp-head">
          <div>
            <span className="label">COURSE PACKAGE</span>
            <h2>{step === 'paste' ? '导入老师更新的课程包' : '核对接管清单'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {step === 'paste' ? (
          <>
            <div className="imp-steps"><b className="on">1 粘贴课程包</b><i/><b>2 逐句核对</b><i/><b>3 确认保存</b></div>
            <div className="imp-drop">
              <FileUp size={18} />
              <span>拖入或选择老师下发的 <code>.json</code> 课程包，也可以直接粘贴到下方</span>
              <label className="secondary imp-filebtn">
                <FolderOpen size={14} /> 选择文件
                <input type="file" accept=".json,application/json" onChange={(e) => pickFile(e.target.files?.[0])} hidden />
              </label>
            </div>
            <textarea
              className="imp-textarea"
              spellCheck={false}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{"name":"课程名","version":"v2","sentences":[{"text":"..."}]}'
            />
            {errors.map((e) => <p key={e} className="imp-err"><HelpCircle size={13} />{e}</p>)}
            {warnings.slice(0, 3).map((w) => <p key={w} className="imp-warn">{w}</p>)}
            <div className="imp-localnote"><ShieldCheck size={14} /> 课程包仅在本机解析，不会上传；点“核对接管清单”前不会改动任何练习数据。</div>
            <div className="modal-actions">
              <button className="secondary" onClick={onClose}>取消</button>
              <button className="primary" onClick={analyze}>核对接管清单 <ArrowRight size={15} /></button>
            </div>
          </>
        ) : plan ? (
          <>
            <div className="imp-steps"><b className="done">1 粘贴课程包</b><i/><b className="on">2 逐句核对</b><i/><b>3 确认保存</b></div>

            <div className="imp-packmeta">
              <GraduationCap size={16} />
              <div>
                <strong>{packMeta.name || '未命名课程'}</strong>
                <span>{packMeta.version || '无版本号'}{packMeta.updatedAt ? ` · 更新于 ${packMeta.updatedAt}` : ''}</span>
              </div>
            </div>

            <div className="imp-summary">
              <span className="tag-keep"><CheckCircle2 size={13} />原样接管 {plan.counts.keep}</span>
              <span className="tag-edit"><PenLine size={13} />需要决定 {plan.counts.edit}</span>
              <span className="tag-add"><PlusCircle size={13} />新增 {plan.counts.add}</span>
              <span className="tag-arch"><Archive size={13} />移入历史 {plan.counts.archive}</span>
            </div>

            <div className="imp-list">
              {plan.items.map((item) => <ImportRow key={item.incomingIndex} item={item}
                decision={decisions[item.incomingIndex] ?? 'edit'}
                onChange={(d) => setDecisions((s) => ({ ...s, [item.incomingIndex]: d }))} />)}

              {plan.archives.map(({ phrase }) => (
                <div key={phrase.id} className="imp-card imp-archive-row">
                  <div className="imp-cardicon arch"><Archive size={14} /></div>
                  <div className="imp-cardbody">
                    <div className="imp-cardtitle">
                      <span className="imp-badge arch">移走 · 收进历史区</span>
                      {hasRecording(phrase) && <span className="imp-data"><Mic size={11} />录音 {formatDuration(phrase.recording?.durationSec)}</span>}
                      <span className="imp-data">{statusLabel(phrase.status)}</span>
                      <span className="imp-data">{phrase.attempts} 次练习</span>
                    </div>
                    <p className="imp-old">{phrase.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <label className="imp-confirm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              我已看清换句情况：录音与掌握状态只跟随“原样接管”和判为“同一句”的句子；改字的旧稿和移走的句子都会保存在历史区，不会删除。
            </label>

            <div className="modal-actions">
              <button className="secondary" onClick={() => setStep('paste')}>返回修改</button>
              <button className="primary" disabled={!confirmed} onClick={save}>
                确认保存新课程
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ImportRow({
  item,
  decision,
  onChange,
}: {
  item: ImportItem;
  decision: EditDecision;
  onChange: (d: EditDecision) => void;
}) {
  if (item.kind === 'keep') {
    return (
      <div className="imp-card">
        <div className="imp-cardicon keep"><CheckCircle2 size={14} /></div>
        <div className="imp-cardbody">
          <div className="imp-cardtitle">
            <span className="imp-badge keep">原句保留 · 数据跟随</span>
            {hasRecording(item.old) && <span className="imp-data"><Mic size={11} />录音 {formatDuration(item.old.recording?.durationSec)}</span>}
            <span className="imp-data">{statusLabel(item.old.status)}</span>
            <span className="imp-data">{item.old.attempts} 次练习</span>
            {item.metaChanged && <span className="imp-data refresh">译文/分类资料将更新</span>}
          </div>
          <p className="imp-new">{item.incoming.text}</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'add') {
    return (
      <div className="imp-card">
        <div className="imp-cardicon add"><PlusCircle size={14} /></div>
        <div className="imp-cardbody">
          <div className="imp-cardtitle"><span className="imp-badge add">新增练习句 · 从新开始</span></div>
          <p className="imp-new">{item.incoming.text}</p>
        </div>
      </div>
    );
  }

  // edit：逐句决定
  const options: { value: EditDecision; label: string; icon: typeof PenLine }[] = [
    { value: 'edit', label: '改过字 · 旧稿留档', icon: PencilLine },
    { value: 'keep', label: '其实是同一句 · 数据跟随', icon: CheckCircle2 },
    { value: 'split', label: '新旧并存 · 旧稿留存', icon: Split },
  ];

  return (
    <div className={`imp-card imp-edit ${decision !== 'edit' ? 'manual' : ''}`}>
      <div className="imp-cardicon edit"><PenLine size={14} /></div>
      <div className="imp-cardbody">
        <div className="imp-cardtitle">
          <span className="imp-badge edit">疑似改字 · 需逐个决定</span>
          <span className="imp-sim">文字相似度 {Math.round(item.similarity * 100)}%</span>
          {hasRecording(item.old) && <span className="imp-data"><Mic size={11} />旧录音 {formatDuration(item.old.recording?.durationSec)}</span>}
          <span className="imp-data">{statusLabel(item.old.status)} · {item.old.attempts} 次练习</span>
        </div>
        <div className="imp-diff">
          <p><span>旧</span>{item.old.text}</p>
          <p><span>新</span>{item.incoming.text}</p>
        </div>
        <div className="imp-opts">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={decision === value ? `imp-opt sel ${value}` : 'imp-opt'}
              onClick={() => onChange(value)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <p className="imp-decision-note">
          {decision === 'edit' && '新句作为全新练习项；旧句连同录音、掌握状态一起留档到历史区。'}
          {decision === 'keep' && '按同一句处理：录音、掌握状态、练习次数全部接到新文字上，不产生历史稿。'}
          {decision === 'split' && '新句独立开练；旧句作为“留存稿”保存在历史区，可随时回看。'}
        </p>
      </div>
    </div>
  );
}
