import React from 'react';
import { 
  HardDrive, 
  Mic, 
  Square, 
  Cpu, 
  CheckCircle2, 
  Radio, 
  ArrowRight, 
  Play, 
  Pause, 
  ShieldCheck, 
  Sparkles, 
  Volume2,
  Brain,
  Upload
} from 'lucide-react';
import { PendantDeviceStatus } from '../../types/device';
import { SyncManifestItem } from '../../types/protocol';
import { RecordingSession } from '../../types/session';
import { pendantManager } from '../../services/pendantManager';

interface DashboardViewProps {
  status: PendantDeviceStatus;
  recentSessions: RecordingSession[];
  pendingManifest: SyncManifestItem[];
  onSelectSession: (session: RecordingSession) => void;
  onSyncSession: (item: SyncManifestItem) => void;
  onViewAllSessions: () => void;
  onNavigateToAnalyze?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  recentSessions,
  pendingManifest,
  onSelectSession,
  onSyncSession,
  onViewAllSessions,
  onNavigateToAnalyze,
}) => {
  const isRecording = status.operatingMode === 'recording';
  const isPaused = status.operatingMode === 'paused';
  const isConnected = status.connectionState === 'connected';

  const totalRecordingSeconds = recentSessions.reduce((acc, s) => acc + s.metadata.durationSeconds, 0);

  const handleRecordToggle = async () => {
    try {
      if (isRecording || isPaused) {
        await pendantManager.stopRecording();
      } else {
        await pendantManager.startRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Record toggle error');
    }
  };

  const handlePauseResume = async () => {
    try {
      if (isRecording) {
        await pendantManager.pauseRecording();
      } else if (isPaused) {
        await pendantManager.resumeRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Pause/resume toggle error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, width: '100%' }}>
      {/* ========================================================
          1. HERO SECTION (Inspired by Reference Two-Column Layout)
          ======================================================== */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 36,
        alignItems: 'center',
        padding: '20px 0 10px',
      }}>
        {/* Left Column: Headline, Narrative, and Primary CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-emerald" style={{ fontSize: '0.72rem', padding: '5px 14px' }}>
              AMBIENT INTELLIGENCE • HARDWARE FIRST
            </span>
            <span className={`badge ${isConnected ? 'badge-forest' : 'badge-amber'}`} style={{ fontSize: '0.72rem', padding: '5px 12px' }}>
              {status.connectionState.toUpperCase()}
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.3rem, 4.2vw, 3.4rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
          }}>
            Capture the Moment.<br />
            <span style={{ color: 'var(--accent-emerald)' }}>Remember</span> What Matters.
          </h1>

          <p style={{
            fontSize: '1.05rem',
            lineHeight: 1.68,
            color: 'var(--text-secondary)',
            maxWidth: 520,
          }}>
            An unobtrusive smart audio pendant powered by the dual-core ESP32-S3.
            Capture lectures, meetings, and personal voice memos offline to microSD —
            with guaranteed local-first privacy and zero cloud dependencies.
          </p>

          {/* Action Button Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingTop: 6 }}>
            {!isConnected ? (
              <button
                onClick={() => pendantManager.connect()}
                className="btn btn-forest"
                style={{ padding: '12px 28px', fontSize: '0.94rem' }}
              >
                <Radio size={16} /> Connect Pendant
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleRecordToggle}
                  className={`btn ${isRecording || isPaused ? 'btn-danger' : 'btn-mint-bright'}`}
                  style={{ padding: '12px 26px', fontSize: '0.94rem' }}
                >
                  {isRecording || isPaused ? (
                    <>
                      <Square size={16} fill="currentColor" /> Stop & Save to MicroSD
                    </>
                  ) : (
                    <>
                      <Mic size={16} /> Record Voice Memo
                    </>
                  )}
                </button>

                {(isRecording || isPaused) && (
                  <button
                    onClick={handlePauseResume}
                    className="btn btn-secondary"
                    style={{ padding: '12px 20px', fontSize: '0.94rem' }}
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onViewAllSessions}
              className="btn btn-secondary"
              style={{ padding: '12px 24px', fontSize: '0.94rem' }}
            >
              <span>Explore Library</span>
              <ArrowRight size={15} />
            </button>

            {onNavigateToAnalyze && (
              <button
                onClick={onNavigateToAnalyze}
                className="btn btn-secondary"
                style={{ padding: '12px 22px', fontSize: '0.94rem', borderColor: 'var(--accent-emerald)', color: 'var(--accent-forest)' }}
              >
                <Brain size={15} />
                <span>AI Analyze</span>
              </button>
            )}
          </div>

          {/* Micro Telemetry Bar under Hero CTA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            paddingTop: 10,
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--accent-emerald)" />
              <span>100% Offline Capture</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--accent-emerald)" />
              <span>Physical Hardware Mute</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--accent-emerald)" />
              <span>4KB Packet CRC32</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Product Showcase with Floating Telemetry Chips */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Main Visual Container */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 480,
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 20px 48px -12px rgba(5, 41, 30, 0.16)',
            background: 'linear-gradient(145deg, #e7f7ee 0%, #f7fcfa 100%)',
            border: '2px solid #bce3cf',
          }}>
            <img 
              src="/pendant_hero.jpg" 
              alt="Ambient Memory Pendant"
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: '1/1',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Subtle Gradient Overlay at bottom for readable chips */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '35%',
              background: 'linear-gradient(to top, rgba(5, 41, 30, 0.4) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Floating Chip 1: Top Left */}
          <div 
            className="floating-chip"
            style={{
              position: 'absolute',
              top: '8%',
              left: '-4%',
              zIndex: 10,
            }}
          >
            <Volume2 size={14} color="var(--accent-emerald)" />
            <span>I²S MEMS Microphone</span>
          </div>

          {/* Floating Chip 2: Top Right */}
          <div 
            className="floating-chip"
            style={{
              position: 'absolute',
              top: '14%',
              right: '-4%',
              zIndex: 10,
            }}
          >
            <ShieldCheck size={14} color="var(--accent-emerald)" />
            <span>Hardware Privacy Switch</span>
          </div>

          {/* Floating Chip 3: Bottom Left */}
          <div 
            className="floating-chip dark"
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '-2%',
              zIndex: 10,
            }}
          >
            <Cpu size={14} color="#34d399" />
            <span>ESP32-S3 Dual-Core</span>
          </div>

          {/* Floating Chip 4: Bottom Right */}
          <div 
            className="floating-chip"
            style={{
              position: 'absolute',
              bottom: '8%',
              right: '-4%',
              zIndex: 10,
            }}
          >
            <HardDrive size={14} color="var(--accent-emerald)" />
            <span>Physical MicroSD Buffer</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. WIDE DEEP-GREEN FEATURE & STATISTICS PANEL
             (Direct translation of Reference Image's wide dark panel)
          ======================================================== */}
      <section className="dark-panel" style={{ padding: '36px 36px 40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 32,
          alignItems: 'center',
        }}>
          {/* Left Column: Prominent Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px 18px',
            }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                +100h
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
                Offline Storage
              </div>
              <div style={{ fontSize: '0.74rem', color: '#a7f3d0', marginTop: 2 }}>
                16GB MicroSD FAT32 Buffer
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px 18px',
            }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                100%
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
                Local Privacy
              </div>
              <div style={{ fontSize: '0.74rem', color: '#a7f3d0', marginTop: 2 }}>
                Zero Cloud Audio Leaks
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px 18px',
            }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                4 KB
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
                CRC32 Packets
              </div>
              <div style={{ fontSize: '0.74rem', color: '#a7f3d0', marginTop: 2 }}>
                Fault-Tolerant Resumption
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px 18px',
            }}>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {recentSessions.length}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
                Saved Sessions
              </div>
              <div style={{ fontSize: '0.74rem', color: '#a7f3d0', marginTop: 2 }}>
                {Math.round(totalRecordingSeconds / 60)} mins processed
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Callout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.08em', color: '#34d399', textTransform: 'uppercase' }}>
              Hardware-Level Security
            </span>

            <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
              Commitment in every circuit, privacy in every result.
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#d1fae5', lineHeight: 1.65 }}>
              Traditional voice AI wearables depend on continuous Bluetooth tethering to your smartphone, 
              streaming raw audio bytes up to corporate cloud servers.
            </p>

            <p style={{ fontSize: '0.92rem', color: '#d1fae5', lineHeight: 1.65 }}>
              The Ambient Memory Pendant flips this paradigm: raw 16kHz audio stays buffered on the pendant’s 
              removable physical microSD card. You decide when to synchronize over local Wi-Fi SoftAP or BLE, 
              and all AI processing runs client-side.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. PENDING MICROSD SYNCHRONIZATION ALERT (If items ready)
          ======================================================== */}
      {pendingManifest.length > 0 && (
        <section style={{
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <HardDrive size={22} color="#d97706" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#92400e' }}>
                {pendingManifest.length} Recording(s) Ready on MicroSD Card
              </div>
              <div style={{ fontSize: '0.82rem', color: '#b45309' }}>
                Physical audio captures ready for 4KB chunked binary transfer and AI transcription.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pendingManifest.slice(0, 2).map((item) => (
              <button
                key={item.sessionId}
                onClick={() => onSyncSession(item)}
                className="btn btn-forest"
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Sync {item.filename}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================
          4. HOW AMBIENT PENDANT WORKS — 3 KEY SUBSYSTEM CARDS
          ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Subsystem Architecture
          </span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>
            Where hardware engineering meets local intelligence
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20 }}>
          {/* Card 1 */}
          <div className="white-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              background: '#e6f7ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Volume2 size={22} color="var(--accent-forest)" />
            </div>
            <h3 style={{ fontSize: '1.15rem' }}>1. I²S Acoustic Capture</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Integrated INMP441 digital MEMS microphone streams 16kHz 16-bit mono audio straight to DMA memory buffers without noisy analog preamps.
            </p>
          </div>

          {/* Card 2 */}
          <div className="white-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              background: '#e6f7ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Cpu size={22} color="var(--accent-forest)" />
            </div>
            <h3 style={{ fontSize: '1.15rem' }}>2. ESP32-S3 Dual-Core</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              One 240MHz core exclusively manages audio sampling and high-speed SPI microSD writing, while Core 1 handles BLE GATT and local Wi-Fi SoftAP transfers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="white-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              background: '#e6f7ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={22} color="var(--accent-forest)" />
            </div>
            <h3 style={{ fontSize: '1.15rem' }}>3. Structured AI Insights</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Automatically synthesizes spoken discussions into executive summaries, key concepts, actionable task checklists, and study review flashcards.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. WIDE DEEP-GREEN HARDWARE SCHEMATIC SHOWCASE PANEL
             (Direct translation of Reference Image's second dark panel with helmet/blueprints)
          ======================================================== */}
      <section className="dark-panel" style={{ padding: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'center',
        }}>
          {/* Left Text */}
          <div style={{ padding: '36px 36px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Physical Hardware Reality
            </span>

            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
              Engineered for complete ownership. Hardware schematics and physical media.
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#d1fae5', lineHeight: 1.65 }}>
              No proprietary black boxes. The Ambient Memory Pendant pairs standard off-the-shelf ESP32-S3 modules 
              with open firmware protocols. The physical card in your hands is the single source of truth.
            </p>

            <div>
              <button
                onClick={() => pendantManager.connect()}
                className="btn btn-mint-bright"
                style={{ padding: '10px 24px', fontSize: '0.88rem' }}
              >
                Inspect Device Status
              </button>
            </div>
          </div>

          {/* Right Hardware Schematic Image */}
          <div style={{ height: '100%', minHeight: 280, position: 'relative' }}>
            <img 
              src="/pendant_internals.jpg" 
              alt="ESP32-S3 Audio Pendant Schematic and Hardware"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </div>
      </section>

      {/* ========================================================
          6. RECENT RECORDINGS LIBRARY PREVIEW
          ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Memory Archive
            </span>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 4 }}>
              Recent Voice Sessions
            </h2>
          </div>

          <button
            onClick={onViewAllSessions}
            className="btn btn-secondary"
            style={{ padding: '8px 18px', fontSize: '0.82rem' }}
          >
            <span>View All ({recentSessions.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {recentSessions.slice(0, 3).map((session) => (
            <div
              key={session.id}
              className="white-card"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                cursor: 'pointer',
              }}
              onClick={() => onSelectSession(session)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {session.title}
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span>{formatDate(session.capturedAtMs)}</span>
                    <span>•</span>
                    <span>{formatDuration(session.metadata.durationSeconds)}</span>
                  </div>
                </div>

                <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                  Synced
                </span>
              </div>

              <p style={{
                fontSize: '0.86rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {session.insights.executiveSummary}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {session.tags.slice(0, 2).map((t, idx) => (
                    <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.68rem', textTransform: 'none' }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSession(session);
                  }}
                  className="btn btn-forest"
                  style={{ padding: '6px 14px', fontSize: '0.76rem' }}
                >
                  <Play size={12} fill="currentColor" /> Play & Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          7. VALUE PROPOSITIONS ROW (Bottom benefit cards like Reference)
          ======================================================== */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        paddingTop: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
        }}>
          <ShieldCheck size={24} color="var(--accent-emerald)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>Hardware Privacy Guarantee</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Mute switch halts recording immediately</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
        }}>
          <HardDrive size={24} color="var(--accent-emerald)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>FAT32 Removable Storage</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Plug card directly into any PC reader</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
        }}>
          <Radio size={24} color="var(--accent-emerald)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>iOS Safari Wi-Fi SoftAP</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>50x faster transfers without App Store</div>
          </div>
        </div>
      </section>
    </div>
  );
};
