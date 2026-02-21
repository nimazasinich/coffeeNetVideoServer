/**
 * Refactored: uses ui/Overlay for unified focus/ARIA/Escape behavior.
 * Visual markup identical — parity preserved.
 */
import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Overlay } from '../ui/Overlay';

interface ModalDrawerProps {
  open:     boolean;
  onClose:  () => void;
  title:    string;
  children: ReactNode;
  variant?: 'drawer' | 'modal' | 'drawer-right';
}

export function ModalDrawer({ open, onClose, title, children, variant = 'drawer' }: ModalDrawerProps) {

  const isModal = variant === 'modal';
  const isRight = variant === 'drawer-right';

  if (isRight) {
    return (
      <Overlay isOpen={open} onClose={onClose} variant="drawer" maxWidth={340}>
        <DrawerHeader title={title} onClose={onClose} />
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>{children}</div>
      </Overlay>
    );
  }

  return (
    <Overlay isOpen={open} onClose={onClose} variant="modal">
      <DrawerHeader title={title} onClose={onClose} />
      <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>{children}</div>
    </Overlay>
  );
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{title}</h2>
      <button className="btn-icon" onClick={onClose} style={{ width: 30, height: 30 }}>
        <X size={14} />
      </button>
    </div>
  );
}
