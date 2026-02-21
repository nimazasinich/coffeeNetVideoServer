/**
 * AdminQrQuickView v2 — Enterprise Light Theme.
 * High-contrast QR display for terminal connections.
 */
import { useState, useEffect } from 'react';
import { RefreshCw, QrCode, Monitor, Info } from 'lucide-react';
import { adminApi } from '../../lib/api';

export function AdminQrQuickView() {
  const [data, setData] = useState<{ qr_image_base64?: string; resolved_base_url?: string; current_ip?: string } | null>(null);
  
  useEffect(() => { 
    adminApi.qr().then(setData).catch(() => setData(null)); 
  }, []);

  if (!data)
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-[var(--adm-primary)]" />
        <p className="text-xs font-bold text-[var(--adm-text-muted)]">در حال تولید کد اتصال...</p>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-8 adm-animate-in">
      <div className="relative group">
        <div className="absolute -inset-4 bg-[var(--adm-primary)]/5 rounded-[40px] blur-xl group-hover:bg-[var(--adm-primary)]/10 transition-all" />
        <div className="relative p-6 bg-white rounded-[32px] shadow-2xl border border-[var(--adm-border)]">
          {data.qr_image_base64 ? (
            <img src={data.qr_image_base64} alt="Connection QR" className="w-56 h-56" />
          ) : (
            <div className="w-56 h-56 flex flex-col items-center justify-center text-[var(--adm-text-muted)] opacity-20">
              <QrCode className="w-20 h-20" />
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--adm-text-muted)] mr-1">آدرس مستقیم اتصال</label>
          <div className="p-4 bg-[var(--adm-surface-muted)] border border-[var(--adm-border)] rounded-2xl font-mono text-xs text-[var(--adm-primary)] break-all text-center leading-relaxed">
            {data.resolved_base_url}
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-[var(--adm-text-muted)]" />
            <span className="text-[10px] font-bold text-[var(--adm-text-secondary)]">IP فعلی سرور:</span>
            <span className="text-[10px] font-black text-[var(--adm-text-main)] tabular-nums">{data.current_ip || '127.0.0.1'}</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--adm-success)]">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span className="text-[10px] font-black uppercase">Ready</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium text-blue-800 leading-relaxed">
            مشتریان می‌توانند با اسکن این کد توسط اپلیکیشن کلاینت یا وارد کردن آدرس فوق در مرورگر، به کتابخانه رسانه متصل شوند.
          </p>
        </div>
      </div>
    </div>
  );
}
