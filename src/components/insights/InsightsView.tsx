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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Provenance & Privacy Disclosure Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        background: '#ecfdf5',
        border: '1.5px solid #a7f3d0',
        borderRadius: '14px',
        padding: '10px 18px',
        fontSize: '0.8rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="var(--accent-emerald)" />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            Processing Pipeline:
          </span>
          <span className="badge badge-emerald" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
            {insights.isDemonstrationData ? 'Simulated Offline Model' : 'Client-Side Transformers'}
          </span>
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          {insights.processingDurationMs ? `Latency: ${insights.processingDurationMs}ms` : '100% Local Execution'}
        </span>
      </div>

      {/* 1. Executive Summary Card */}
      <div className="white-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={20} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.15rem' }}>Executive Summary</h3>
        </div>
        <p style={{ fontSize: '0.94rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
          {insights.executiveSummary}
        </p>
      </div>

      {/* 2. Important Topics */}
      <div className="white-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Tag size={18} color="var(--accent-forest)" />
          <h3 style={{ fontSize: '1.15rem' }}>Key Discussion Topics</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {insights.importantTopics.map((topic, idx) => (
            <span
              key={idx}
              className="badge badge-emerald"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                textTransform: 'none',
              }}
            >
              #{topic}
            </span>
          ))}
        </div>
      </div>

      {/* 3. Key Concepts & Terminology */}
      {insights.keyConcepts && insights.keyConcepts.length > 0 && (
        <div className="white-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BookOpen size={18} color="var(--accent-forest)" />
            <h3 style={{ fontSize: '1.15rem' }}>Key Concepts & Definitions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {insights.keyConcepts.map((concept, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8faf9',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--accent-forest)', marginBottom: 4 }}>
                  {concept.term}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {concept.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Things to Remember */}
      <div className="white-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <BookmarkCheck size={18} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.15rem' }}>Things to Remember</h3>
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 22 }}>
          {insights.thingsToRemember.map((item, idx) => (
            <li key={idx} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{item}</strong>
            </li>
          ))}
        </ul>
      </div>

      {/* 5. Action Items (Interactive Tasks) */}
      <div className="white-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} color="var(--accent-emerald)" />
            <h3 style={{ fontSize: '1.15rem' }}>Action Items & Follow-ups</h3>
            <span className="badge badge-emerald" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              {insights.actionItems.filter((a) => a.completed).length} / {insights.actionItems.length}
            </span>
          </div>

          <button
            onClick={copyActionItems}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            title="Copy tasks to clipboard"
          >
            {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Tasks'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.actionItems.map((item: ActionItem) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                background: item.completed ? '#f0fdf4' : '#ffffff',
                border: `1.5px solid ${item.completed ? '#a7f3d0' : 'var(--border-subtle)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <div 
                onClick={() => onToggleActionItem && onToggleActionItem(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
              >
                {item.completed ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" />
                ) : (
                  <Circle size={18} color="#94a3b8" />
                )}
                <div>
                  <span style={{
                    fontSize: '0.88rem',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: item.completed ? 500 : 600,
                  }}>
                    {item.description}
                  </span>
                  {item.assignedTo && (
                    <span style={{ marginLeft: 8, fontSize: '0.74rem', color: 'var(--accent-forest)', fontWeight: 700 }}>
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
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-forest)',
                    fontWeight: 700,
                  }}
                >
                  <Clock size={12} /> {formatTimestamp(item.sourceTimestampMs)}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Study Questions & Flashcards */}
      {insights.studyQuestions && insights.studyQuestions.length > 0 && (
        <div className="white-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HelpCircle size={18} color="var(--accent-emerald)" />
            <h3 style={{ fontSize: '1.15rem' }}>Study Review Questions</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.studyQuestions.map((q) => {
              const isExpanded = !!expandedQuestions[q.id];

              return (
                <div
                  key={q.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    background: '#f8faf9',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => toggleQuestion(q.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {q.question}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isExpanded && (
                    <div style={{
                      padding: '0 16px 14px',
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 10,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-forest)', marginBottom: 4, fontSize: '0.78rem' }}>
                        SUMMARY ANSWER:
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
