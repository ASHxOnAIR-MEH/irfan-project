import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Copy, 
  Check, 
  Clock, 
  CheckSquare,
  ArrowRight
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
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'completed'>('all');
  const [copied, setCopied] = useState(false);

  // Collate all action items with their parent session metadata
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980, margin: '0 auto', width: '100%' }}>
      {/* Header Card */}
      <div className="white-card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CheckSquare size={22} color="var(--accent-forest)" />
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>Extracted Action Items</h2>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Consolidated actionable tasks and deliverables extracted by AI across all voice memos.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={copyTasks}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Export to Markdown'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={() => setFilterState('all')}
            className={`badge ${filterState === 'all' ? 'badge-forest' : 'badge-secondary'}`}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredTasks.map(({ session, item }) => (
          <div
            key={item.id}
            className="white-card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: item.completed ? '#f0fdf4' : '#ffffff',
              border: `1.5px solid ${item.completed ? '#a7f3d0' : 'var(--border-card)'}`,
            }}
          >
            {/* Left: Checkbox & Description */}
            <div 
              onClick={() => onToggleActionItem(session.id, item.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', flex: 1 }}
            >
              <div style={{ paddingTop: 2 }}>
                {item.completed ? (
                  <CheckCircle2 size={20} color="var(--accent-emerald)" />
                ) : (
                  <Circle size={20} color="#94a3b8" />
                )}
              </div>

              <div>
                <div style={{
                  fontSize: '0.94rem',
                  fontWeight: item.completed ? 500 : 700,
                  textDecoration: item.completed ? 'line-through' : 'none',
                  color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                  lineHeight: 1.5,
                }}>
                  {item.description}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span>Source: <strong>{session.title}</strong></span>
                  {item.assignedTo && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--accent-forest)', fontWeight: 700 }}>@{item.assignedTo}</span>
                    </>
                  )}
                  {item.dueSuggestion && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--accent-amber)' }}>Due: {item.dueSuggestion}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Seek button & Session Jump */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.sourceTimestampMs !== undefined && (
                <button
                  onClick={() => onOpenSession(session, item.sourceTimestampMs)}
                  className="btn btn-secondary"
                  title="Jump directly to spoken timestamp in audio"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.74rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-forest)',
                    fontWeight: 700,
                  }}
                >
                  <Clock size={12} /> Jump to Audio
                </button>
              )}

              <button
                onClick={() => onOpenSession(session)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px' }}
                title="Open parent session details"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="white-card" style={{ padding: 48, textAlign: 'center' }}>
            <CheckSquare size={38} color="var(--accent-forest)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1.15rem', marginBottom: 4 }}>No action items found</h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {filterState === 'completed'
                ? 'No completed tasks yet. Check off items as you finish them.'
                : 'All tasks completed or none extracted yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
