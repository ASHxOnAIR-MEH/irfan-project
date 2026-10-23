import React from 'react';
import { 
  ArrowDownCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  Play, 
  X, 
  ShieldCheck, 
  Activity,
  RotateCcw
} from 'lucide-react';
import { TransferState } from '../../types/protocol';
import { pendantManager } from '../../services/pendantManager';

interface TransferModalProps {
  transfer: TransferState | null;
  sessionTitle?: string;
  onClose?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  transfer,
  sessionTitle,
  onClose,
}) => {
  if (!transfer) return null;

  const percent = transfer.totalBytes > 0
    ? Math.min(100, Math.round((transfer.transferredBytes / transfer.totalBytes) * 100))
    : 0;

  const speedKb = (transfer.bytesPerSecond / 1024).toFixed(1);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(4, 6, 10, 0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: 16,
    }}>
      <div 
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 24,
          background: 'rgba(13, 19, 32, 0.94)',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), var(--shadow-glow-cyan)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ArrowDownCircle size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.15rem' }}>
                {transfer.status === 'verifying' 
                  ? 'Verifying Checksum...' 
                  : transfer.status === 'completed' 
                  ? 'Transfer Complete' 
                  : transfer.status === 'failed' 
                  ? 'Transfer Failed' 
                  : 'Syncing Recording...'}
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {sessionTitle || transfer.sessionId}
            </p>
          </div>

          {(transfer.status === 'completed' || transfer.status === 'failed') && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Progress Bar & Percent */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Chunk {transfer.currentChunk} of {transfer.totalChunks}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {percent}%
            </span>
          </div>

          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: transfer.status === 'failed' ? 'var(--accent-rose)' : 'var(--grad-pendant)',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>

        {/* Packet Matrix Visualization */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            4KB Chunk Validation Matrix (IEEE 802.3 CRC32):
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            maxHeight: 70,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: 8,
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
          }}>
            {Array.from({ length: transfer.totalChunks }).map((_, i) => {
              const isDone = i < transfer.currentChunk;
              const isCurrent = i === transfer.currentChunk - 1;
              return (
                <div
                  key={i}
                  title={`Chunk ${i + 1}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: isDone 
                      ? 'var(--accent-emerald)' 
                      : isCurrent 
                      ? 'var(--accent-cyan)' 
                      : 'rgba(255, 255, 255, 0.1)',
                    boxShadow: isCurrent ? '0 0 8px var(--accent-cyan)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Telemetry Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            padding: '8px 4px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Throughput</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {speedKb} KB/s
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            padding: '8px 4px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Time Remaining</div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {transfer.estimatedRemainingSec}s
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            padding: '8px 4px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retries / Errors</div>
            <div style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: transfer.retryCount > 0 ? 'var(--accent-amber)' : 'var(--text-primary)',
            }}>
              {transfer.retryCount}
            </div>
          </div>
        </div>

        {/* Status / Error Alert */}
        {transfer.lastError && transfer.status === 'failed' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: '0.8rem',
            color: '#fecdd3',
            marginBottom: 16,
          }}>
            <AlertTriangle size={16} color="var(--accent-rose)" />
            <span>{transfer.lastError}</span>
          </div>
        )}

        {/* MicroSD Integrity Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          background: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginBottom: 18,
        }}>
          <ShieldCheck size={16} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>MicroSD Protection:</strong> Original WAV file is preserved on the SD card until CRC32 is confirmed and committed to local storage.
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {transfer.status === 'in_progress' && (
            <>
              <button
                onClick={() => pendantManager.pauseTransfer()}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <Pause size={14} /> Pause
              </button>
              <button
                onClick={() => pendantManager.cancelTransfer()}
                className="btn btn-danger"
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <X size={14} /> Cancel
              </button>
            </>
          )}

          {transfer.status === 'paused' && (
            <>
              <button
                onClick={() => pendantManager.resumeTransfer()}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <Play size={14} /> Resume
              </button>
              <button
                onClick={() => pendantManager.cancelTransfer()}
                className="btn btn-danger"
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                <X size={14} /> Cancel
              </button>
            </>
          )}

          {transfer.status === 'completed' && (
            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.84rem' }}
            >
              <CheckCircle2 size={16} /> Open Synced Session
            </button>
          )}

          {transfer.status === 'failed' && (
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.84rem' }}
            >
              <RotateCcw size={15} /> Close & Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
