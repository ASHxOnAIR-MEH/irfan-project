import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Copy, 
  Check, 
  Clock, 
  ExternalLink, 
  CheckSquare, 
  Filter,
  Sparkles
} from 'lucide-react';
import { RecordingSession, ActionItem } from '../../types/session';

interface GlobalActionItemsViewProps {
  sessions: RecordingSession[];
  onToggleActionItem: (sessionId: string, actionId: string) => void;
  onOpenSession: (session: RecordingSession, seekMs?: number) => void;
}

export const GlobalActionItemsView: React.FC<GlobalActionItemsViewProps> = ({
  sessions,
  onToggleActionItem,
  onOpenSession,
}) => {
  const [copied, setCopied] = useState(false);
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'completed'>('all');

  // Collate all action items with parent session context
  const allTasks: Array<{ session: RecordingSession; item: ActionItem }> = [];
  sessions.forEach((s) => {
    if (s.insights && s.insights.actionItems) {
      s.insights.actionItems.forEach((item) => {
        allTasks.push({ session: s, item });
      });
    }
  });

  const filteredTasks = allTasks.filter((t) => {
    if (filterState === 'pending') return !t.item.completed;
    if (filterState === 'completed') return t.item.completed;
    return true;
  });

  const copyTasks = () => {
    const text = filteredTasks
      .map((t) => `[${t.item.completed ? 'x' : ' '}] ${t.item.description} (Session: "${t.session.title}")`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completedCount = allTasks.filter((t) => t.item.completed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Card */}
      <div className="glass-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CheckSquare size={20} color="var(--accent-emerald)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Extracted Action Items</h2>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Consolidated actionable tasks and deliverables extracted by AI across all voice memos.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={copyTasks}
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.8rem' }}
            >
              {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Export to Markdown'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setFilterState('all')}
            className={`badge ${filterState === 'all' ? 'badge-cyan' : 'badge-secondary'}`}
            style={{ cursor: 'pointer', padding: '6px 14px' }}
          >
            All Tasks ({allTasks.length})
          </button>
          <button
            onClick={() => setFilterState('pending')}
            className={`badge ${filterState === 'pending' ? 'badge-amber' : 'badge-secondary'}`}
            style={{ cursor: 'pointer', padding: '6px 14px' }}
          >
            Pending ({allTasks.length - completedCount})
          </button>
          <button
            onClick={() => setFilterState('completed')}
            className={`badge ${filterState === 'completed' ? 'badge-emerald' : 'badge-secondary'}`}
            style={{ cursor: 'pointer', padding: '6px 14px' }}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredTasks.map(({ session, item }) => (
          <div
            key={`${session.id}_${item.id}`}
            className="glass-card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: item.completed ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-card)',
              borderColor: item.completed ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)',
            }}
          >
            <div 
              onClick={() => onToggleActionItem(session.id, item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
            >
              {item.completed ? (
                <CheckCircle2 size={20} color="var(--accent-emerald)" />
              ) : (
                <Circle size={20} color="var(--text-muted)" />
              )}

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textDecoration: item.completed ? 'line-through' : 'none',
                  color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                  marginBottom: 2,
                }}>
                  {item.description}
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>From: <strong>{session.title}</strong></span>
                  {item.assignedTo && (
                    <span style={{ color: 'var(--accent-cyan)' }}>@{item.assignedTo}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Jump to audio timestamp */}
            <button
              onClick={() => onOpenSession(session, item.sourceTimestampMs)}
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.74rem', flexShrink: 0 }}
              title="Open session and jump to audio location"
            >
              <Clock size={13} color="var(--accent-cyan)" />
              <span>Listen</span>
            </button>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <CheckSquare size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ marginBottom: 6 }}>No tasks in this filter</h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Record a session or sync from the pendant to extract action items automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
