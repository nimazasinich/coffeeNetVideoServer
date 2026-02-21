import React from 'react';
/**
 * SystemStatusBar v3 — Enterprise Light Theme Refactor.
 * Unified live status strip for admin overview.
 */
import { Globe, Zap, CheckCircle, Cpu, Activity, Server, ListOrdered } from 'lucide-react';
import type { DashboardStats } from '../lib/types';

interface StatusItem {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  color: string;
  ok: boolean;
  warn?: boolean;
  pulse?: boolean;
}

export function SystemStatusBar({
  stats,
  loading,
}: {
  stats: DashboardStats | null;
  loading?: boolean;
}) {
  const successRate =
    stats && stats.copies_today + stats.failures_today > 0
      ? Math.round((stats.copies_today / (stats.copies_today + stats.failures_today)) * 100)
      : 100;

  const queueDepth   = stats?.queue_depth ?? 0;
  const activeWorkers = stats?.active_workers ?? 0;
  const agentsOnline  = stats?.agents_online ?? 0;
  const wsConn        = stats?.ws_connections ?? 0;

  const queueColor =
    queueDepth > 50 ? 'var(--adm-danger)' :
    queueDepth > 20 ? 'var(--adm-warning)' :
    'var(--adm-success)';

  const successColor =
    successRate >= 90 ? 'var(--adm-success)' :
    successRate >= 70 ? 'var(--adm-warning)' :
    'var(--adm-danger)';

  const items: StatusItem[] = [
    {
      icon: Globe,
      label: 'اتصال WS',
      value: wsConn,
      color: wsConn > 0 ? 'var(--adm-primary)' : 'var(--adm-text-muted)',
      ok: true,
      pulse: wsConn > 0,
    },
    {
      icon: Server,
      label: 'کارگران',
      value: `${activeWorkers} فعال`,
      color: activeWorkers > 0 ? 'var(--adm-success)' : 'var(--adm-text-muted)',
      ok: true,
      pulse: activeWorkers > 0,
    },
    {
      icon: ListOrdered,
      label: 'عمق صف',
      value: `${queueDepth} کار`,
      color: queueColor,
      ok: queueDepth < 20,
      warn: queueDepth >= 20 && queueDepth < 50,
    },
    {
      icon: CheckCircle,
      label: 'نرخ موفقیت',
      value: `${successRate}٪`,
      color: successColor,
      ok: successRate >= 90,
    },
    {
      icon: Cpu,
      label: 'عامل‌ها',
      value: `${agentsOnline} آنلاین`,
      color: agentsOnline > 0 ? 'var(--adm-secondary)' : 'var(--adm-danger)',
      ok: agentsOnline > 0,
    },
  ];

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 w-36 rounded-2xl bg-[var(--adm-surface-subtle)] animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-wrap">
      {items.map(({ icon: Icon, label, value, color, ok, warn, pulse }) => {
        return (
          <div
            key={label}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-[var(--adm-border)] bg-white shadow-sm flex-shrink-0 hover:shadow-md transition-all group"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative transition-transform group-hover:scale-110"
              style={{ background: `${color}10`, color: color }}
            >
              <Icon className="w-4 h-4" />
              {pulse && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse"
                  style={{ background: color }}
                />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--adm-text-muted)] mb-0.5">
                {label}
              </p>
              <p className="text-xs font-bold tabular-nums text-[var(--adm-text-main)]">
                {value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
