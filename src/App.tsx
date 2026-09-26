import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Clock3, History, Mic, Pause, Play, Plus, RotateCcw, Search, Trash2, Upload, Volume2 } from 'lucide-react';
import ImportDialog from './components/ImportDialog';
import HistoryView from './components/HistoryView';
import { archivePhrase, makePhraseId, todayLabel } from './lib/takeover';
import type { ArchivedPhrase, Phrase } from './lib/takeover';

type LegacyPhrase = {
  id: number;
  text: string;
  translation: string;
  tag: string;
  level: '入门' | '进阶' | '挑战';
  status: 'new' | 'practice' | 'mastered';
  attempts: number;
  last?: string;
};

const seed: Phrase[] = [
  {
    id: 'seed-1', text: 'The morning light feels different today.', translation: '今天的晨光感觉不一样。', tag: '日常', level: '入门',
    status: 'practice', attempts: 3, last: '今天 09:24',
    recording: { durationSec: 8, recordedAt: '今天 09:24' },
  },
  { id: 'seed-2', text: 'Could you walk me through the next step?', translation: '你能带我了解下一步吗？', tag: '工作', level: '进阶', status: 'new', attempts: 0 },
  {
    id: 'seed-3', text: 'I appreciate your patience and thoughtful feedback.', translation: '感谢你的耐心和细致反馈。', tag: '表达', level: '挑战',
    status: 'mastered', attempts: 8, last: '昨天 18:10',
    recording: { durationSec: 11, recordedAt: '昨天 18:10' },
  },
  {
    id: 'seed-4', text: "Let’s make room for a little curiosity.", translation: '给好奇心留一点空间。', tag: '灵感', level: '入门',
    status: 'practice', attempts: 2, last: '周一 20:02',
    recording: { durationSec: 6, recordedAt: '周一 20:02' },
  },
];

const PHRASES_KEY = 'sound-lab-phrases-v2';
const ARCHIVES_KEY = 'sound-lab-archives-v2';
const LEGACY_KEY = 'sound-lab-phrases';

/** 旧版数据迁移：id 由数字转字符串；有练习次数的补一条录音占位，保证接管时数据可追溯 */
function migrateLegacy(raw: string | null): Phrase[] | null {
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as LegacyPhrase[];
    if (!Array.isArray(legacy)) return null;
    return legacy.map((p) => ({
      id: String(p.id),
      text: p.text,
      translation: p.translation,
      tag: p.tag,
      level: p.level,
      status: p.status,
      attempts: p.attempts,
      last: p.last,
      recording: p.attempts > 0 ? { durationSec: 8, recordedAt: p.last } : undefined,
    }));
  } catch {
    return null;
  }
}

function loadPhrases(): Phrase[] {
  try {
    const raw = localStorage.getItem(PHRASES_KEY);
    if (raw) return JSON.parse(raw) as Phrase[];
  } catch { /* 损坏数据则回落 */ }
  const migrated = migrateLegacy(localStorage.getItem(LEGACY_KEY));
  return migrated ?? seed;
}

function loadArchives(): ArchivedPhrase[] {
  try {
    const raw = localStorage.getItem(ARCHIVES_KEY);
    if (raw) return JSON.parse(raw) as ArchivedPhrase[];
  } catch { /* ignore */ }
  return [];
}

const bars = Array.from({ length: 68 }, (_, i) => 18 + ((i * 29) % 44));

export default function App() {
  const [phrases, setPhrases] = useState<Phrase[]>(loadPhrases);
  const [archives, setArchives] = useState<ArchivedPhrase[]>(loadArchives);
  const [view, setView] = useState<'practice' | 'history'>('practice');
  const [selected, setSelected] = useState(phrases[0]?.id ?? '');
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState('');
  const [newText, setNewText] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const current = phrases.find((p) => p.id === selected) ?? phrases[0];
  const filtered = useMemo(
    () => phrases.filter(
      (p) =>
        (filter === '全部' || p.tag === filter || p.level === filter || (filter === '待练' && p.status !== 'mastered')) &&
        p.text.toLowerCase().includes(query.toLowerCase()),
    ),
    [phrases, filter, query],
  );
  const tags = ['全部', ...Array.from(new Set(phrases.map((p) => p.tag)))];

  useEffect(() => { localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases)); }, [phrases]);
  useEffect(() => { localStorage.setItem(ARCHIVES_KEY, JSON.stringify(archives)); }, [archives]);
  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const startRecord = () => {
    if (recording) {
      setRecording(false);
      window.clearInterval(timer.current);
      setRecorded(true);
      const duration = seconds > 0 ? seconds : 8;
      const stamp = todayLabel();
      setPhrases((ps) =>
        ps.map((p) =>
          p.id === selected
            ? {
                ...p,
                attempts: p.attempts + 1,
                status: 'practice',
                last: '刚刚',
                recording: { durationSec: duration, recordedAt: stamp },
              }
            : p,
        ),
      );
      return;
    }
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const addPhrase = () => {
    if (!newText.trim()) return;
    const id = makePhraseId();
    setPhrases((ps) => [...ps, {
      id, text: newText.trim(), translation: '待补充译文', tag: '自定义', level: '入门', status: 'new', attempts: 0,
    }]);
    setSelected(id);
    setNewText('');
    setShowAdd(false);
  };

  /** 手动删除不再直接消失：收进历史区，录音与进度一起保留 */
  const removePhrase = () => {
    if (!current) return;
    setArchives((as) => [archivePhrase(current), ...as]);
    const rest = phrases.filter((p) => p.id !== current.id);
    setPhrases(rest);
    setSelected(rest[0]?.id ?? '');
  };

  const handleImport = (result: { phrases: Phrase[]; archives: ArchivedPhrase[]; summary: string }) => {
    setPhrases(result.phrases);
    setArchives((as) => [...result.archives, ...as]);
    setSelected(result.phrases[0]?.id ?? '');
    setShowImport(false);
    setView('practice');
    setToast(`新课程已保存：${result.summary}。`);
  };

  const restoreArchived = (archived: ArchivedPhrase) => {
    setArchives((as) => as.filter((a) => a.id !== archived.id));
    const { archivedAt: _a, archiveReason: _r, supersededById: _s, preserved: _p, ...phrase } = archived;
    setPhrases((ps) => (ps.some((p) => p.id === phrase.id) ? ps : [...ps, phrase]));
    setSelected(phrase.id);
    setView('practice');
    setToast(`「${phrase.text.slice(0, 18)}…」已恢复到练习库，录音与掌握状态保持原样。`);
  };

  const deleteArchived = (id: string) => {
    setArchives((as) => as.filter((a) => a.id !== id));
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Volume2 size={19} /></div>
        <div><strong>声线练习室</strong><span>Pronounce / practice</span></div>
      </div>
      <div className="side-label">我的练习</div>
      <nav>
        <button className={view === 'practice' ? 'side-link active' : 'side-link'} onClick={() => setView('practice')}>
          <Mic size={17} />练习库 <b>{phrases.length}</b>
        </button>
        <button className={view === 'history' ? 'side-link active' : 'side-link'} onClick={() => setView('history')}>
          <History size={17} />历史区 <b>{archives.length}</b>
        </button>
        <button className="side-link"><Clock3 size={17} />练习记录</button>
        <button className="side-link"><Check size={17} />已掌握 <b>{phrases.filter((p) => p.status === 'mastered').length}</b></button>
      </nav>
      <div className="sidebar-foot">
        <div className="streak"><span>连续练习</span><strong>5 <small>天</small></strong><i>↗ +2</i></div>
        <div className="profile"><div className="avatar">YL</div><div><strong>Yuki Lin</strong><span>普通计划</span></div><ChevronRight size={16} /></div>
      </div>
    </aside>

    <main className="main">
      {view === 'history' ? (
        <HistoryView archives={archives} onRestore={restoreArchived} onDelete={deleteArchived} />
      ) : (
        <>
          <header className="topbar">
            <div><p className="eyebrow">FRIDAY, SEP 26</p><h1>今天练什么？</h1></div>
            <div className="top-actions">
              <div className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索句子" /></div>
              <button className="secondary" onClick={() => setShowImport(true)}><Upload size={15} />导入课程包</button>
              <button className="primary" onClick={() => setShowAdd(true)}><Plus size={17} />添加句子</button>
            </div>
          </header>
          <section className="stats">
            <div><span>本周完成</span><strong>12 <em>/ 20</em></strong><div className="progress"><i style={{ width: '60%' }} /></div></div>
            <div><span>练习时长</span><strong>38 <em>分钟</em></strong><small>比上周多 8 分钟</small></div>
            <div><span>最佳发音</span><strong>92 <em>分</em></strong><small className="green">↑ 6 分</small></div>
          </section>
          <div className="content-grid">
            <section className="library">
              <div className="section-head">
                <div><h2>句子库</h2><p>选择一句开始你的声音训练</p></div>
                <button className="ghost" onClick={() => setFilter('待练')}>只看待练</button>
              </div>
              <div className="filters">{tags.map((t) => <button key={t} className={filter === t ? 'chip active' : 'chip'} onClick={() => setFilter(t)}>{t}</button>)}</div>
              <div className="phrase-list">
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => { setSelected(p.id); setRecorded(false); }} className={p.id === selected ? 'phrase selected' : 'phrase'}>
                    <div className="phrase-icon">{p.status === 'mastered' ? <Check size={15} /> : <Mic size={15} />}</div>
                    <div className="phrase-copy">
                      <strong>{p.text}</strong>
                      <span>{p.translation}</span>
                      <div className="phrase-meta">
                        <i>{p.tag}</i><i>{p.level}</i>
                        {p.attempts > 0 && <small>{p.attempts} 次练习</small>}
                        {p.recording?.durationSec ? <small className="has-rec">· 有录音</small> : null}
                      </div>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
                {filtered.length === 0 && <div className="empty">没有找到匹配句子</div>}
              </div>
            </section>
            {current && <section className="practice">
              <div className="practice-head">
                <div><span className="label">CURRENT PHRASE</span><h2>跟着感觉读</h2></div>
                <button className="icon-btn" onClick={removePhrase} title="移入历史区"><Trash2 size={17} /></button>
              </div>
              <div className="focus-card">
                <div className="focus-tag">{current.tag} · {current.level}</div>
                <p className="focus-text">{current.text}</p>
                <p className="focus-translation">{current.translation}</p>
                <div className="audio-sample">
                  <button className="round-btn" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
                  <div className="sample-wave">{bars.map((h, i) => <i key={i} style={{ height: `${h * (playing ? 1.15 : 0.72)}%` }} />)}</div>
                  <span>0:08</span>
                </div>
              </div>
              <div className="record-card">
                <div className="record-top">
                  <div>
                    <span className="label">YOUR RECORDING</span>
                    <h3>{recording ? '正在录音…' : recorded || current.recording ? '录音已保存，听听自己的声音' : '准备好后开始录音'}</h3>
                  </div>
                  <span className="record-time">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
                </div>
                <div className="record-wave">{bars.slice(5, 58).map((h, i) => <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? 0.4 + ((i % 5) / 7) : 0.4)}%` }} />)}</div>
                <div className="record-actions">
                  <button className={recording ? 'record-button recording' : 'record-button'} onClick={startRecord}>
                    <span>{recording ? <Pause size={16} /> : <Mic size={16} />}</span>
                    {recording ? '结束录音' : recorded || current.recording ? '重新录音' : '开始录音'}
                  </button>
                  {(recorded || current.recording) && <button className="secondary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />} 回放</button>}
                  {current.status === 'mastered' && <span className="mastered-tag"><Check size={13} /> 已掌握</span>}
                </div>
              </div>
              <div className="tip"><span>练习小贴士</span><p>放慢速度，先把每个音节读清楚，再自然地连起来。</p><RotateCcw size={15} /></div>
            </section>}
          </div>
        </>
      )}
    </main>

    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>添加练习句子</h2><button className="icon-btn" onClick={() => setShowAdd(false)}>×</button></div>
        <label>英文句子<textarea autoFocus value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="例如：I can make this happen." /></label>
        <div className="modal-actions"><button className="secondary" onClick={() => setShowAdd(false)}>取消</button><button className="primary" onClick={addPhrase}>加入句子库</button></div>
      </div>
    </div>}

    {showImport && <ImportDialog phrases={phrases} onClose={() => setShowImport(false)} onApply={handleImport} />}

    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </div>;
}
