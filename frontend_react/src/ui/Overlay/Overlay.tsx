/**
 * SmartCopy Pro — ui/Overlay
 * Unified overlay system for modals and drawers.
 * Handles: focus trap, Escape key, backdrop click, ARIA, focus return.
 */
import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface OverlayProps {
  isOpen:           boolean;
  onClose:          () => void;
  variant:          'modal' | 'drawer';
  children:         ReactNode;
  backdropClose?:   boolean;   // close on backdrop click (default true)
  trapFocus?:       boolean;   // trap Tab focus inside (default true)
  labelledBy?:      string;    // aria-labelledby id
  describedBy?:     string;    // aria-describedby id
  animation?:       string;    // override CSS animation name
  maxWidth?:        number | string;
  zIndex?:          number;
}

const FOCUSABLE_SELECTORS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Overlay({
  isOpen,
  onClose,
  variant,
  children,
  backdropClose = true,
  trapFocus     = true,
  labelledBy,
  describedBy,
  maxWidth,
  zIndex = 500,
}: OverlayProps) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLElement | null>(null);

  // Focus trap + Escape key + focus return
  useEffect(() => {
    if (!isOpen) return;

    // Store previously focused element
    previousRef.current = document.activeElement as HTMLElement;

    // Move focus inside overlay
    const frameId = requestAnimationFrame(() => {
      if (!overlayRef.current) return;
      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      focusable[0]?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (!trapFocus || e.key !== 'Tab') return;
      if (!overlayRef.current) return;

      const focusable = Array.from(
        overlayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter(el => !el.closest('[hidden]'));

      if (focusable.length === 0) { e.preventDefault(); return; }

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to previously focused element
      previousRef.current?.focus();
    };
  }, [isOpen, onClose, trapFocus]);

  // Prevent scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (backdropClose && e.target === e.currentTarget) onClose();
  }, [backdropClose, onClose]);

  if (!isOpen) return null;

  const isModal  = variant === 'modal';
  const isDrawer = variant === 'drawer';

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex,
        background:     'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        display:        'flex',
        alignItems:     isModal ? 'flex-end' : 'stretch',
        justifyContent: isModal ? 'center'   : 'flex-end',
        animation:      'overlay-fade-in 200ms ease',
      }}
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        style={{
          width:          isDrawer ? (typeof maxWidth !== 'undefined' ? maxWidth : 480) : '100%',
          maxWidth:       isModal  ? (typeof maxWidth !== 'undefined' ? maxWidth : 520) : undefined,
          maxHeight:      isModal  ? '90vh' : '100vh',
          height:         isDrawer ? '100vh' : undefined,
          background:     'var(--bg2)',
          border:         isModal
            ? '1px solid var(--border2)'
            : '1px solid var(--border)',
          borderRadius:   isModal  ? '20px 20px 0 0' : '20px 0 0 20px',
          overflow:       'hidden',
          boxShadow:      'var(--shadow-2)',
          display:        'flex',
          flexDirection:  'column',
          animation:      isModal
            ? 'modal-slide-up 0.4s cubic-bezier(0.34,1.4,0.64,1)'
            : 'drawer-slide-in 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {isModal && (
          <div style={{
            width: 36, height: 4,
            background: 'var(--text4)',
            borderRadius: 99,
            margin: '12px auto 0',
            flexShrink: 0,
          }} />
        )}
        {children}
      </div>
    </div>
  );
}
