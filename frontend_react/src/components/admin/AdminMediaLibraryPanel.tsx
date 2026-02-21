import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Scan, Film, Lock, Unlock } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatBytes, formatPrice } from '../../lib/utils';
import type { Media } from '../../lib/types';

export function AdminMediaLibraryPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [items,    setItems   ] = useState<Media[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search,   setSearch  ] = useState('');
  const [filter,   setFilter  ] = useState<'all' | 'movie' | 'series'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.adminMedia();
      setItems(res.media ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await adminApi.scan();
      addToast('success', 'اسکن کامل شد', `${r.files_found} فایل یافت شد`);
      load();
    } catch (e) {
      addToast('error', 'خطا در اسکن', (e as Error).message);
    } finally { setScanning(false); }
  };

  const toggleCopyable = async (item: Media) => {
    try {
      await adminApi.updateMediaCopyable(item.id, !item.is_copyable);
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, is_copyable: !m.is_copyable } : m));
      addToast('success', item.is_copyable ? 'غیرفعال شد' : 'فعال شد', item.name);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter(m => m.type === filter);
    if (search.trim()) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [items, filter, search]);

  const catBadge = (cat: string) => {
    const map: Record<string, string> = {
      '4K': 'bg-purple-50 text-purple-600 border border-purple-100',
      'HD': 'bg-blue-50 text-blue-600 border border-blue-100',
      'SD': 'bg-slate-50 text-slate-600 border border-slate-100',
    };
    return map[cat] ?? 'bg-slate-50 text-slate-600 border border-slate-100';
  };

  return (
    <div className="space-y-6 adm-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--adm-text-main)]">کتابخانه رسانه</h2>
          <p className="text-sm font-medium text-[var(--adm-text-muted)] mt-1">{items.length} فایل در سیستم</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="adm-btn adm-btn-primary"
          >
            <Scan className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'در حال اسکن...' : 'اسکن مجدد'}
          </button>
          <button onClick={load} className="adm-btn adm-btn-secondary"
                  aria-label="بارگذاری مجدد">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="adm-search-container flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--adm-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجوی فیلم یا سریال..."
            className="adm-search-input"
          />
        </div>
        <div className="flex gap-1 p-1 bg-[var(--adm-surface-muted)] border border-[var(--adm-border)] rounded-xl">
          {(['all', 'movie', 'series'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filter === f 
                  ? 'bg-white text-[var(--adm-primary)] shadow-sm border border-[var(--adm-border)]' 
                  : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)]'
              }`}
            >
              {f === 'all' ? 'همه' : f === 'movie' ? 'فیلم' : 'سریال'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="adm-table-container">
        {loading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-[var(--adm-surface-muted)] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-40">
            <Film className="w-16 h-16 mb-4 text-[var(--adm-text-muted)]" />
            <p className="text-sm font-bold text-[var(--adm-text-muted)]">فایلی یافت نشد. اسکن مجدد انجام دهید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="px-6">نام محتوا</th>
                  <th>نوع</th>
                  <th>کیفیت</th>
                  <th>حجم</th>
                  <th>قیمت</th>
                  <th>وضعیت</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 font-bold text-[var(--adm-text-main)] max-w-[280px]">
                      <span className="truncate block" title={m.name}>{m.name}</span>
                    </td>
                    <td>
                      <span className="text-[var(--adm-text-secondary)] font-medium">
                        {m.type === 'series' ? 'سریال' : 'فیلم'}
                      </span>
                    </td>
                    <td>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catBadge(m.category)}`}>
                        {m.category}
                      </span>
                    </td>
                    <td>
                      <span className="text-[var(--adm-text-muted)] text-xs font-mono font-bold">
                        {formatBytes(m.size_bytes)}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm font-bold text-[var(--adm-primary)]">
                        {m.price_usd ? formatPrice(m.price_usd) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`adm-badge ${
                        m.is_copyable ? 'adm-badge-success' : 'adm-badge-error'
                      }`}>
                        {m.is_copyable ? 'فعال' : 'مسدود'}
                      </span>
                    </td>
                    <td className="px-4">
                      <button
                        onClick={() => toggleCopyable(m)}
                        title={m.is_copyable ? 'غیرفعال کردن' : 'فعال کردن'}
                        className={`p-2 rounded-lg transition-all ${
                          m.is_copyable
                            ? 'bg-red-50 text-red-500 hover:bg-red-100'
                            : 'bg-green-50 text-green-500 hover:bg-green-100'
                        }`}
                      >
                        {m.is_copyable ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
