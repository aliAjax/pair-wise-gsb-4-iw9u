import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Clock3, Download, Mic, Pause, Play, Plus, RotateCcw, Search, Trash2, Volume2 } from 'lucide-react';
import type { CourseState, Phrase } from './course/types';
import { loadState, newRecording, saveState } from './course/storage';
import { formatDuration, formatRelative } from './course/time';
import ImportWizard from './components/ImportWizard';
import HistoryView from './components/HistoryView';

const bars = Array.from({ length: 68 }, (_, i) => 18 + ((i * 29) % 44));

type View = 'practice' | 'history';

export default function App() {
  const [state, setState] = useState<CourseState>(loadState);
  const [view, setView] = useState<View>('practice');
  const [selected, setSelected] = useState(state.phrases[0]?.id ?? 0);
  const [filter, setFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newText, setNewText] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const phrases = state.phrases;
  const current = phrases.find(p => p.id === selected) ?? phrases[0];

  const filtered = useMemo(() => phrases.filter(p =>
    (filter === '全部'
      || p.tag === filter
      || p.level === filter
      || (filter === '待练' && p.status !== 'mastered')
      || (filter === '已掌握' && p.status === 'mastered'))
    && p.text.toLowerCase().includes(query.toLowerCase()),
  ), [phrases, filter, query]);
  const tags = ['全部', ...Array.from(new Set(phrases.map(p => p.tag)))];

  useEffect(() => saveState(state), [state]);
  useEffect(() => () => window.clearInterval(timer.current), []);

  const patchPhrase = (id: number, fn: (p: Phrase) => Phrase) =>
    setState(s => ({ ...s, phrases: s.phrases.map(p => (p.id === id ? fn(p) : p)) }));

  // 模拟录音：开始/再次点击结束，录音元信息按句子保存，进度状态随句子走
  const startRecord = () => {
    if (!current) return;
    if (recording) {
      setRecording(false);
      window.clearInterval(timer.current);
      setRecorded(true);
      const duration = Math.max(1, seconds);
      patchPhrase(current.id, p => ({
        ...p,
        attempts: p.attempts + 1,
        status: 'practice',
        last: new Date().toISOString(),
        recordings: [...p.recordings, newRecording(duration)],
      }));
      return;
    }
    setSeconds(0);
    setRecorded(false);
    setPlaying(false);
    setRecording(true);
    timer.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const toggleMastered = () => { if (current) patchPhrase(current.id, p => ({ ...p, status: p.status === 'mastered' ? 'practice' : 'mastered', last: new Date().toISOString() })); };

  const addPhrase = () => {
    if (!newText.trim()) return;
    const id = (phrases.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
    const phrase: Phrase = { id, text: newText.trim(), translation: '待补充译文', tag: '自定义', level: '入门', status: 'new', attempts: 0, recordings: [] };
    setState(s => ({ ...s, phrases: [...s.phrases, phrase] }));
    setSelected(id);
    setNewText('');
    setShowAdd(false);
  };

  const removePhrase = () => {
    if (!current) return;
    setState(s => ({ ...s, phrases: s.phrases.filter(p => p.id !== current.id) }));
    setSelected(phrases.find(p => p.id !== current.id)?.id ?? 0);
  };

  const restoreFromArchive = (item: (typeof state.archive)[number]) => {
    setState(s => ({
      ...s,
      phrases: [...s.phrases, { ...item, status: 'practice' }],
      archive: s.archive.filter(a => a.id !== item.id),
    }));
  };

  const deleteForever = (item: (typeof state.archive)[number]) =>
    setState(s => ({ ...s, archive: s.archive.filter(a => a.id !== item.id) }));

  const successorText = (id: number) => phrases.find(p => p.id === id);

  const totalAttempts = phrases.reduce((n, p) => n + p.attempts, 0);
  const masteredCount = phrases.filter(p => p.status === 'mastered').length;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Volume2 size={19} /></div><div><strong>声线练习室</strong><span>Pronounce / practice</span></div></div>
      <div className="side-label">我的练习</div>
      <nav>
        <button className={view === 'practice' ? 'side-link active' : 'side-link'} onClick={() => setView('practice')}>
          <Mic size={17} />练习库 <b>{phrases.length}</b>
        </button>
        <button className={view === 'history' ? 'side-link active' : 'side-link'} onClick={() => setView('history')}>
          <Clock3 size={17} />历史区 <b>{state.archive.length}</b>
        </button>
        <button className="side-link" onClick={() => { setFilter('已掌握'); setView('practice'); }}>
          <Check size={17} />已掌握 <b>{masteredCount}</b>
        </button>
      </nav>
      <div className="sidebar-foot">
        <div className="streak">
          <span>连续练习</span><strong>5 <small>天</small></strong><i>↗ +2</i>
        </div>
        <div className="profile">
          <div className="avatar">YL</div>
          <div><strong>Yuki Lin</strong><span>本地数据 · 不上传</span></div>
          <ChevronRight size={16} />
        </div>
      </div>
    </aside>

    <main className="main">
      {view === 'history' ? (
        <HistoryView archive={state.archive} successorText={successorText}
          onRestore={restoreFromArchive} onDeleteForever={deleteForever} onClose={() => setView('practice')} />
      ) : <>
        <header className="topbar">
          <div>
            <p className="eyebrow">WEDNESDAY, SEP 25</p>
            <h1>今天练什么？</h1>
            <p className="course-line">{state.courseName} · v{state.version} · 导入于 {formatRelative(state.importedAt)}</p>
          </div>
          <div className="top-actions">
            <div className="search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索句子" /></div>
            <button className="secondary" onClick={() => setShowImport(true)}><Download size={15} />导入新课程包</button>
            <button className="primary" onClick={() => setShowAdd(true)}><Plus size={17} />添加句子</button>
          </div>
        </header>

        <section className="stats">
          <div><span>练习句总数</span><strong>{phrases.length} <em>句</em></strong><div className="progress"><i style={{ width: `${phrases.length ? (masteredCount / phrases.length) * 100 : 0}%` }} /></div></div>
          <div><span>累计跟读</span><strong>{totalAttempts} <em>次</em></strong><small>录音按句子保存在本设备</small></div>
          <div><span>已掌握</span><strong>{masteredCount} <em>句</em></strong><small className="green">历史区 {state.archive.length} 句旧稿</small></div>
        </section>

        <div className="content-grid">
          <section className="library">
            <div className="section-head">
              <div><h2>句子库</h2><p>选择一句开始你的声音训练</p></div>
              <button className="ghost" onClick={() => setFilter(filter === '待练' ? '全部' : '待练')}>只看待练</button>
            </div>
            <div className="filters">{tags.map(t => <button key={t} className={filter === t ? 'chip active' : 'chip'} onClick={() => setFilter(t)}>{t}</button>)}</div>
            <div className="phrase-list">
              {filtered.map(p => <button key={p.id} onClick={() => { setSelected(p.id); setRecorded(false); setPlaying(false); }} className={p.id === selected ? 'phrase selected' : 'phrase'}>
                <div className="phrase-icon">{p.status === 'mastered' ? <Check size={15} /> : <Mic size={15} />}</div>
                <div className="phrase-copy">
                  <strong>{p.text}</strong>
                  <span>{p.translation}</span>
                  <div className="phrase-meta">
                    <i>{p.tag}</i><i>{p.level}</i>
                    {p.attempts > 0 && <small>{p.attempts} 次练习</small>}
                    {p.recordings.length > 0 && <small><Mic size={10} /> {p.recordings.length}</small>}
                    {p.last && <small className="last-time">{formatRelative(p.last)}</small>}
                  </div>
                </div>
                <ChevronRight size={17} />
              </button>)}
              {filtered.length === 0 && <div className="empty">没有找到匹配句子</div>}
            </div>
          </section>

          {current && <section className="practice">
            <div className="practice-head">
              <div><span className="label">CURRENT PHRASE</span><h2>跟着感觉读</h2></div>
              <div className="practice-tools">
                <button className={`master-btn ${current.status === 'mastered' ? 'on' : ''}`} onClick={toggleMastered}
                  title="切换掌握状态">{current.status === 'mastered' ? <><Check size={14} /> 已掌握</> : '标记掌握'}</button>
                <button className="icon-btn" onClick={removePhrase} title="删除句子"><Trash2 size={17} /></button>
              </div>
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
                <div><span className="label">YOUR RECORDING</span>
                  <h3>{recording ? '正在录音…' : recorded ? '录音已保存，听听自己的声音' : '准备好后开始录音'}</h3></div>
                <span className="record-time">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
              </div>
              <div className="record-wave">{bars.slice(5, 58).map((h, i) => <i key={i} className={recording ? 'live' : ''} style={{ height: `${h * (recording ? (0.4 + ((i % 5) / 7)) : 0.4)}%` }} />)}</div>
              <div className="record-actions">
                <button className={recording ? 'record-button recording' : 'record-button'} onClick={startRecord}>
                  <span>{recording ? <Pause size={16} /> : <Mic size={16} />}</span>{recording ? '结束录音' : recorded ? '重新录音' : '开始录音'}
                </button>
                {recorded && <button className="secondary" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />} 回放</button>}
                <span className="record-count">{current.attempts} 次跟读 · {current.recordings.length} 条录音</span>
              </div>
            </div>

            {current.recordings.length > 0 && <div className="rec-history">
              <div className="rec-history-head"><span className="label">SAVED ON THIS DEVICE</span><b>{current.recordings.length} 条</b></div>
              {current.recordings.slice(-4).reverse().map(r => (
                <div key={r.id} className="rec-row">
                  <Play size={12} /><span>{formatRelative(r.at)}</span><i>{formatDuration(r.durationSec)}</i>
                </div>
              ))}
            </div>}

            <div className="tip"><span>练习小贴士</span><p>放慢速度，先把每个音节读清楚，再自然地连起来。录音和进度都只存在这台设备上。</p><RotateCcw size={15} /></div>
          </section>}
        </div>
      </>}
    </main>

    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>添加练习句子</h2><button className="icon-btn" onClick={() => setShowAdd(false)}>×</button></div>
        <label>英文句子<textarea autoFocus value={newText} onChange={e => setNewText(e.target.value)} placeholder="例如：I can make this happen." /></label>
        <div className="modal-actions"><button className="secondary" onClick={() => setShowAdd(false)}>取消</button><button className="primary" onClick={addPhrase}>加入句子库</button></div>
      </div>
    </div>}

    {showImport && <ImportWizard state={state} onClose={() => setShowImport(false)} onConfirm={(next) => {
      setState(next);
      setShowImport(false);
      setView('practice');
      setFilter('全部');
      setSelected(next.phrases[0]?.id ?? 0);
    }} />}
  </div>;
}
