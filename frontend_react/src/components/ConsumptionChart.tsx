/**
 * Consumption Graph — Time series from GET /api/admin/reports/daily.
 * Sparkline + mini chart (copies & revenue). Selectable intervals: 1d (24h), 7d, 30d.
 * No extra chart library; pure SVG.
 */
import { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatPrice } from '../lib/utils';
import type { DailyReport } from '../lib/types';

type Interval = '1' | '7' | '30';

export function ConsumptionChart({
  reports,
  loading,
}: {
  reports: DailyReport[];
  loading?: boolean;
}) {
  const [interval, setInterval] = useState<Interval>('7');

  const { points, maxCopies, maxRevenue } = useMemo(() => {
    const days = Math.min(parseInt(interval, 10), reports.length);
    const slice = reports.slice(0, days).reverse();
    const maxCopies = Math.max(...slice.map((r) => r.total_copies), 1);
    const maxRevenue = Math.max(...slice.map((r) => r.total_revenue), 1);
    return {
      points: slice,
      maxCopies,
      maxRevenue,
    };
  }, [reports, interval]);

  if (loading) {
    return (
      <div className="card p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            مصرف و درآمد
          </h3>
        </div>
        <div className="skeleton h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="card p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            مصرف و درآمد
          </h3>
        </div>
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text3)' }}>
          داده‌ای موجود نیست. از گزارش روزانه سرور استفاده می‌شود.
        </p>
      </div>
    );
  }

  const height = 80;
  const padding = 4;

  return (
    <div
      className="card p-4 rounded-xl"
      style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          مصرف و درآمد
        </h3>
        <div className="flex gap-1">
          {(['1', '7', '30'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setInterval(d)}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                interval === d ? 'opacity-100' : 'opacity-60 hover:opacity-80'
              }`}
              style={{
                background: interval === d ? 'var(--accent)' : 'var(--surface2)',
                color: interval === d ? '#07070d' : 'var(--text2)',
              }}
            >
              {d === '1' ? '۲۴س' : d === '7' ? '۷روز' : '۳۰روز'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Copies sparkline */}
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>
            تعداد کپی
          </p>
          <svg
            viewBox={`0 0 ${Math.max(points.length * 12, 120)} ${height + padding * 2}`}
            className="w-full h-16"
            preserveAspectRatio="none"
          >
            {points.length > 0 && (
              <polyline
                fill="none"
                stroke="var(--blue)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points
                  .map((p, i) => {
                    const x = i * (Math.max(points.length * 12, 120) / Math.max(points.length, 1)) + 8;
                    const y = height + padding - (p.total_copies / maxCopies) * height;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
          </svg>
        </div>
        {/* Revenue sparkline */}
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>
            درآمد
          </p>
          <svg
            viewBox={`0 0 ${Math.max(points.length * 12, 120)} ${height + padding * 2}`}
            className="w-full h-16"
            preserveAspectRatio="none"
          >
            {points.length > 0 && (
              <polyline
                fill="none"
                stroke="var(--green)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points
                  .map((p, i) => {
                    const x = i * (Math.max(points.length * 12, 120) / Math.max(points.length, 1)) + 8;
                    const y = height + padding - (p.total_revenue / maxRevenue) * height;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
          </svg>
        </div>
      </div>

      <div className="mt-3 pt-3 flex justify-between text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text3)' }}>
        <span>کل کپی: {points.reduce((s, r) => s + r.total_copies, 0)}</span>
        <span>کل درآمد: {formatPrice(points.reduce((s, r) => s + r.total_revenue, 0))}</span>
      </div>
    </div>
  );
}
