import { Archive, History, Mic, Play, RotateCcw, Trash2 } from 'lucide-react';
import { formatDuration, hasRecording, statusLabel } from '../lib/takeover';
import type { ArchivedPhrase } from '../lib/takeover';

interface HistoryViewProps {
  archives: ArchivedPhrase[];
  onRestore: (archived: ArchivedPhrase) => void;
  onDelete: (id: string) => void;
}

const reasonLabel: Record<ArchivedPhrase['archiveReason'], { text: string; cls: string }> = {
  edit: { text: '改字旧稿', cls: 'edit' },
  removed: { text: '被移走', cls: 'arch' },
  manual: { text: '手动归档', cls: 'arch' },
  split: { text: '留存稿（新旧并存）', cls: 'split' },
};

export default function HistoryView({ archives, onRestore, onDelete }: HistoryViewProps) {
  return (
    <section className="history-view">
      <div className="history-head">
        <div>
          <span className="label">HISTORY ARCHIVE</span>
          <h2>历史区</h2>
          <p>改字前的旧稿和被移走的句子都保存在这里，录音与掌握状态不会丢；恢复后可重新回到练习库。</p>
        </div>
        <span className="history-count"><History size={15} /> {archives.length} 份存档</span>
      </div>

      {archives.length === 0 ? (
        <div className="empty history-empty">
          <Archive size={22} />
          <p>历史区还是空的。导入新课程时，改过字的旧稿和被移走的句子会自动收进这里。</p>
        </div>
      ) : (
        <div className="history-list">
          {archives.map((a) => {
            const reason = reasonLabel[a.archiveReason];
            return (
              <div key={a.id} className="history-card">
                <div className="history-main">
                  <div className="history-tags">
                    <span className={`imp-badge ${reason.cls}`}>{reason.text}</span>
                    {hasRecording(a) && (
                      <span className="imp-data"><Mic size={11} />录音 {formatDuration(a.recording?.durationSec)}</span>
                    )}
                    <span className="imp-data">{statusLabel(a.status)}</span>
                    <span className="imp-data">{a.attempts} 次练习</span>
                    {a.preserved && <span className="imp-data">已留存</span>}
                  </div>
                  <p className="history-text">{a.text}</p>
                  <p className="history-trans">{a.translation}</p>
                  <div className="history-foot">
            <span>{a.tag} · {a.level}</span>
            <span>归档于 {a.archivedAt}{a.recording?.recordedAt ? ` · 最后录音 ${a.recording.recordedAt}` : ''}</span>
          </div>
                </div>
                <div className="history-actions">
                  {hasRecording(a) && (
                    <button className="icon-btn" title="回放旧录音" onClick={() => undefined}>
                      <Play size={16} />
                    </button>
                  )}
                  <button className="icon-btn" title="恢复到练习库" onClick={() => onRestore(a)}>
                    <RotateCcw size={15} />
                  </button>
                  <button className="icon-btn danger" title="彻底删除（不可恢复）" onClick={() => onDelete(a.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
