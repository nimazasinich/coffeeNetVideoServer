// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
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

export function formatPrice(price: number | undefined, currency = 'USD'): string {
  if (price === undefined || price === null) return '—';
  if (price === 0) return 'رایگان';
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString + 'Z').toLocaleString('fa-IR');
  } catch {
    return isoString;
  }
}

// ─── Calculations ─────────────────────────────────────────────────────────────

export function calculateProgress(progressBytes: number, totalBytes: number): number {
  if (totalBytes === 0) return 0;
  return Math.round((progressBytes / totalBytes) * 100);
}

export function estimateTimeRemaining(
  progressBytes: number,
  totalBytes:    number,
  throughputMbps: number | null
): number | null {
  if (!throughputMbps || throughputMbps === 0) return null;
  const remainingBytes = totalBytes - progressBytes;
  const throughputBps  = throughputMbps * 1_048_576;
  return remainingBytes / throughputBps;
}

// ─── Status & Category Styles ─────────────────────────────────────────────────

export function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    pending:   'status-pending',
    active:    'status-active',
    completed: 'status-completed',
    failed:    'status-failed',
    cancelled: 'status-cancelled',
  };
  return map[status] ?? 'status-cancelled';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:   'در انتظار',
    active:    'در حال کپی',
    completed: 'کامل شد',
    failed:    'خطا',
    cancelled: 'لغو شد',
  };
  return map[status] ?? status;
}

export function getCategoryBadgeClass(category: string): string {
  const map: Record<string, string> = {
    SD:     'bg-gray-500/20 text-gray-300',
    HD:     'bg-blue-500/20 text-blue-300',
    '4K':   'bg-purple-500/20 text-purple-300',
    SERIES: 'bg-green-500/20 text-green-300',
  };
  return map[category.toUpperCase()] ?? 'bg-gray-500/20 text-gray-300';
}

// ─── Security ─────────────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS when inserting into DOM manually. */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sanitize search input: keep only safe chars. */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[^\w\s\-\.\(\)\u0600-\u06FF]/g, '').slice(0, 100);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Human-friendly media type label in Persian. */
export function typeLabel(type: string): string {
  return type === 'series' ? 'سریال' : 'فیلم';
}

/** Returns emoji for a media item. */
export function mediaEmoji(type: string): string {
  return type === 'series' ? '📺' : '🎬';
}

/** Debounce helper — returns a debounced version of fn. */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
