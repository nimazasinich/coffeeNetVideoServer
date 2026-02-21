import { useState } from 'react';
import { X, HardDrive, Smartphone, ShoppingCart, CreditCard, Banknote, CheckCircle } from 'lucide-react';
import { DriveSelector } from './DriveSelector';
import { formatBytes, mediaEmoji, typeLabel } from '../lib/utils';
import { publicApi } from '../lib/api';
import { useSmartCopy } from '../context/SmartCopyContext';
import type { Drive, Media, PricingTier, DeliveryType, PaymentMode } from '../lib/types';
import { Film, Tv2 } from 'lucide-react';
function MediaTypeIcon({ type }: { type: string }) {
  return type === 'movie' ? <Film size={28} aria-hidden /> : <Tv2 size={28} aria-hidden />;
}
import { Overlay } from '../ui/Overlay';

interface Props {
  media:        Media;
  drives:       Drive[];
  pricingTiers: PricingTier[];
  onClose:      () => void;
}

export function CopyModal({ media, drives, pricingTiers, onClose }: Props) {
  const { addToast } = useSmartCopy();
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);
  const [deliveryType,  setDeliveryType]  = useState<DeliveryType>('usb');
  const [paymentMode,   setPaymentMode]   = useState<PaymentMode>('manual');
  const [loading,       setLoading]       = useState(false);
  const [done,          setDone]          = useState(false);

  const sizeGb    = media.size_bytes / (1024 ** 3);
  const priceTier = pricingTiers
    .slice()
    .sort((a, b) => a.max_size_gb - b.max_size_gb)
    .find(t => sizeGb <= t.max_size_gb);
  const price       = priceTier?.price_usd ?? media.price_usd ?? 0;
  const amountCents = Math.round(price * 100);

  const canSubmit =
    deliveryType === 'mobile' ||
    (deliveryType === 'usb' && selectedDrive && (selectedDrive.free_bytes ?? 0) >= media.size_bytes);

  const handleConfirm = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await publicApi.createJob({
        media_id:      media.id,
        drive_id:      deliveryType === 'usb' ? selectedDrive!.id : null,
        delivery_type: deliveryType,
        payment_mode:  paymentMode,
        amount_cents:  amountCents,
      });
      setDone(true);
      addToast('success', 'Request Submitted', `${media.name} added to queue`);
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
      setLoading(false);
    }
  };

  return (
    <Overlay isOpen variant="modal" onClose={onClose} labelledBy="copy-modal-title">

        {done ? (
          /* Success state */
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: '50%',
              background: 'var(--green-dim)',
              border: '1px solid rgba(0,245,160,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px var(--green-glow)',
            }}>
              <CheckCircle size={30} style={{ color: 'var(--green)' }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text1)' }}>Request Submitted</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
              {deliveryType === 'usb' ? 'Keep your drive connected to the device.' : 'Download link will be sent after admin approval.'}
            </p>
            <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 56, height: 80,
                borderRadius: 12,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.2rem',
                flexShrink: 0,
              }}>
                <MediaTypeIcon type={media.type} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 6, lineHeight: 1.3 }}>
                  {media.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className={`chip chip-${media.type}`} style={{ fontSize: 9 }}>{typeLabel(media.type)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono' }}>{formatBytes(media.size_bytes)}</span>
                  {priceTier && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{priceTier.name}</span>}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan)', fontFamily: 'DM Mono' }}>
                  ${price.toFixed(2)}
                </div>
              </div>
              <button className="btn-icon" onClick={onClose} style={{ width: 30, height: 30 }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Delivery type */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <HardDrive size={12} style={{ color: 'var(--blue)' }} />
                  Delivery Method
                </div>
                <div className="toggle-group">
                  <button
                    className={`toggle-option${deliveryType === 'usb' ? ' active' : ''}`}
                    onClick={() => setDeliveryType('usb')}
                  >
                    <HardDrive size={14} /> Copy to USB
                  </button>
                  <button
                    className={`toggle-option${deliveryType === 'mobile' ? ' active' : ''}`}
                    onClick={() => setDeliveryType('mobile')}
                  >
                    <Smartphone size={14} /> Mobile Download
                  </button>
                </div>
              </div>

              {/* Payment mode */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <ShoppingCart size={12} style={{ color: 'var(--blue)' }} />
                  Payment Method
                </div>
                <div className="toggle-group">
                  <button
                    className={`toggle-option${paymentMode === 'manual' ? ' active' : ''}`}
                    onClick={() => setPaymentMode('manual')}
                  >
                    <Banknote size={14} /> Pay at Counter
                  </button>
                  <button
                    className={`toggle-option${paymentMode === 'online' ? ' active' : ''}`}
                    onClick={() => setPaymentMode('online')}
                  >
                    <CreditCard size={14} /> Online Payment
                  </button>
                </div>
              </div>

              {deliveryType === 'usb' && (
                <DriveSelector
                  drives={drives}
                  selectedDrive={selectedDrive}
                  mediaSize={media.size_bytes}
                  onSelect={setSelectedDrive}
                />
              )}
              {deliveryType === 'mobile' && (
                <p style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 12px', background: 'var(--blue-dim)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(77,159,255,0.15)' }}>
                  After admin approval, a download link will be issued to you.
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 10,
            }}>
              <button className="btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ flex: 2, padding: '12px' }}
                disabled={!canSubmit || loading}
                onClick={handleConfirm}
              >
                {loading
                  ? <span className="anim-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                  : <ShoppingCart size={14} />
                }
                {paymentMode === 'manual' ? 'Submit Request' : 'Submit & Pay'}
              </button>
            </div>
          </>
        )}
    </Overlay>
  );
}
