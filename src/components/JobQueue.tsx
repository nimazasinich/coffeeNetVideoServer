import { X, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { calculateProgress, formatBytes, getStatusColor, estimateTimeRemaining, formatDuration } from '../lib/utils';
import type { Database } from '../lib/database.types';

type Job = Database['public']['Tables']['jobs']['Row'];

interface JobQueueProps {
  jobs: Job[];
  mediaMap: Map<string, string>;
  onCancel: (jobId: string) => void;
}

export function JobQueue({ jobs, mediaMap, onCancel }: JobQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">No active jobs</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const progress = calculateProgress(job.progress_bytes, job.total_bytes);
        const timeRemaining = estimateTimeRemaining(
          job.progress_bytes,
          job.total_bytes,
          job.throughput_mbps
        );

        return (
          <div
            key={job.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">
                  {mediaMap.get(job.media_id) || 'Unknown Media'}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(job.status)}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                  {job.status === 'active' && job.throughput_mbps && (
                    <span className="text-xs text-gray-500">
                      {job.throughput_mbps.toFixed(1)} MB/s
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {job.status === 'pending' && <Clock className="w-5 h-5 text-yellow-600" />}
                {job.status === 'active' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                {job.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {job.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                {(job.status === 'pending' || job.status === 'active') && (
                  <button
                    onClick={() => onCancel(job.id)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Cancel job"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>

            {job.status === 'active' && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{progress}% complete</span>
                  <span>
                    {formatBytes(job.progress_bytes)} / {formatBytes(job.total_bytes)}
                  </span>
                </div>
                {timeRemaining !== null && (
                  <div className="text-xs text-gray-500">
                    Est. time remaining: {formatDuration(timeRemaining)}
                  </div>
                )}
              </div>
            )}

            {job.status === 'failed' && job.error_message && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                {job.error_message}
              </div>
            )}

            {job.status === 'completed' && (
              <div className="mt-2 text-sm text-green-600">
                Copy completed successfully
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
