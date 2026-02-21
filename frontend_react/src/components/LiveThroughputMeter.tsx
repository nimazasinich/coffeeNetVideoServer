/**
 * LiveThroughputMeter v5 — Enterprise Light Theme Refactor.
 * Real-time throughput visualizer for active jobs.
 */
import { Zap, Activity } from 'lucide-react';
import type { Job } from '../lib/types';

export function LiveThroughputMeter({
  jobs,
  loading,
}: {
  jobs: Job[];
  loading?: boolean;
}) {
  const activeJobs = jobs.filter((j) => j.status === 'active');
  const activeWithTp = activeJobs.filter((j) => (j.throughput_mbps ?? 0) > 0);
  const totalMbps  = activeWithTp.reduce((s, j) => s + (j.throughput_mbps ?? 0), 0);
  const maxMbps    = Math.max(...activeWithTp.map((j) => j.throughput_mbps ?? 0), 1);
  const isLive     = activeJobs.length > 0;

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-full bg-[var(--adm-surface-subtle)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--adm-secondary)] opacity-40" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--adm-secondary)] shadow-sm shadow-[var(--adm-secondary)]/50" />
            </div>
          ) : (
            <div className="w-3 h-3 rounded-full bg-[var(--adm-text-muted)] opacity-30" />
          )}
          <span className="text-xs font-bold text-[var(--adm-text-secondary)] uppercase tracking-wider">توان عملیاتی</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black tabular-nums text-[var(--adm-text-main)]">
            {totalMbps.toFixed(1)}
          </span>
          <span className="text-[10px] font-black text-[var(--adm-text-muted)] uppercase">MB/s</span>
        </div>
      </div>

      {activeJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-[var(--adm-text-muted)] opacity-30">
          <Activity className="w-12 h-12 mb-2" />
          <p className="text-xs font-bold">هیچ پردازش فعالی وجود ندارد</p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeJobs.slice(0, 5).map((j) => {
            const tp   = j.throughput_mbps ?? 0;
            const pct  = maxMbps > 0 ? (tp / maxMbps) * 100 : 0;
            const prog = Math.round(j.progress ?? 0);
            
            return (
              <div key={j.id} className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 max-w-[65%]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--adm-secondary)] opacity-50" />
                    <span className="text-xs font-bold text-[var(--adm-text-main)] truncate">
                      {j.media_name || j.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[10px] font-black text-[var(--adm-secondary)]">
                      {tp.toFixed(1)} <span className="text-[8px] opacity-60">MB/s</span>
                    </span>
                    <span className="text-[10px] font-black text-[var(--adm-text-muted)]">{prog}%</span>
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-[var(--adm-surface-muted)] overflow-hidden">
                  {/* Progress Layer */}
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--adm-secondary)]/20 transition-all duration-700"
                    style={{ width: `${prog}%` }}
                  />
                  {/* Throughput Layer */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--adm-secondary)] to-[var(--adm-primary)] rounded-full shadow-[0_0_8px_rgba(14,165,233,0.4)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {activeJobs.length > 5 && (
            <div className="pt-2 text-center">
              <span className="adm-badge !bg-[var(--adm-surface-muted)] !text-[var(--adm-text-muted)]">
                +{activeJobs.length - 5} مورد دیگر در حال اجرا
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
