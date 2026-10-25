import React from 'react';
import { 
  ArrowDownCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  Play, 
  X, 
  ShieldCheck, 
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
      background: 'rgba(5, 41, 30, 0.45)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: 16,
    }}>
      <div 
        className="white-card"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 28,
          background: '#ffffff',
          border: '1.5px solid #d7ede1',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(5, 41, 30, 0.2)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ArrowDownCircle size={18} color="var(--accent-emerald)" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
                {transfer.status === 'verifying' 
                  ? 'Verifying Checksum...' 
                  : transfer.status === 'completed' 
                  ? 'Transfer Complete' 
                  : transfer.status === 'failed' 
                  ? 'Transfer Failed' 
                  : 'Syncing Recording...'}
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: 42 }}>
              {sessionTitle || transfer.sessionId}
            </p>
          </div>

          {(transfer.status === 'completed' || transfer.status === 'failed') && onClose && (
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Progress Bar & Percent */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              Chunk {transfer.currentChunk} of {transfer.totalChunks}
            </span>
            <span style={{ fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {percent}%
            </span>
          </div>

          <div style={{
            height: 10,
            borderRadius: 'var(--radius-full)',
            background: '#e2f5ec',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${percent}%`,
              background: transfer.status === 'failed' 
                ? 'var(--accent-rose)' 
                : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>

        {/* Packet Matrix Visualization */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
            4KB Chunk Validation Matrix (IEEE 802.3 CRC32):
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            maxHeight: 76,
            overflowY: 'auto',
            background: '#f2faf5',
            padding: 10,
            borderRadius: 'var(--radius-md)',
            border: '1px solid #d7ede1',
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
                    borderRadius: 3,
                    background: isDone 
                      ? '#059669' 
                      : isCurrent 
                      ? '#34d399' 
                      : '#d7ede1',
                    boxShadow: isCurrent ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
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
          gap: 10,
          marginBottom: 18,
          textAlign: 'center',
        }}>
          <div style={{
            background: '#f2faf5',
            borderRadius: 'var(--radius-md)',
            padding: '10px 6px',
            border: '1px solid #d7ede1',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Throughput</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
              {speedKb} KB/s
            </div>
          </div>

          <div style={{
            background: '#f2faf5',
            borderRadius: 'var(--radius-md)',
            padding: '10px 6px',
            border: '1px solid #d7ede1',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Time Left</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
              {transfer.estimatedRemainingSec}s
            </div>
          </div>

          <div style={{
            background: '#f2faf5',
            borderRadius: 'var(--radius-md)',
            padding: '10px 6px',
            border: '1px solid #d7ede1',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Retries</div>
            <div style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              color: transfer.retryCount > 0 ? 'var(--accent-amber)' : 'var(--accent-forest)',
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
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#9f1239',
            marginBottom: 18,
          }}>
            <AlertTriangle size={16} color="var(--accent-rose)" />
            <span>{transfer.lastError}</span>
          </div>
        )}

        {/* MicroSD Integrity Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: '0.76rem',
          color: '#065f46',
          marginBottom: 20,
        }}>
          <ShieldCheck size={16} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>MicroSD Protection:</strong> Original WAV is preserved on physical microSD until chunk CRC32 checksums are confirmed and committed to local IndexedDB.
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {transfer.status === 'in_progress' && (
            <>
              <button
                onClick={() => pendantManager.pauseTransfer()}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <Pause size={14} /> Pause
              </button>
              <button
                onClick={() => pendantManager.cancelTransfer()}
                className="btn btn-danger"
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <X size={14} /> Cancel
              </button>
            </>
          )}

          {transfer.status === 'paused' && (
            <>
              <button
                onClick={() => pendantManager.resumeTransfer()}
                className="btn btn-forest"
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <Play size={14} /> Resume
              </button>
              <button
                onClick={() => pendantManager.cancelTransfer()}
                className="btn btn-danger"
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <X size={14} /> Cancel
              </button>
            </>
          )}

          {transfer.status === 'completed' && (
            <button
              onClick={onClose}
              className="btn btn-forest"
              style={{ width: '100%', fontSize: '0.88rem', padding: '10px' }}
            >
              <CheckCircle2 size={16} /> Open Synced Session
            </button>
          )}

          {transfer.status === 'failed' && (
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.88rem', padding: '10px' }}
            >
              <RotateCcw size={15} /> Close & Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
