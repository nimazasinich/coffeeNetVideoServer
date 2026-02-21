import { useState, useEffect } from 'react';
import { Save, RefreshCw, Settings, Shield, Zap, Globe, Database, HardDrive, Bell } from 'lucide-react';
import { adminApi } from '../../lib/api';

export function AdminSettingsPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (e) {
      addToast('error', 'خطا در بارگذاری تنظیمات', (e as Error).message);
    } finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSettings(settings);
      addToast('success', 'تنظیمات با موفقیت ذخیره شد');
    } catch (e) {
      addToast('error', 'خطا در ذخیره تنظیمات', (e as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-[var(--adm-primary)]/20 border-t-[var(--adm-primary)] rounded-full animate-spin" />
        <p className="text-sm font-bold text-[var(--adm-text-muted)]">در حال بارگذاری پیکربندی سیستم...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-10 adm-animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--adm-primary)]/10 text-[var(--adm-primary)] flex items-center justify-center shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--adm-text-main)]">تنظیمات هسته مرکزی</h2>
            <p className="text-xs font-medium text-[var(--adm-text-muted)] mt-1">
              مدیریت پارامترهای عملیاتی، محدودیت‌های امنیتی و رفتارهای خودکار سیستم
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={fetchSettings}
            className="adm-btn adm-btn-secondary h-11 px-4"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            type="submit" 
            disabled={saving}
            className="adm-btn adm-btn-primary h-11 px-6"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>ذخیره تغییرات</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Engine Settings */}
        <div className="adm-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--adm-warning)]" />
            <h3 className="text-sm font-bold text-[var(--adm-text-main)]">عملکرد و پردازش</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">حداکثر عملیات همزمان</label>
              <input
                type="number"
                className="adm-input"
                value={settings?.max_concurrent_jobs || 5}
                onChange={e => setSettings({ ...settings, max_concurrent_jobs: parseInt(e.target.value) })}
              />
              <p className="text-[10px] text-[var(--adm-text-muted)]">تعداد پردازش‌هایی که به صورت موازی توسط گره‌ها انجام می‌شود.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">اولویت‌بندی خودکار</label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-subtle)]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-primary)] focus:ring-[var(--adm-primary)]"
                  checked={settings?.auto_prioritize || false}
                  onChange={e => setSettings({ ...settings, auto_prioritize: e.target.checked })}
                />
                <span className="text-xs font-medium text-[var(--adm-text-main)]">فعال‌سازی هوش مصنوعی اولویت‌بندی</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access */}
        <div className="adm-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--adm-danger)]" />
            <h3 className="text-sm font-bold text-[var(--adm-text-main)]">امنیت و دسترسی</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">مدت زمان اعتبار نشست (ساعت)</label>
              <input
                type="number"
                className="adm-input"
                value={settings?.session_timeout || 24}
                onChange={e => setSettings({ ...settings, session_timeout: parseInt(e.target.value) })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">تایید اجباری گره‌های جدید</label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-subtle)]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-primary)] focus:ring-[var(--adm-primary)]"
                  checked={settings?.require_agent_approval !== false}
                  onChange={e => setSettings({ ...settings, require_agent_approval: e.target.checked })}
                />
                <span className="text-xs font-medium text-[var(--adm-text-main)]">گره‌های ناشناس نیاز به تایید مدیر دارند</span>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Policies */}
        <div className="adm-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[var(--adm-secondary)]" />
            <h3 className="text-sm font-bold text-[var(--adm-text-main)]">سیاست‌های ذخیره‌سازی</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">حداقل فضای آزاد مجاز (گیگابایت)</label>
              <input
                type="number"
                className="adm-input"
                value={settings?.min_free_space_gb || 2}
                onChange={e => setSettings({ ...settings, min_free_space_gb: parseInt(e.target.value) })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">پاکسازی خودکار گزارشات قدیمی</label>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-subtle)]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[var(--adm-border)] text-[var(--adm-primary)] focus:ring-[var(--adm-primary)]"
                  checked={settings?.auto_cleanup_logs || false}
                  onChange={e => setSettings({ ...settings, auto_cleanup_logs: e.target.checked })}
                />
                <span className="text-xs font-medium text-[var(--adm-text-main)]">گزارشات بیش از ۳۰ روز حذف شوند</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Notifications */}
        <div className="adm-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--adm-primary)]" />
            <h3 className="text-sm font-bold text-[var(--adm-text-main)]">اطلاع‌رسانی سیستم</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">آدرس وب‌هوک اعلان‌ها</label>
              <input
                type="text"
                className="adm-input font-mono text-left"
                dir="ltr"
                placeholder="https://hooks.slack.com/..."
                value={settings?.webhook_url || ''}
                onChange={e => setSettings({ ...settings, webhook_url: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--adm-text-secondary)]">سطح گزارش‌دهی</label>
              <select 
                className="adm-input"
                value={settings?.log_level || 'INFO'}
                onChange={e => setSettings({ ...settings, log_level: e.target.value })}
              >
                <option value="DEBUG">DEBUG (بسیار جزئی)</option>
                <option value="INFO">INFO (استاندارد)</option>
                <option value="WARNING">WARNING (هشدارها)</option>
                <option value="ERROR">ERROR (فقط خطاها)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
