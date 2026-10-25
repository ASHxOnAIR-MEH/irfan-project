import React, { useState, useMemo } from 'react';
import { 
  Brain, 
  Sparkles, 
  Tag, 
  ChevronRight, 
  HelpCircle, 
  CheckSquare, 
  Search,
  Filter
} from 'lucide-react';
import { RecordingSession } from '../../types/session';

interface GlobalInsightsViewProps {
  sessions: RecordingSession[];
  onSelectSession: (session: RecordingSession) => void;
}

export const GlobalInsightsView: React.FC<GlobalInsightsViewProps> = ({
  sessions,
  onSelectSession,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all unique topics with session counts
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      s.insights.importantTopics.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  // Aggregate stats across all memories
  const totalActionItems = useMemo(() => {
    return sessions.reduce((acc, s) => acc + s.insights.actionItems.length, 0);
  }, [sessions]);

  const completedActionItems = useMemo(() => {
    return sessions.reduce((acc, s) => {
      return acc + s.insights.actionItems.filter((a) => a.completed).length;
    }, 0);
  }, [sessions]);

  const totalStudyQuestions = useMemo(() => {
    return sessions.reduce((acc, s) => acc + s.insights.studyQuestions.length, 0);
  }, [sessions]);

  // Filter sessions based on topic and search query
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesTopic = !selectedTopic || s.insights.importantTopics.includes(selectedTopic);
      const matchesSearch = !searchQuery || 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.insights.executiveSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.insights.importantTopics.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTopic && matchesSearch;
    });
  }, [sessions, selectedTopic, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Hero / Synthesis Panel (Dark Forest Section from Reference) */}
      <div 
        className="dark-panel"
        style={{
          padding: '36px 32px',
          background: 'linear-gradient(135deg, #05291e 0%, #083829 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Brain size={20} color="#34d399" />
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Knowledge Graph & Synthesis
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 800, marginBottom: 12, color: '#ffffff' }}>
          Memory Synthesis & Topic Map
        </h1>

        <p style={{ fontSize: '0.95rem', color: '#d1fae5', maxWidth: 720, lineHeight: 1.6, marginBottom: 24 }}>
          Conceptual relationships, recurring themes, and actionable outcomes distilled locally from your ambient voice recordings.
        </p>

        {/* Aggregate Insight Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          paddingTop: 24,
        }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>
              {topicCounts.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', fontWeight: 600 }}>
              Distinct Topics Identified
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
              {completedActionItems} / {totalActionItems}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', fontWeight: 600 }}>
              Action Items Resolved
            </div>
          </div>

          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>
              {totalStudyQuestions}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', fontWeight: 600 }}>
              Synthesized Review Prompts
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div 
        className="white-card"
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Bar */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: 260,
          }}>
            <Search 
              size={17} 
              color="var(--text-muted)" 
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} 
            />
            <input 
              type="text"
              placeholder="Search concepts, topics, or key phrases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: 'var(--radius-full)',
                border: '1.5px solid #d7ede1',
                background: '#f2faf5',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {selectedTopic && (
            <button
              onClick={() => setSelectedTopic(null)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              Clear Topic Filter (#{selectedTopic})
            </button>
          )}
        </div>

        {/* Topic Pills */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            <Filter size={14} />
            <span>TOPIC TAGS:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setSelectedTopic(null)}
              className={`floating-chip ${!selectedTopic ? 'dark' : ''}`}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              All Topics ({sessions.length})
            </button>
            {topicCounts.map(([topic, count]) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                className={`floating-chip ${selectedTopic === topic ? 'dark' : ''}`}
                style={{ cursor: 'pointer', border: 'none' }}
              >
                <Tag size={12} color={selectedTopic === topic ? '#34d399' : 'var(--accent-emerald)'} />
                <span>#{topic}</span>
                <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtered Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filteredSessions.length === 0 ? (
          <div 
            className="white-card"
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Brain size={36} color="var(--accent-emerald)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-forest)', marginBottom: 6 }}>
              No Insights Match Query
            </h3>
            <p style={{ fontSize: '0.86rem' }}>
              Try clearing your topic tag or broadening your search keywords.
            </p>
          </div>
        ) : (
          filteredSessions.map((s) => (
            <div 
              key={s.id} 
              className="white-card" 
              style={{ 
                padding: '24px 28px', 
                cursor: 'pointer',
              }}
              onClick={() => onSelectSession(s)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-forest)', marginBottom: 4 }}>
                    {s.title}
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {new Date(s.capturedAtMs).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })} • {Math.round(s.metadata.durationSeconds / 60)} mins
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-emerald" style={{ textTransform: 'none' }}>
                    {s.insights.sentiment || 'reflective'}
                  </span>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    background: '#f2faf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <ChevronRight size={18} color="var(--accent-forest)" />
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <p style={{ 
                fontSize: '0.9rem', 
                color: 'var(--text-secondary)', 
                lineHeight: 1.6, 
                marginBottom: 16,
                background: '#f2faf5',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #d7ede1',
              }}>
                {s.insights.executiveSummary}
              </p>

              {/* Key takeaways snapshot */}
              {s.insights.thingsToRemember && s.insights.thingsToRemember.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    THINGS TO REMEMBER:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.insights.thingsToRemember.slice(0, 2).map((tr, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        <Sparkles size={14} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 3 }} />
                        <span>{tr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action items and Questions summary chips */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #edf7f2', paddingTop: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {s.insights.importantTopics.map((topic, i) => (
                    <span 
                      key={i} 
                      className="badge" 
                      style={{ 
                        background: selectedTopic === topic ? '#05291e' : '#ecfdf5', 
                        color: selectedTopic === topic ? '#ffffff' : '#065f46',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      #{topic}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {s.insights.actionItems.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckSquare size={14} color="var(--accent-emerald)" />
                      <span>{s.insights.actionItems.length} tasks</span>
                    </div>
                  )}
                  {s.insights.studyQuestions.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <HelpCircle size={14} color="var(--accent-emerald)" />
                      <span>{s.insights.studyQuestions.length} prompts</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
