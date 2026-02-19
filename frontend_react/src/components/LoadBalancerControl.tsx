/**
 * Load Balancer UI — Current concurrency (from settings max_copies_per_session) and slider to propose new value.
 * If backend PUT /api/admin/settings accepts key "max_copies_per_session", apply on confirm; else propose-only with explanation.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sliders } from 'lucide-react';
import { adminApi } from '../lib/api';

const SETTINGS_KEY = 'max_copies_per_session';
const MIN = 1;
const MAX = 16;

export function LoadBalancerControl({
  addToast,
  settingsAvailable = true,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  settingsAvailable?: boolean;
}) {
  const [current, setCurrent] = useState<number>(4);
  const [proposed, setProposed] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!settingsAvailable) return;
    setLoading(true);
    try {
      const res = await adminApi.settings();
      const raw = res.settings?.[SETTINGS_KEY];
      const num = raw ? parseInt(raw, 10) : 4;
      const safe = Math.min(MAX, Math.max(MIN, isNaN(num) ? 4 : num));
      setCurrent(safe);
      setProposed(safe);
    } catch {
      setCurrent(4);
      setProposed(4);
    } finally {
      setLoading(false);
    }
  }, [settingsAvailable]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApply = useCallback(async () => {
    if (!settingsAvailable) {
      addToast('info', 'API موجود نیست', 'Backend API not available. To enable: PUT /api/admin/settings with key max_copies_per_session. Contact ops to apply.');
      return;
    }
    setApplying(true);
    try {
      await adminApi.updateSetting(SETTINGS_KEY, String(proposed));
      setCurrent(proposed);
      addToast('success', 'اعمال شد', `حد همزمانی: ${proposed}`);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally {
      setApplying(false);
    }
  }, [settingsAvailable, proposed, addToast]);

  if (loading) {
    return (
      <div className="card p-4 rounded-xl">
        <div className="skeleton h-6 w-40 mb-3" />
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className="card p-4 rounded-xl"
      style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)' }}
    >
      <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: 'var(--text)' }}>
        <Sliders className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        حد همزمانی کپی
      </h3>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <input
            type="range"
            min={MIN}
            max={MAX}
            value={proposed}
            onChange={(e) => setProposed(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((proposed - MIN) / (MAX - MIN)) * 100}%, var(--bg3) ${((proposed - MIN) / (MAX - MIN)) * 100}%, var(--bg3) 100%)`,
            }}
            aria-label="حد همزمانی"
          />
        </div>
        <span className="text-sm font-bold w-8" style={{ color: 'var(--text)' }}>
          {proposed}
        </span>
        {settingsAvailable ? (
          <button
            type="button"
            className="btn-primary text-xs py-2 px-3 disabled:opacity-50"
            onClick={handleApply}
            disabled={applying || proposed === current}
          >
            {applying ? '...' : 'اعمال'}
          </button>
        ) : (
          <span
            className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400"
            title="Backend API missing — contact ops to apply. PUT /api/admin/settings with key max_copies_per_session."
          >
            فقط پیشنهاد (API ندارد)
          </span>
        )}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
        مقدار فعلی: {current}. حداکثر کار کپی همزمان.
      </p>
    </div>
  );
}
