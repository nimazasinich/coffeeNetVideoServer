/**
 * AdminChangePasswordModal v2 — Enterprise Light Theme.
 * Professional UI for changing admin credentials.
 */
import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Lock, Activity } from 'lucide-react';
import { authApi } from '../../lib/api';

export function AdminChangePasswordModal({
  onClose,
  addToast,
}: {
  onClose: () => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (newPass !== confirm) {
      addToast('error', 'رمز تطابق ندارد');
      return;
    }
    if (newPass.length < 6) {
      addToast('error', 'رمز باید حداقل ۶ کاراکتر باشد');
      return;
    }
    setBusy(true);
    try {
      await authApi.changePassword(oldPass, newPass);
      addToast('success', 'رمز عبور تغییر کرد', 'لطفاً برای امنیت بیشتر دوباره وارد شوید');
      onClose();
    } catch (e) {
      addToast('error', 'خطا در تغییر رمز', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isMatching = confirm && confirm === newPass;
  const canSubmit = !busy && oldPass && newPass && isMatching;

  return (
    <div className="space-y-6 adm-animate-in">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 mb-2">
        <ShieldCheck className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
          تغییر رمز عبور باعث خروج تمام نشست‌های فعال از حساب کاربری شما خواهد شد.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--adm-text-muted)] mr-1">رمز عبور فعلی</label>
          <div className="relative group">
            <input
              type={show ? 'text' : 'password'}
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              className="adm-input !h-11 pl-12 focus:ring-amber-500/20"
              placeholder="••••••••"
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)] hover:bg-[var(--adm-surface-muted)] transition-all"
              aria-label={show ? 'مخفی کردن رمز' : 'نمایش رمز'}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--adm-text-muted)] mr-1">رمز عبور جدید</label>
            <input
              type={show ? 'text' : 'password'}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="adm-input !h-11 focus:ring-[var(--adm-primary)]/20"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--adm-text-muted)] mr-1">تأیید رمز جدید</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`adm-input !h-11 transition-all ${
                confirm && !isMatching ? 'border-red-300 bg-red-50 focus:ring-red-500/10' : 'focus:ring-[var(--adm-primary)]/20'
              }`}
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-[var(--adm-border)]">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="adm-btn adm-btn-primary w-full h-12 shadow-lg shadow-[var(--adm-primary)]/20"
        >
          {busy ? <Activity className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          <span>به‌روزرسانی و ثبت نهایی</span>
        </button>
        <button
          onClick={onClose}
          className="adm-btn adm-btn-secondary w-full h-10"
        >
          انصراف
        </button>
      </div>
    </div>
  );
}
