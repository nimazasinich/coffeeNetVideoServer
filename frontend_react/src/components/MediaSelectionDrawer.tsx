/**
 * Media Selection Drawer (Cart)
 * Uses ModalDrawer (variant="drawer-right") for Escape, backdrop, focus trap.
 */
import { Trash2, ShoppingCart, Send, CreditCard, Wallet, HardDrive, Smartphone } from 'lucide-react';
import { formatPrice, formatBytes } from '../lib/utils';
import type { Media, Drive, DeliveryType, PaymentMode } from '../lib/types';
import { useState } from 'react';
import { ModalDrawer } from './ModalDrawer';
import { DriveSelector } from './DriveSelector';
import { MediaIcon } from './MediaIcon';

interface MediaSelectionDrawerProps {
  selectedMedia: Media[];
  onRemove:  (mediaId: string) => void;
  onClear:   () => void;
  onClose:   () => void;
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
    <ModalDrawer open onClose={onClose} title="لیست کپی شما" variant="drawer-right">
      <div className="space-y-6">
        <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text3)' }}>
          {selectedMedia.length} مورد انتخاب شده
        </p>

        {/* Media list */}
        {selectedMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
            <ShoppingCart className="w-16 h-16" style={{ strokeWidth: 1 }} />
            <p className="text-sm font-bold">هنوز فیلمی انتخاب نکرده‌اید</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedMedia.map((media) => (
              <div key={media.id} className="customer-card rounded-2xl p-4 flex gap-4 group">
                <div className="w-14 aspect-[2/3] rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: 'var(--bg3)' }}>
                  <MediaIcon type={media.type} size={28} className="opacity-70" />
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
                        className="p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10 focus-ring"
                        style={{ color: 'var(--text3)' }}
                        aria-label="حذف از لیست">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button onClick={onClear}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:opacity-70 focus-ring"
                    style={{ color: 'var(--text3)' }}>
              پاک کردن کل لیست
            </button>
          </div>
        )}

        {selectedMedia.length > 0 && (
          <div className="space-y-6">
            {/* Delivery Type */}
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
                          className="p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all focus-ring"
                          style={{
                            background:   deliveryType === value ? 'var(--accent-muted)' : 'var(--surface-muted)',
                            borderColor:  deliveryType === value ? 'var(--accent)' : 'var(--border)',
                            color:        deliveryType === value ? 'var(--accent)' : 'var(--text2)',
                          }}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drive Selection (USB only) */}
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

            {/* Mobile info */}
            {deliveryType === 'mobile' && (
              <div className="p-4 rounded-xl text-xs leading-relaxed flex items-start gap-2"
                     style={{ background: 'var(--blue-muted)', border: '1px solid var(--blue-border)', color: 'var(--text2)' }}>
                <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>پس از تأیید ادمین، لینک دانلود برای دستگاه شما ارسال می‌شود.</span>
              </div>
            )}

            {/* Payment Method */}
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
                          className="p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all focus-ring"
                          style={{
                            background:   paymentMode === value ? 'var(--accent-muted)' : 'var(--surface-muted)',
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

        {/* Footer */}
        {selectedMedia.length > 0 && (
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>حجم کل:</span>
                <span className="text-sm font-mono" style={{ color: 'var(--text)' }}>{formatBytes(totalBytes)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t" style={{ borderColor: 'var(--surface-subtle)' }}>
                <span className="text-lg font-black" style={{ color: 'var(--text)' }}>هزینه نهایی:</span>
                <span className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{formatPrice(totalCents / 100)}</span>
              </div>
            </div>

            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-black transition-all focus-ring"
              style={canSubmit ? {
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: 'var(--bg)',
                boxShadow: '0 4px 20px var(--accent-glow)',
              } : {
                background: 'var(--surface-subtle)',
                color: 'var(--text3)',
                border: '1px solid var(--border)',
                cursor: 'not-allowed',
              }}>
              <Send className="w-4 h-4" />
              {deliveryType === 'usb' && !selectedDrive
                ? 'ابتدا یک درایو انتخاب کنید'
                : 'ثبت درخواست و شروع فرآیند'}
            </button>

            <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text3)' }}>
              پس از ارسال درخواست، ادمین آن را بررسی و تأیید می‌کند.
            </p>
          </div>
        )}
      </div>
    </ModalDrawer>
  );
}
