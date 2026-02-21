import { HardDrive, Lock, AlertCircle } from 'lucide-react';
import type { Drive } from '../lib/types';
import { formatBytes } from '../lib/utils';

interface Props {
  drives:       Drive[];
  selectedDrive: Drive | null;
  mediaSize:    number;
  onSelect:     (d: Drive) => void;
}

export function DriveSelector({ drives, selectedDrive, mediaSize, onSelect }: Props) {
  if (!drives.length) {
    return (
      <div style={{
        padding: '16px',
        borderRadius: 'var(--r-sm)',
        background: 'rgba(255,85,119,0.06)',
        border: '1px solid rgba(255,85,119,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: 'var(--red)',
      }}>
        <AlertCircle size={15} />
        No USB drive connected
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <HardDrive size={13} style={{ color: 'var(--blue)' }} />
        Select USB Drive
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {drives.map(d => {
          const hasSpace = (d.free_bytes ?? 0) >= mediaSize;
          const isSelected = selectedDrive?.id === d.id;
          const pctUsed = d.capacity_bytes ? ((d.capacity_bytes - (d.free_bytes ?? 0)) / d.capacity_bytes) * 100 : 0;

          return (
            <button
              key={d.id}
              type="button"
              disabled={!hasSpace || !!d.is_locked}
              onClick={() => hasSpace && !d.is_locked && onSelect(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${isSelected ? 'rgba(77,159,255,0.4)' : 'var(--border)'}`,
                background: isSelected ? 'var(--blue-dim)' : 'rgba(255,255,255,0.025)',
                cursor: hasSpace && !d.is_locked ? 'pointer' : 'not-allowed',
                opacity: hasSpace && !d.is_locked ? 1 : 0.5,
                transition: 'var(--t)',
                textAlign: 'left',
                width: '100%',
              }}
            >
              {d.is_locked
                ? <Lock size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                : <HardDrive size={16} style={{ color: isSelected ? 'var(--blue)' : 'var(--text3)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? 'var(--text1)' : 'var(--text2)',
                  marginBottom: 3,
                }}>
                  {d.label ?? d.id}
                  {d.is_locked && <span style={{ color: 'var(--red)', marginLeft: 6, fontSize: 10 }}>Locked</span>}
                </div>
                {/* Progress bar */}
                <div className="progress-track" style={{ height: 3, marginBottom: 3 }}>
                  <div className="progress-fill" style={{
                    width: `${pctUsed}%`,
                    background: pctUsed > 80 ? 'linear-gradient(90deg,var(--amber),var(--red))' : 'linear-gradient(90deg,var(--blue2),var(--cyan))',
                  }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'DM Mono', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Free: {formatBytes(d.free_bytes ?? 0)}</span>
                  <span>Total: {formatBytes(d.capacity_bytes ?? 0)}</span>
                </div>
              </div>
              {!hasSpace && (
                <AlertCircle size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
