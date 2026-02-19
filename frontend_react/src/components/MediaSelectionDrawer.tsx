/**
 * Media Selection Drawer (Cart)
 * FIX: Added delivery type (USB / Mobile), mobile no longer requires drive,
 *      fixed animation direction (slide from right), and improved UX.
 */
import { X, Trash2, ShoppingCart, Send, CreditCard, Wallet, HardDrive, Smartphone } from 'lucide-react';
import { formatPrice, formatBytes } from '../lib/utils';
import type { Media, Drive, DeliveryType, PaymentMode } from '../lib/types';
import { useState } from 'react';
import { DriveSelector } from './DriveSelector';

interface MediaSelectionDrawerProps {
  selectedMedia: Media[];
  onRemove:  (mediaId: string) => void;
  onClear:   () => void;
  onClose:   () => void;
  /** driveId is null for mobile delivery */
  onSubmit:  (driveId: string | null, paymentMode: PaymentMode, deliveryType: DeliveryType) => void;
  drives:    Drive[];
}

export function MediaSelectionDrawer({
  selectedMedia, onRemove, onClear, onClose, onSubmit, drives,
}: MediaSelectionDrawerProps) {
  const [paymentMode,   setPaymentMode  ] = useState<PaymentMode>('manual');
  const [deliveryType,  setDeliveryType ] = useState<DeliveryType>('usb');
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);

  const totalCents = selectedMedia.reduce((s, m) => s + (m.price_usd ? m.price_usd * 100 : 0), 0);
  const totalBytes = selectedMedia.reduce((s, m) => s + m.size_bytes, 0);

  // Submit requires: items selected + (drive for USB OR mobile delivery)
  const canSubmit = selectedMedia.length > 0 &&
    (deliveryType === 'mobile' || (deliveryType === 'usb' && !!selectedDrive));

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(
      deliveryType === 'usb' ? (selectedDrive?.id ?? null) : null,
      paymentMode,
      deliveryType,
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer — slides in from the RIGHT */}
      <div className="relative w-full max-w-md shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
           style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <header className="p-6 border-b flex items-center justify-between sticky top-0 z-10"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(232,197,71,.1)' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>لیست کپی شما</h2>
              <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text3)' }}>
                {selectedMedia.length} مورد انتخاب شده
              </p>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-full transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text3)' }}>
            <X className="w-6 h-6" />
          </button>
        </header>

        {/* Main scroll area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Media list */}
          {selectedMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
              <ShoppingCart className="w-16 h-16" style={{ strokeWidth: 1 }} />
              <p className="text-sm font-bold">هنوز فیلمی انتخاب نکرده‌اید</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedMedia.map((media) => (
                <div key={media.id} className="rounded-2xl p-4 flex gap-4 group"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-14 aspect-[2/3] rounded-lg flex items-center justify-center text-2xl shrink-0"
                       style={{ background: 'var(--bg3)' }}>
                    {media.type === 'series' ? '📺' : '🎬'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold truncate mb-1" style={{ color: 'var(--text)' }}>{media.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase" style={{ color: 'var(--accent)' }}>
                        {formatPrice(media.price_usd || 0)}
                      </span>
                      <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                      <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{formatBytes(media.size_bytes)}</span>
                    </div>
                  </div>
                  <button onClick={() => onRemove(media.id)}
                          className="p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          style={{ color: 'var(--text3)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button onClick={onClear}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:opacity-70"
                      style={{ color: 'var(--text3)' }}>
                پاک کردن کل لیست
              </button>
            </div>
          )}

          {selectedMedia.length > 0 && (
            <div className="space-y-6">

              {/* ── Delivery Type ─────────────────────────── */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  نحوه دریافت
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'usb',    label: 'کپی روی USB',    Icon: HardDrive  },
                    { value: 'mobile', label: 'دانلود موبایل', Icon: Smartphone },
                  ] as const).map(({ value, label, Icon }) => (
                    <button key={value}
                            onClick={() => { setDeliveryType(value); if (value === 'mobile') setSelectedDrive(null); }}
                            className="p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all"
                            style={{
                              background:   deliveryType === value ? 'rgba(232,197,71,.1)' : 'rgba(255,255,255,.03)',
                              borderColor:  deliveryType === value ? 'var(--accent)' : 'var(--border)',
                              color:        deliveryType === value ? 'var(--accent)' : 'var(--text2)',
                            }}>
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Drive Selection (USB only) ─────────────── */}
              {deliveryType === 'usb' && (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                    انتخاب درایو USB
                  </label>
                  <DriveSelector
                    drives={drives}
                    selectedDrive={selectedDrive}
                    mediaSize={totalBytes}
                    onSelect={setSelectedDrive}
                  />
                </div>
              )}

              {/* ── Mobile info ───────────────────────────── */}
              {deliveryType === 'mobile' && (
                <div className="p-4 rounded-xl text-xs leading-relaxed"
                     style={{ background: 'rgba(74,158,255,.07)', border: '1px solid rgba(74,158,255,.2)', color: 'var(--text2)' }}>
                  📱 پس از تأیید ادمین، لینک دانلود برای دستگاه شما ارسال می‌شود.
                </div>
              )}

              {/* ── Payment Method ────────────────────────── */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  روش پرداخت
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'manual', label: 'حضوری',  Icon: Wallet     },
                    { value: 'online', label: 'آنلاین', Icon: CreditCard },
                  ] as const).map(({ value, label, Icon }) => (
                    <button key={value}
                            onClick={() => setPaymentMode(value)}
                            className="p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all"
                            style={{
                              background:   paymentMode === value ? 'rgba(232,197,71,.1)' : 'rgba(255,255,255,.03)',
                              borderColor:  paymentMode === value ? 'var(--accent)' : 'var(--border)',
                              color:        paymentMode === value ? 'var(--accent)' : 'var(--text2)',
                            }}>
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="p-6 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-6 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>حجم کل:</span>
              <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>{formatBytes(totalBytes)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,.05)' }}>
              <span className="text-lg font-black" style={{ color: 'var(--text)' }}>هزینه نهایی:</span>
              <span className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{formatPrice(totalCents / 100)}</span>
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-black transition-all"
            style={canSubmit ? {
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#07070d',
              boxShadow: '0 4px 20px rgba(232,197,71,.3)',
            } : {
              background: 'rgba(255,255,255,.05)',
              color: 'var(--text3)',
              border: '1px solid var(--border)',
              cursor: 'not-allowed',
            }}>
            <Send className="w-4 h-4" />
            {deliveryType === 'usb' && !selectedDrive
              ? 'ابتدا یک درایو انتخاب کنید'
              : 'ثبت درخواست و شروع فرآیند'}
          </button>

          <p className="text-[10px] text-center mt-4 leading-relaxed" style={{ color: 'var(--text3)' }}>
            پس از ارسال درخواست، ادمین آن را بررسی و تأیید می‌کند.
          </p>
        </footer>
      </div>
    </div>
  );
}
