import React from 'react';
/**
 * Metric Card — Enterprise Grade KPI display for admin dashboard.
 * v6 — Updated for Light Theme, uses adm-* classes.
 */
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function SparklineBar({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-8 mt-3" aria-hidden="true">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-500"
          style={{
            height: `${Math.max(15, Math.round((v / max) * 100))}%`,
            background: i === data.length - 1 ? 'var(--adm-primary)' : 'var(--adm-border)',
          }}
        />
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  loading,
  trend,
  trendLabel,
  sparkline,
}: {
  label: string;
  value: string | number | undefined;
  icon: React.FC<{ className?: string }>;
  color: string;
  suffix?: string;
  loading?: boolean;
  trend?: number;
  trendLabel?: string;
  sparkline?: number[];
}) {
  const hasTrend = trend !== undefined && trend !== null;
  const isUp   = hasTrend && trend! > 0;
  const isDown = hasTrend && trend! < 0;

  const trendClass = isUp ? 'up' : isDown ? 'down' : '';
  const TrendIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendSign  = isUp ? '+' : '';

  return (
    <div className="adm-card adm-stat-card adm-animate-in">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="adm-stat-label">{label}</span>
          {loading ? (
            <div className="h-9 w-24 bg-[var(--adm-surface-muted)] rounded-md animate-pulse mt-1" />
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="adm-stat-value">
                {value ?? '—'}
              </span>
              {suffix && (
                <span className="text-xs font-semibold text-[var(--adm-text-muted)]">
                  {suffix}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-[var(--adm-border)]"
          style={{
            background: 'white',
            color: color.startsWith('var(') ? color : 'var(--adm-primary)',
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {!loading && (
        <>
          {hasTrend && (
            <div className={`adm-stat-trend ${trendClass} mt-3`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trendSign}{Math.abs(trend!).toFixed(0)}%</span>
              {trendLabel && (
                <span className="text-[var(--adm-text-muted)] font-medium mr-1">{trendLabel}</span>
              )}
            </div>
          )}

          {sparkline && sparkline.length >= 2 && (
            <SparklineBar data={sparkline} color={color} />
          )}
        </>
      )}
    </div>
  );
}

