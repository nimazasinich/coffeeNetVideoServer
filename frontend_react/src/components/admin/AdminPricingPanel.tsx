import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, Check, X, Pencil, Trash2, Tag } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import type { PricingTier } from '../../lib/types';

export function AdminPricingPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [tiers,   setTiers  ] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving ] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<{ name: string; max_size_gb: string; price_usd: string }>({ name: '', max_size_gb: '', price_usd: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.pricing();
      setTiers(r.tiers ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: PricingTier) => {
    setEditing(t.id);
    setEditVals({ name: t.name, max_size_gb: String(t.max_size_gb), price_usd: String(t.price_usd) });
  };

  const saveEdit = () => {
    setTiers(prev => prev.map(t =>
      t.id === editing
        ? { ...t, name: editVals.name, max_size_gb: parseFloat(editVals.max_size_gb), price_usd: parseFloat(editVals.price_usd) }
        : t
    ));
    setEditing(null);
  };

  const addTier = () => {
    const newId = Math.max(0, ...tiers.map(t => t.id)) + 1;
    setTiers(prev => [...prev, { id: newId, name: 'تیر جدید', max_size_gb: 50, price_usd: 5 }]);
    startEdit({ id: newId, name: 'تیر جدید', max_size_gb: 50, price_usd: 5 });
  };

  const removeTier = (id: number) => {
    setTiers(prev => prev.filter(t => t.id !== id));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await adminApi.updatePricing(tiers.map(({ name, max_size_gb, price_usd }) => ({ name, max_size_gb, price_usd })));
      addToast('success', 'تعرفه‌ها ذخیره شدند', `${tiers.length} تیر قیمت‌گذاری به‌روز شد`);
    } catch (e) {
      addToast('error', 'خطا در ذخیره', (e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 adm-animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--adm-text-main)]">تنظیمات قیمت‌گذاری</h2>
          <p className="text-sm font-medium text-[var(--adm-text-muted)] mt-1">تعرفه‌ها بر اساس حجم فایل تعیین می‌شوند</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addTier}
            className="adm-btn adm-btn-secondary"
          >
            <Plus className="w-4 h-4" />
            افزودن تیر جدید
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="adm-btn adm-btn-primary"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'در حال ذخیره...' : 'ذخیره نهایی'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full bg-[var(--adm-surface-muted)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="adm-card p-5 group transition-all hover:border-[var(--adm-primary)]/30">
              {editing === tier.id ? (
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="text-[10px] font-bold text-[var(--adm-text-muted)] uppercase px-1">نام تیر</label>
                    <input
                      value={editVals.name}
                      onChange={e => setEditVals(v => ({ ...v, name: e.target.value }))}
                      className="adm-search-input !bg-white !border-[var(--adm-border)]"
                    />
                  </div>
                  <div className="w-full sm:w-32 space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--adm-text-muted)] uppercase px-1">حداکثر (GB)</label>
                    <input
                      type="number"
                      value={editVals.max_size_gb}
                      onChange={e => setEditVals(v => ({ ...v, max_size_gb: e.target.value }))}
                      className="adm-search-input !bg-white !border-[var(--adm-border)]"
                    />
                  </div>
                  <div className="w-full sm:w-32 space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--adm-text-muted)] uppercase px-1">قیمت (USD)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editVals.price_usd}
                      onChange={e => setEditVals(v => ({ ...v, price_usd: e.target.value }))}
                      className="adm-search-input !bg-white !border-[var(--adm-border)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="p-2.5 rounded-lg bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 transition-all">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => setEditing(null)} className="p-2.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--adm-primary)]/5 border border-[var(--adm-primary)]/10 flex items-center justify-center text-[var(--adm-primary)] font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-[var(--adm-text-main)]">{tier.name}</div>
                    <div className="text-xs font-medium text-[var(--adm-text-muted)] mt-0.5">محدوده حجم: تا {tier.max_size_gb} گیگابایت</div>
                  </div>
                  <div className="text-left ml-4">
                    <div className="text-xl font-black text-[var(--adm-primary)] tabular-nums">{formatPrice(tier.price_usd)}</div>
                    <div className="text-[10px] font-bold text-[var(--adm-text-muted)] uppercase">قیمت پایه</div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEdit(tier)} className="p-2 rounded-lg bg-white border border-[var(--adm-border)] text-[var(--adm-text-secondary)] hover:text-[var(--adm-primary)] hover:border-[var(--adm-primary)] transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeTier(tier.id)} className="p-2 rounded-lg bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {tiers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 opacity-40">
              <Tag className="w-16 h-16 mb-4 text-[var(--adm-text-muted)]" />
              <p className="text-sm font-bold text-[var(--adm-text-muted)]">هیچ تیر قیمتی تعریف نشده. روی «افزودن تیر» کلیک کنید.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
