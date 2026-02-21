import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatPrice, formatDateTime } from '../../lib/utils';
import type { Sale, DailyReport } from '../../lib/types';

export function AdminSalesPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [sales,   setSales  ] = useState<Sale[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab    ] = useState<'sales' | 'daily'>('sales');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        adminApi.sales(dateFilter || undefined),
        adminApi.reports(30),
      ]);
      setSales(s.sales ?? []);
      setReports(r.reports ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue   = useMemo(() => sales.reduce((s, x) => s + (x.price_charged || 0), 0), [sales]);
  const confirmedCount = useMemo(() => sales.filter(s => s.payment_status === 'confirmed').length, [sales]);
  const maxRevenue     = useMemo(() => Math.max(...reports.map(r => r.total_revenue), 1), [reports]);
  const maxCopies      = useMemo(() => Math.max(...reports.map(r => r.total_copies), 1), [reports]);

  return (
    <div className="space-y-6 adm-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--adm-text-main)]">فروش و گزارشات</h2>
          <p className="text-sm font-medium text-[var(--adm-text-muted)] mt-1">تاریخچه تراکنش‌ها و آمار روزانه</p>
        </div>
        <button onClick={load} className="adm-btn adm-btn-secondary"
                aria-label="بارگذاری مجدد">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'تعداد کل فروش', value: sales.length, color: 'var(--adm-primary)' },
          { label: 'تراکنش‌های تأیید شده', value: confirmedCount, color: 'var(--adm-success)' },
          { label: 'مجموع درآمد خالص', value: formatPrice(totalRevenue), color: 'var(--adm-secondary)' },
        ].map(k => (
          <div key={k.label} className="adm-card p-5 text-center hover:border-[var(--adm-primary)]/20">
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-[var(--adm-text-muted)] mt-1.5 font-bold uppercase tracking-widest">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs and Date Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-[var(--adm-surface-muted)] border border-[var(--adm-border)] rounded-xl">
          <button
            onClick={() => setTab('sales')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'sales' 
                ? 'bg-white text-[var(--adm-primary)] shadow-sm border border-[var(--adm-border)]' 
                : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)]'
            }`}
          >
            تراکنش‌های انفرادی
          </button>
          <button
            onClick={() => setTab('daily')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'daily' 
                ? 'bg-white text-[var(--adm-primary)] shadow-sm border border-[var(--adm-border)]' 
                : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)]'
            }`}
          >
            خلاصه گزارش روزانه
          </button>
        </div>

        {tab === 'sales' && (
          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="adm-search-input !w-full md:!w-48 !bg-white !border-[var(--adm-border)]"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="adm-btn adm-btn-secondary !py-1 !text-xs">
                حذف فیلتر
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-[var(--adm-surface-muted)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tab === 'sales' ? (
        <div className="adm-table-container">
          <div className="overflow-x-auto">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="px-6">تاریخ و زمان</th>
                  <th>محتوای کپی شده</th>
                  <th>مبلغ دریافتی</th>
                  <th>روش پرداخت</th>
                  <th>وضعیت</th>
                  <th>کد مرجع</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={6} className="py-24">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <ShoppingCart className="w-16 h-16 mb-4 text-[var(--adm-text-muted)]" />
                      <p className="text-sm font-bold text-[var(--adm-text-muted)]">هیچ فروشی در این بازه زمانی ثبت نشده</p>
                    </div>
                  </td></tr>
                ) : sales.map(s => (
                  <tr key={s.id}>
                    <td className="px-6 font-mono text-xs text-[var(--adm-text-secondary)] font-bold">{formatDateTime(s.timestamp)}</td>
                    <td className="font-bold text-[var(--adm-text-main)] max-w-[220px]">
                      <span className="truncate block" title={s.media_name ?? '—'}>{s.media_name ?? '—'}</span>
                    </td>
                    <td className="font-black text-[var(--adm-primary)]">{formatPrice(s.price_charged)}</td>
                    <td className="text-[var(--adm-text-muted)] text-[10px] font-bold uppercase">{s.payment_mode ?? '—'}</td>
                    <td>
                      <span className={`adm-badge ${
                        s.payment_status === 'confirmed' ? 'adm-badge-success' : 'adm-badge-warning'
                      }`}>
                        {s.payment_status === 'confirmed' ? 'تأیید شده' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="text-xs font-mono font-bold text-[var(--adm-text-muted)]">{s.payment_ref ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="adm-table-container">
          <div className="overflow-x-auto">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="px-6">تاریخ شمسی</th>
                  <th>تعداد کپی</th>
                  <th className="w-32">نمودار حجم</th>
                  <th>درآمد کل</th>
                  <th className="w-32">نمودار درآمد</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={5} className="py-24">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <TrendingUp className="w-16 h-16 mb-4 text-[var(--adm-text-muted)]" />
                      <p className="text-sm font-bold text-[var(--adm-text-muted)]">داده‌های گزارش روزانه یافت نشد</p>
                    </div>
                  </td></tr>
                ) : reports.map(r => (
                  <tr key={r.date}>
                    <td className="px-6 font-bold text-[var(--adm-text-main)] tabular-nums">{r.date}</td>
                    <td>
                      <span className="adm-badge adm-badge-info">
                        {r.total_copies} کار
                      </span>
                    </td>
                    <td className="px-4">
                      <div className="h-2 rounded-full bg-[var(--adm-surface-muted)] overflow-hidden">
                        <div className="h-full bg-[var(--adm-primary)] rounded-full transition-all duration-700" style={{ width: `${Math.round((r.total_copies / maxCopies) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="font-black text-[var(--adm-success)]">{formatPrice(r.total_revenue)}</td>
                    <td className="px-4">
                      <div className="h-2 rounded-full bg-[var(--adm-surface-muted)] overflow-hidden">
                        <div className="h-full bg-[var(--adm-success)] rounded-full transition-all duration-700" style={{ width: `${Math.round((r.total_revenue / maxRevenue) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
