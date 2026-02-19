import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id:      string;
  type:    ToastType;
  title:   string;
  message?: string;
}

interface ToastProps { toast: ToastData; onDismiss: (id: string) => void; }

function ToastItem({ toast, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4500);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const dismiss = () => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); };

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info;
  const iconColor   = toast.type === 'success' ? 'var(--green)' : toast.type === 'error' ? 'var(--red)' : 'var(--blue)';
  const borderColor = toast.type === 'success' ? 'rgba(62,207,142,.25)' : toast.type === 'error' ? 'rgba(255,77,109,.25)' : 'rgba(74,158,255,.25)';

  return (
    <div className="flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl"
         style={{
           background:   'var(--surface)',
           border:       `1px solid ${borderColor}`,
           backdropFilter: 'blur(20px)',
           opacity:      exiting ? 0 : 1,
           transform:    exiting ? 'translateY(8px) scale(.95)' : 'translateY(0) scale(1)',
           transition:   'all .3s ease',
           animation:    'slideUp .4s cubic-bezier(.34,1.56,.64,1) both',
         }}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: iconColor }} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{toast.message}</p>
        )}
      </div>
      <button onClick={dismiss} className="flex-shrink-0 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text3)' }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
