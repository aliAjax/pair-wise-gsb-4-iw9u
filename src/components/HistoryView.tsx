import { Check, History, Mic, PencilLine, RotateCcw, Trash2, X } from 'lucide-react';
import type { ArchivedPhrase, Phrase } from '../course/types';
import { formatDuration, formatRelative } from '../course/time';

interface Props {
  archive: ArchivedPhrase[];
  /** 若改写归档的句子有对应的新练习项，传入供展示 */
  successorText: (id: number) => Phrase | undefined;
  onRestore: (item: ArchivedPhrase) => void;
  onDeleteForever: (item: ArchivedPhrase) => void;
  onClose: () => void;
}

// 历史区：被移走的旧句、改写后留下的旧稿都在这里，录音随稿保留，可恢复回练习库。
export default function HistoryView({ archive, successorText, onRestore, onDeleteForever, onClose }: Props) {
  return <div className="history-view">
    <div className="history-head">
      <div>
        <p className="eyebrow">PHRASE HISTORY</p>
        <h1><History size={24} /> 历史区 <b>{archive.length}</b></h1>
        <p>新版课程中被移走的句子、改过字后留下的旧稿都收在这里；录音和练习次数随旧稿保留，可随时恢复回练习库。</p>
      </div>
      <button className="secondary" onClick={onClose}><X size={15} /> 返回练习库</button>
    </div>

    {archive.length === 0 && <div className="empty history-empty">历史区还是空的——导入新课程后，被换掉的句子会收在这里。</div>}

    <div className="archive-list">
      {archive.map(item => {
        const successor = item.successorId !== undefined ? successorText(item.successorId) : undefined;
        return <article key={item.id} className="archive-card">
          <div className="archive-top">
            <span className={`archive-reason ${item.reason}`}>
              {item.reason === 'removed' ? <><X size={12} /> 新版移走</> : <><PencilLine size={12} /> 改写旧稿</>}
            </span>
            <span className="archive-date">收存于 {formatRelative(item.archivedAt)}</span>
          </div>
          <h2>{item.text}</h2>
          <p className="archive-translation">{item.translation}</p>
          <div className="phrase-meta">
            <i>{item.tag}</i><i>{item.level}</i>
            {item.status === 'mastered'
              ? <small className="status-mastered"><Check size={11} /> 已掌握</small>
              : <small>{item.attempts} 次跟读</small>}
            {item.recordings.length > 0 && <small><Mic size={11} /> {item.recordings.length} 条录音</small>}
          </div>
          {item.recordings.length > 0 && <div className="archive-recs">
            {item.recordings.map(r => <span key={r.id} className="rec-chip">
              <Mic size={11} /> {formatDuration(r.durationSec)} · {formatRelative(r.at)}
            </span>)}
          </div>}
          {item.reason === 'rewritten' && (successor
            ? <p className="archive-successor">已由新练习项接管：<b>{successor.text}</b></p>
            : <p className="archive-successor muted">对应的新练习项未在当前课程中</p>)}
          <div className="archive-actions">
            <button className="secondary" onClick={() => onRestore(item)}><RotateCcw size={14} /> 恢复回练习库</button>
            <button className="icon-btn danger" title="彻底删除" onClick={() => onDeleteForever(item)}><Trash2 size={15} /></button>
          </div>
        </article>;
      })}
    </div>
  </div>;
}
