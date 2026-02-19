import { X, Clock, CheckCircle, XCircle, Loader2, Ban, Zap } from 'lucide-react';
import { getStatusLabel, formatBytes, formatDuration, estimateTimeRemaining } from '../lib/utils';
import type { Job } from '../lib/types';

interface JobQueueProps {
  jobs:     Job[];
  mediaMap: Map<string, string>;
  onCancel: (jobId: string) => void;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':   return <Clock     className="w-4 h-4" style={{ color: '#f5c518' }} />;
    case 'active':    return <Loader2   className="w-4 h-4 animate-spin" style={{ color: 'var(--blue)' }} />;
    case 'completed': return <CheckCircle className="w-4 h-4" style={{ color: 'var(--green)' }} />;
    case 'failed':    return <XCircle   className="w-4 h-4" style={{ color: 'var(--red)' }} />;
    case 'cancelled': return <Ban       className="w-4 h-4" style={{ color: 'var(--text3)' }} />;
    default:          return null;
  }
};

function statusChipClass(status: string) {
  return `chip chip-${status}`;
}

function JobCard({ job, name, onCancel }: { job: Job; name: string; onCancel: () => void }) {
  const pct = job.progress ?? 0;
  const eta = estimateTimeRemaining(job.progress_bytes, job.total_bytes, job.throughput_mbps);
  const canCancel = job.status === 'pending' || job.status === 'active';

  const borderColor = job.status === 'active'    ? 'rgba(74,158,255,.2)'
                    : job.status === 'completed' ? 'rgba(62,207,142,.2)'
                    : job.status === 'failed'    ? 'rgba(255,77,109,.2)'
                    : 'var(--border)';

  return (
    <div className="fade-up rounded-xl p-3 transition-all"
         style={{ background: 'var(--bg3)', border: `1px solid ${borderColor}` }}>

      {/* Top row */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="mt-0.5 flex-shrink-0"><StatusIcon status={job.status} /></div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={statusChipClass(job.status)}>{getStatusLabel(job.status)}</span>
            {job.status === 'active' && job.throughput_mbps != null && (
              <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--blue)' }}>
                <Zap className="w-2.5 h-2.5" />
                {job.throughput_mbps.toFixed(1)} MB/s
              </span>
            )}
          </div>
        </div>

        {canCancel && (
          <button onClick={onCancel}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-red-500/10"
                  style={{ color: 'var(--text3)' }}
                  title="لغو">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar (active) */}
      {job.status === 'active' && (
        <div className="space-y-1.5">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text3)' }}>
            <span className="mono">{pct.toFixed(1)}%</span>
            <span>{formatBytes(job.progress_bytes)} / {formatBytes(job.total_bytes)}</span>
          </div>
          {eta !== null && (
            <p className="text-xs" style={{ color: 'var(--blue)' }}>
              ⏱ {formatDuration(eta)} باقی‌مانده
            </p>
          )}
        </div>
      )}

      {/* Completed */}
      {job.status === 'completed' && (
        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--green)' }}>
          ✅ کپی با موفقیت انجام شد
        </p>
      )}

      {/* Failed */}
      {job.status === 'failed' && job.error_message && (
        <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(255,77,109,.08)', color: 'var(--red)', border: '1px solid rgba(255,77,109,.15)' }}>
          {job.error_message}
        </div>
      )}
    </div>
  );
}

export function JobQueue({ jobs, mediaMap, onCancel }: JobQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center fade-in">
        <div className="text-4xl mb-3 opacity-30">🕐</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>صف خالی است</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>پس از انتخاب فیلم و تأیید، کارها اینجا نمایش داده می‌شوند</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          name={mediaMap.get(job.media_id) ?? job.media_name ?? 'ناشناس'}
          onCancel={() => onCancel(job.id)}
        />
      ))}
    </div>
  );
}
