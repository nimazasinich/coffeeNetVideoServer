import { HardDrive, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import type { Drive } from '../lib/types';

interface DriveSelectorProps {
  drives:        Drive[];
  selectedDrive: Drive | null;
  mediaSize?:    number;
  onSelect:      (drive: Drive) => void;
}

export function DriveSelector({ drives, selectedDrive, mediaSize, onSelect }: DriveSelectorProps) {
  if (drives.length === 0) {
    return (
      <div className="rounded-xl p-4 flex items-start gap-3"
           style={{ background: 'rgba(255,124,77,.07)', border: '1px solid rgba(255,124,77,.2)' }}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--orange)' }} />
        <div>
          <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--orange)' }}>درایو USB شناسایی نشد</h3>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            فلش مموری خود را وارد کنید و چند ثانیه صبر کنید.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <HardDrive className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        درایو USB را انتخاب کنید
      </h3>
      <div className="space-y-2">
        {drives.map(drive => {
          const locked   = drive.is_locked;
          const hasSpace = !mediaSize || drive.free_bytes >= mediaSize;
          const selected = selectedDrive?.id === drive.id;
          const usedPct  = drive.capacity_bytes > 0
            ? ((drive.capacity_bytes - drive.free_bytes) / drive.capacity_bytes) * 100 : 0;
          const barColor = usedPct > 90 ? 'var(--red)' : usedPct > 70 ? 'var(--orange)' : 'var(--green)';
          const disabled = locked || !hasSpace;

          return (
            <button
              key={drive.id}
              onClick={() => !disabled && onSelect(drive)}
              disabled={disabled}
              className="w-full p-3.5 rounded-xl border text-right transition-all"
              style={{
                background:   selected ? 'rgba(232,197,71,.06)' : 'var(--bg3)',
                borderColor:  selected ? 'rgba(232,197,71,.5)' : disabled ? 'var(--border)' : 'var(--border)',
                opacity:      disabled ? 0.5 : 1,
                cursor:       disabled ? 'not-allowed' : 'pointer',
                boxShadow:    selected ? '0 0 0 2px rgba(232,197,71,.15)' : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                {/* Drive icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: selected ? 'rgba(232,197,71,.1)' : 'var(--surface)' }}>
                  {locked
                    ? <Lock className="w-4 h-4" style={{ color: 'var(--red)' }} />
                    : <HardDrive className="w-4 h-4" style={{ color: selected ? 'var(--accent)' : 'var(--text2)' }} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {drive.label || 'USB Drive'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {selected && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
                      <span className={`chip ${locked ? 'chip-failed' : 'chip-completed'}`}>
                        {locked ? 'مشغول' : 'آزاد'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs mb-2 mono" style={{ color: 'var(--text3)' }}>{drive.path}</p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text2)' }}>
                    {formatBytes(drive.free_bytes)} آزاد از {formatBytes(drive.capacity_bytes)}
                  </p>

                  {!hasSpace && (
                    <p className="text-xs mb-1" style={{ color: 'var(--red)' }}>❌ فضای کافی ندارد</p>
                  )}

                  {/* Space bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${usedPct}%`, background: barColor }} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
