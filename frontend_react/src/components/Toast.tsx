import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useSmartCopy } from '../context/SmartCopyContext';
import type { ToastItem } from '../lib/types';

function ToastCard({ t }: { t: ToastItem }) {
  const icons = {
    success: <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />,
    error:   <XCircle    size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />,
    info:    <Info       size={16} style={{ color: 'var(--blue)', flexShrink: 0 }} />,
    warn:    <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />,
  };

  return (
    <div className={`toast ${t.type} fade-in`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {icons[t.type]}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{t.title}</p>
          {t.msg && <p style={{ fontSize: 11, marginTop: 2, color: 'var(--text3)' }}>{t.msg}</p>}
        </div>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useSmartCopy();
  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 74,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard t={t} />
        </div>
      ))}
    </div>
  );
}
