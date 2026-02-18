export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function calculateProgress(progressBytes: number, totalBytes: number): number {
  if (totalBytes === 0) return 0;
  return Math.round((progressBytes / totalBytes) * 100);
}

export function estimateTimeRemaining(
  progressBytes: number,
  totalBytes: number,
  throughputMbps: number | null
): number | null {
  if (!throughputMbps || throughputMbps === 0) return null;
  const remainingBytes = totalBytes - progressBytes;
  const throughputBps = (throughputMbps * 1024 * 1024) / 8;
  return remainingBytes / throughputBps;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getCategoryBadgeColor(category: string): string {
  switch (category.toUpperCase()) {
    case 'SD':
      return 'bg-gray-100 text-gray-700';
    case 'HD':
      return 'bg-blue-100 text-blue-700';
    case '4K':
      return 'bg-purple-100 text-purple-700';
    case 'SERIES':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
