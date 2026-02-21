/* SmartCopy Pro — Utility Functions (Merged v4+v6) */
import type { JobStatus, MediaType } from './types';

export function formatBytes(b: number, decimals = 1): string {
  if (!b || b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export function formatPrice(price: number | undefined, _currency = 'USD'): string {
  if (price === undefined || price === null) return '—';
  if (price === 0) return 'رایگان';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(price);
}

export function formatElapsed(s: number): string {
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  try { return new Date(isoString + (isoString.includes('Z') ? '' : 'Z')).toLocaleString('fa-IR'); }
  catch { return isoString; }
}

export function mediaEmoji(_type: MediaType): string { return ''; }
export function mediaIconType(type: MediaType): 'movie' | 'series' { return type === 'movie' ? 'movie' : 'series'; }
export function typeLabel(type: MediaType): string { return type === 'movie' ? 'Movie' : 'Series'; }

export function getStatusLabel(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    pending: 'Pending', queued: 'Queued', active: 'Active',
    completed: 'Done', failed: 'Failed', cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

export function statusColor(status: JobStatus): string {
  switch (status) {
    case 'active':    return 'var(--blue)';
    case 'completed': return 'var(--green)';
    case 'failed':    return 'var(--red)';
    case 'cancelled': return 'var(--text3)';
    default:          return 'var(--text2)';
  }
}

export function calculateProgress(progressBytes: number, totalBytes: number): number {
  if (totalBytes === 0) return 0;
  return Math.round((progressBytes / totalBytes) * 100);
}

export function estimateTimeRemaining(
  progressBytes: number,
  totalBytes: number,
  throughputMbps: number | null,
): number | null {
  if (!throughputMbps || throughputMbps <= 0 || !totalBytes) return null;
  const remaining = totalBytes - progressBytes;
  const throughputBps = throughputMbps * 1024 * 1024;
  return remaining / throughputBps;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function uid(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export function getStatusChipClass(status: string): string {
  const map: Record<string, string> = {
    active:    'chip chip-active',
    pending:   'chip chip-pending',
    queued:    'chip chip-pending',
    completed: 'chip chip-completed',
    failed:    'chip chip-failed',
    cancelled: 'chip',
  };
  return map[status] ?? 'chip';
}
