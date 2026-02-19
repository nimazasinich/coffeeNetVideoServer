/**
 * Reusable Modal and Drawer — RTL-friendly, keyboard (Escape), focus trap.
 * Use for job details, drive details, payment confirmation, license/QR quick-view.
 */
import { useEffect, useRef, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';

type Variant = 'modal' | 'drawer-right' | 'drawer-left';

export function ModalDrawer({
  open,
  onClose,
  title,
  children,
  variant = 'modal',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  variant?: Variant;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (open && ref.current) {
      const focusable = ref.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  const isDrawer = variant.startsWith('drawer');
  const drawerRight = variant === 'drawer-right';

  return (
    <div
      className={`fixed inset-0 z-50 ${isDrawer ? 'flex justify-end' : 'flex items-center justify-center p-4'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-drawer-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="بستن"
      />

      <div
        ref={ref}
        className={`
          relative flex flex-col max-h-full w-full
          ${isDrawer ? (drawerRight ? 'drawer-panel-right' : 'drawer-panel-left') : 'rounded-2xl max-w-lg'}
        `}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-3)',
          ...(isDrawer && { maxWidth: 'min(400px, 100%)' }),
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 id="modal-drawer-title" className="text-base font-bold" style={{ color: 'var(--text)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text2)' }}
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
