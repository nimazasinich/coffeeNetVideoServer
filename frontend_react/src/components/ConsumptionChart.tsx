/**
 * Consumption Chart v4 — Time series from GET /api/admin/reports/daily.
 * Enterprise Light Theme Refactor.
 */
import { useState, useMemo, useId } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatPrice } from '../lib/utils';
import type { DailyReport } from '../lib/types';

type Interval = '1' | '7' | '30';

function Sparkline({
  data,
  max,
  color,
  gradientId,
  height = 80,
}: {
  data: number[];
  max: number;
  color: string;
  gradientId: string;
  height?: number;
}) {
  const w = 300;
  const pad = 4;
  const n = data.length;
  if (n < 2) return null;

  const xStep = (w - pad * 2) / (n - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * xStep;
    const y = height + pad - ((v / (max || 1)) * height);
    return `${x},${y}`;
  });
  const polyPoints = pts.join(' ');
  const areaPath = `M${pad},${height + pad} ` + pts.join(' L') + ` L${pad + (n - 1) * xStep},${height + pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height + pad * 2}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyPoints}
      />
    </svg>
  );
}

export function ConsumptionChart({
  reports,
  loading,
}: {
  reports: DailyReport[];
  loading?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const [interval, setInterval] = useState<Interval>('7');

  const { points, maxCopies, maxRevenue, copyTrend, revTrend } = useMemo(() => {
    const days = Math.min(parseInt(interval, 10), reports.length);
    const slice = reports.slice(0, days).reverse();
    const maxCopies  = Math.max(...slice.map((r) => r.total_copies), 1);
    const maxRevenue = Math.max(...slice.map((r) => r.total_revenue), 1);

    const half = Math.floor(slice.length / 2);
    const sumLast  = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const first = slice.slice(0, half);
    const last  = slice.slice(half);
    const trendPct = (a: DailyReport[], b: DailyReport[], key: keyof DailyReport) => {
      const va = sumLast(a.map((r) => r[key] as number));
      const vb = sumLast(b.map((r) => r[key] as number));
      if (va === 0) return 0;
      return Math.round(((vb - va) / va) * 100);
    };

    return {
      points: slice,
      maxCopies,
      maxRevenue,
      copyTrend: trendPct(first, last, 'total_copies'),
      revTrend:  trendPct(first, last, 'total_revenue'),
    };
  }, [reports, interval]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-[var(--adm-border)] rounded-full animate-pulse" />
        <div className="h-48 w-full bg-[var(--adm-surface-subtle)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--adm-text-muted)] opacity-50">
        <TrendingUp className="w-12 h-12 mb-4" />
        <p className="text-sm font-bold">داده‌ای برای نمایش نمودار یافت نشد</p>
      </div>
    );
  }

  const TrendIcon = (t: number) => t > 0 ? TrendingUp : t < 0 ? TrendingDown : Minus;
  const trendColor = (t: number) => t > 0 ? 'var(--adm-success)' : t < 0 ? 'var(--adm-danger)' : 'var(--adm-text-muted)';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--adm-primary)]" />
          <span className="text-xs font-bold text-[var(--adm-text-secondary)] uppercase tracking-wider">تحلیل دوره‌ای</span>
        </div>
        <div className="flex gap-1 bg-[var(--adm-surface-muted)] p-1 rounded-xl border border-[var(--adm-border)]">
          {(['1', '7', '30'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setInterval(d)}
              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                interval === d
                  ? 'bg-white text-[var(--adm-primary)] shadow-sm border border-[var(--adm-border)]'
                  : 'text-[var(--adm-text-muted)] hover:text-[var(--adm-text-main)]'
              }`}
            >
              {d === '1' ? '۲۴س' : d === '7' ? '۷روز' : '۳۰روز'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Copies chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-[var(--adm-text-muted)]">تعداد کپی</p>
              <p className="text-xl font-bold text-[var(--adm-text-main)] tabular-nums">
                {points.reduce((s, r) => s + r.total_copies, 0)}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold`} style={{ background: `${trendColor(copyTrend)}15`, color: trendColor(copyTrend) }}>
              {(() => { const T = TrendIcon(copyTrend); return <T className="w-3 h-3" />; })()}
              <span>{copyTrend > 0 ? '+' : ''}{copyTrend}٪</span>
            </div>
          </div>
          <div className="h-28 bg-[var(--adm-surface-subtle)]/30 rounded-2xl overflow-hidden p-2">
            <Sparkline
              data={points.map((p) => p.total_copies)}
              max={maxCopies}
              color="var(--adm-primary)"
              gradientId={`${uid}-copies`}
              height={100}
            />
          </div>
        </div>

        {/* Revenue chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-[var(--adm-text-muted)]">درآمد کل</p>
              <p className="text-xl font-bold text-[var(--adm-text-main)] tabular-nums">
                {formatPrice(points.reduce((s, r) => s + r.total_revenue, 0))}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold`} style={{ background: `${trendColor(revTrend)}15`, color: trendColor(revTrend) }}>
              {(() => { const T = TrendIcon(revTrend); return <T className="w-3 h-3" />; })()}
              <span>{revTrend > 0 ? '+' : ''}{revTrend}٪</span>
            </div>
          </div>
          <div className="h-28 bg-[var(--adm-surface-subtle)]/30 rounded-2xl overflow-hidden p-2">
            <Sparkline
              data={points.map((p) => p.total_revenue)}
              max={maxRevenue}
              color="var(--adm-success)"
              gradientId={`${uid}-revenue`}
              height={100}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center text-[9px] font-bold text-[var(--adm-text-muted)] pt-4 border-t border-[var(--adm-border)]/50">
        <span>{points[0]?.date ?? ''}</span>
        <span className="bg-[var(--adm-surface-muted)] px-2 py-0.5 rounded-full">{points.length} روز گزارش</span>
        <span>{points[points.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}
