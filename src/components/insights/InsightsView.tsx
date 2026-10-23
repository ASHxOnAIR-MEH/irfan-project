import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  BookmarkCheck, 
  BookOpen, 
  Copy, 
  Check, 
  Clock, 
  HelpCircle,
  Tag,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AIAnalysis, ActionItem } from '../../types/session';

interface InsightsViewProps {
  insights: AIAnalysis;
  onSeekToMs?: (ms: number) => void;
  onToggleActionItem?: (actionId: string) => void;
}

function formatTimestamp(ms?: number): string {
  if (ms === undefined) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  insights,
  onSeekToMs,
  onToggleActionItem,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyActionItems = () => {
    const text = insights.actionItems
      .map((item) => `[${item.completed ? 'x' : ' '}] ${item.description}${item.assignedTo ? ` (@${item.assignedTo})` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Provenance & Privacy Disclosure Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: '0.76rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} color="var(--accent-emerald)" />
          <span style={{ color: 'var(--text-secondary)' }}>
            Processing Location:
          </span>
          <span className="badge badge-cyan" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
            {insights.isDemonstrationData ? 'Simulated Offline Model' : 'Client-Side Transformer'}
          </span>
        </div>

        <span style={{ color: 'var(--text-muted)' }}>
          {insights.processingDurationMs ? `Latency: ${insights.processingDurationMs}ms` : 'Local Execution'}
        </span>
      </div>

      {/* 1. Executive Summary */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem' }}>Executive Summary</h3>
        </div>
        <p style={{ fontSize: '0.92rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>
          {insights.executiveSummary}
        </p>
      </div>

      {/* 2. Important Topics */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Tag size={18} color="var(--accent-purple)" />
          <h3 style={{ fontSize: '1.05rem' }}>Important Topics</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {insights.importantTopics.map((topic, idx) => (
            <span
              key={idx}
              className="badge"
              style={{
                background: 'rgba(139, 92, 246, 0.14)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                color: '#c4b5fd',
                fontSize: '0.8rem',
                padding: '6px 12px',
                textTransform: 'none',
              }}
            >
              #{topic}
            </span>
          ))}
        </div>
      </div>

      {/* 3. Key Concepts */}
      {insights.keyConcepts && insights.keyConcepts.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BookOpen size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.05rem' }}>Key Concepts & Terminology</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {insights.keyConcepts.map((concept, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-cyan)', marginBottom: 4 }}>
                  {concept.term}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {concept.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Things to Remember */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BookmarkCheck size={18} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.05rem' }}>Things to Remember</h3>
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 20 }}>
          {insights.thingsToRemember.map((item, idx) => (
            <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-primary)' }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 5. Action Items (Interactive Tasks) */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} color="var(--accent-emerald)" />
            <h3 style={{ fontSize: '1.05rem' }}>Action Items</h3>
            <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
              {insights.actionItems.filter((a) => a.completed).length} / {insights.actionItems.length}
            </span>
          </div>

          <button
            onClick={copyActionItems}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
            title="Copy tasks to clipboard"
          >
            {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Tasks'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.actionItems.map((item: ActionItem) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: item.completed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${item.completed ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-subtle)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <div 
                onClick={() => onToggleActionItem && onToggleActionItem(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}
              >
                {item.completed ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" />
                ) : (
                  <Circle size={18} color="var(--text-muted)" />
                )}
                <div>
                  <span style={{
                    fontSize: '0.86rem',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {item.description}
                  </span>
                  {item.assignedTo && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
                      @{item.assignedTo}
                    </span>
                  )}
                </div>
              </div>

              {item.sourceTimestampMs !== undefined && onSeekToMs && (
                <button
                  onClick={() => onSeekToMs(item.sourceTimestampMs!)}
                  className="btn btn-secondary"
                  title="Jump audio to when this was spoken"
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  <Clock size={11} /> {formatTimestamp(item.sourceTimestampMs)}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Study Questions & Flashcards */}
      {insights.studyQuestions && insights.studyQuestions.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <HelpCircle size={18} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.05rem' }}>Study Questions & Memory Retention</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.studyQuestions.map((q) => {
              const isOpen = !!expandedQuestions[q.id];
              return (
                <div
                  key={q.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{q.question}</span>
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </button>

                  {isOpen && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      lineHeight: 1.55,
                      color: 'var(--text-secondary)',
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 4 }}>
                        Key Answer:
                      </div>
                      {q.answerSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
