import { X, HardDrive, Smartphone, ShoppingCart, CreditCard, Banknote } from 'lucide-react';
import { useState } from 'react';
import { DriveSelector } from './DriveSelector';
import { formatBytes, formatPrice, mediaEmoji, typeLabel } from '../lib/utils';
import type { Drive, Media, PricingTier, DeliveryType, PaymentMode } from '../lib/types';

interface CopyModalProps {
  media:        Media;
  drives:       Drive[];
  pricingTiers: PricingTier[];
  onConfirm:    (
    driveId: string | null,
    deliveryType: DeliveryType,
    paymentMode: PaymentMode,
    amountCents?: number
  ) => void;
  onClose:      () => void;
}

export function CopyModal({ media, drives, pricingTiers, onConfirm, onClose }: CopyModalProps) {
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('usb');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('manual');

  const sizeGb    = media.size_bytes / (1024 ** 3);
  const priceTier = pricingTiers
    .slice().sort((a, b) => a.max_size_gb - b.max_size_gb)
    .find(t => sizeGb <= t.max_size_gb);
  const price = priceTier?.price_usd ?? media.price_usd;
  const amountCents = Math.round((price ?? 0) * 100);

  const canSubmitUSB = deliveryType === 'usb' && selectedDrive && (selectedDrive.free_bytes ?? 0) >= media.size_bytes;
  const canSubmitMobile = deliveryType === 'mobile';
  const canSubmit = deliveryType === 'usb' ? canSubmitUSB : canSubmitMobile;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(
      deliveryType === 'usb' ? selectedDrive!.id : null,
      deliveryType,
      paymentMode,
      amountCents
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
         style={{ background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full sm:max-w-lg slide-up"
           style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>

        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--text3)' }} />
        </div>

        <div className="px-5 pt-4 pb-4 border-b flex items-start gap-4"
             style={{ borderColor: 'var(--border)' }}>
          <div className="w-14 h-20 rounded-xl flex items-center justify-center flex-shrink-0 text-4xl"
               style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            {mediaEmoji(media.type)}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="font-black text-base leading-tight mb-1.5" style={{ color: 'var(--text)' }}>
              {media.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="chip chip-cancelled">{typeLabel(media.type)}</span>
              <span className="chip chip-hd">{media.category}</span>
              <span className="text-xs mono" style={{ color: 'var(--text3)' }}>{formatBytes(media.size_bytes)}</span>
            </div>
            {price !== undefined && (
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black" style={{ color: 'var(--accent)' }}>
                  {formatPrice(price)}
                </span>
                {priceTier && (
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>({priceTier.name})</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl transition-colors hover:bg-white/8 flex-shrink-0"
                  style={{ color: 'var(--text3)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[55vh] overflow-y-auto space-y-4">
          {/* Delivery type */}
          <div>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <HardDrive className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              نحوه دریافت
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeliveryType('usb')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors ${
                  deliveryType === 'usb' ? 'border-[var(--accent)] bg-[rgba(232,197,71,.08)]' : 'border-[var(--border)]'
                }`}
                style={{ color: deliveryType === 'usb' ? 'var(--accent)' : 'var(--text2)' }}
              >
                <HardDrive className="w-4 h-4" />
                کپی روی USB
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType('mobile')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors ${
                  deliveryType === 'mobile' ? 'border-[var(--accent)] bg-[rgba(232,197,71,.08)]' : 'border-[var(--border)]'
                }`}
                style={{ color: deliveryType === 'mobile' ? 'var(--accent)' : 'var(--text2)' }}
              >
                <Smartphone className="w-4 h-4" />
                دانلود موبایل
              </button>
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <ShoppingCart className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              نحوه پرداخت
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors ${
                  paymentMode === 'manual' ? 'border-[var(--accent)] bg-[rgba(232,197,71,.08)]' : 'border-[var(--border)]'
                }`}
                style={{ color: paymentMode === 'manual' ? 'var(--accent)' : 'var(--text2)' }}
              >
                <Banknote className="w-4 h-4" />
                پرداخت در میز
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('online')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors ${
                  paymentMode === 'online' ? 'border-[var(--accent)] bg-[rgba(232,197,71,.08)]' : 'border-[var(--border)]'
                }`}
                style={{ color: paymentMode === 'online' ? 'var(--accent)' : 'var(--text2)' }}
              >
                <CreditCard className="w-4 h-4" />
                پرداخت آنلاین
              </button>
            </div>
          </div>

          {/* Drive selector (only for USB) — space is checked inside DriveSelector */}
          {deliveryType === 'usb' && (
            <DriveSelector
              drives={drives}
              selectedDrive={selectedDrive}
              mediaSize={media.size_bytes}
              onSelect={setSelectedDrive}
            />
          )}
          {deliveryType === 'mobile' && (
            <p className="text-xs py-2" style={{ color: 'var(--text3)' }}>
              پس از تأیید ادمین، لینک دانلود برای شما صادر می‌شود.
            </p>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 flex gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-ghost flex-1 py-3">انصراف</button>
          <button onClick={handleConfirm} disabled={!canSubmit}
                  className="btn-primary flex-1 py-3 text-sm">
            <ShoppingCart className="w-4 h-4" />
            {paymentMode === 'manual' ? 'ثبت درخواست' : 'ثبت و پرداخت'}
          </button>
        </div>
      </div>
    </div>
  );
}
