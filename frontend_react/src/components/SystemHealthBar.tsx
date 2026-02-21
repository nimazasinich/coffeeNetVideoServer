import React from 'react';
/**
 * SystemHealthBar — Compact top strip with live system vitals.
 * Shows: WS connections · Active workers · Queue depth · Agents online.
 * Color-coded by health threshold. Non-destructive new component.
 */
import { Globe, Cpu, ListOrdered, Server } from 'lucide-react';
import type { DashboardStats } from '../lib/types';

function Pill({
  icon: Icon,
  label,
  value,
  ok,
  warn,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  ok?: boolean;
  warn?: boolean;
}) {
  const color = ok === false || warn ? (ok === false ? 'var(--red)' : 'var(--orange)') : 'var(--green)';
  const bg    = ok === false || warn ? (ok === false ? 'rgba(255,77,109,.08)' : 'rgba(255,124,77,.08)') : 'rgba(62,207,142,.08)';
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold"
      style={{ background: bg, border: `1px solid ${color}22` }}
    >
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <span style={{ color: 'var(--text2)' }}>{label}</span>
      <span className="font-black" style={{ color }}>{value}</span>
    </div>
  );
}

export function SystemHealthBar({
  stats,
  loading,
}: {
  stats: DashboardStats | null;
  loading?: boolean;
}) {
  if (loading || !stats) {
    return (
      <div className="flex gap-2 flex-wrap mb-6">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-8 w-28 rounded-xl" />)}
      </div>
    );
  }

  const queueDepth = stats.queue_depth ?? 0;

  return (
    <div className="flex flex-wrap gap-2 mb-6 fade-in-up">
      <Pill
        icon={Globe}
        label="اتصال زنده"
        value={`${stats.ws_connections ?? 0}`}
        ok={true}
      />
      <Pill
        icon={Server}
        label="Workers"
        value={`${stats.active_workers ?? 0} فعال`}
        ok={true}
      />
      <Pill
        icon={ListOrdered}
        label="صف"
        value={`${queueDepth} کار`}
        ok={queueDepth < 20}
        warn={queueDepth >= 20 && queueDepth < 50}
      />
      <Pill
        icon={Cpu}
        label="عامل‌ها"
        value={`${stats.agents_online ?? 0} آنلاین`}
        ok={(stats.agents_online ?? 0) > 0}
      />
    </div>
  );
}
