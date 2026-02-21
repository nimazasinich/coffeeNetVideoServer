/* SmartCopy Pro — Shared TypeScript Types (Merged v4+v6) */

export type MediaType       = 'movie' | 'series';
export type QualityCategory = 'SD' | 'HD' | '4K';
export type DeliveryType    = 'usb' | 'mobile';
export type PaymentMode     = 'manual' | 'online';
export type JobStatus       = 'pending' | 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
export type PaymentStatus   = 'pending' | 'confirmed' | 'refunded';
export type AdminRole       = 'admin' | 'operator';
export type AgentStatus     = 'online' | 'offline' | 'pending' | 'approved' | 'denied';

export interface Media {
  id: string; name: string; size_bytes: number; type: MediaType;
  category: string; is_copyable?: boolean; added_at: string;
  extension: string; price_usd?: number; thumb_url?: string;
}

export interface Drive {
  id: string; path: string; label?: string;
  capacity_bytes?: number; free_bytes?: number;
  is_locked?: boolean; locked_by_job?: string | null; detected_at?: string;
}

export interface PricingTier { id: number | string; name: string; max_size_gb: number; price_usd: number; }

export interface Job {
  id: string; media_id?: string; media_name?: string; media_size_gb?: number; media_size?: number;
  status: JobStatus; delivery_type?: DeliveryType; payment_mode?: PaymentMode; payment_status?: string;
  progress?: number; progress_pct?: number; progress_bytes?: number; bytes_written?: number;
  total_bytes?: number; speed_mbps?: number; throughput_mbps?: number | null;
  error_message?: string | null; drive_id?: string; price_usd?: number; elapsed_s?: number;
  started_at?: string | null; created_at?: string; completed_at?: string | null;
  priority?: number; retry_count?: number; customer_ip?: string | null;
}

export interface Sale {
  id: string; job_id: string; media_id: string; price_charged: number; currency: string;
  payment_ref: string | null; payment_status: PaymentStatus; payment_mode?: PaymentMode;
  timestamp: string; media_name?: string;
}

export interface Agent {
  agent_id: string; id?: string; hostname: string; status?: AgentStatus; online?: boolean;
  last_seen?: string | number | null; drives_count?: number; jobs_active?: number;
  version?: string; ip?: string; is_master_agent?: number; registered_at?: number; drives?: string | null;
}

export interface SystemStats {
  cpu_percent: number; ram_percent: number; ram_used_gb: number; ram_total_gb: number;
  disk_percent: number; disk_used_gb: number; disk_total_gb: number;
  uptime_seconds: number; load_avg: number[]; cpu_count: number;
}

export interface DashboardSnapshot {
  timestamp: string; system: SystemStats;
  jobs: {
    active: number; queued: number; pending: number; completed: number;
    failed: number; cancelled: number; today_completed: number;
    today_revenue_usd: number; today_bytes_copied: number;
  };
  agents: Agent[]; active_users: Job[];
}

export interface DashboardStats {
  copies_today: number; revenue_today: number; queue_depth: number;
  media_count: number; failures_today: number; active_workers: number;
  ws_connections: number; agents_online?: number;
}

export interface DailyReport { date: string; total_copies: number; total_revenue: number; }

export type WSEventType =
  | 'state.init' | 'job.created' | 'job.started' | 'job.progress'
  | 'job.completed' | 'job.failed' | 'job.cancelled'
  | 'drive.connected' | 'drive.disconnected' | 'pong';

export interface WSEvent<T = unknown> { event: WSEventType; payload: T; }
export interface ThroughputPoint { t: number; v: number; }
export interface Settings { [key: string]: string; }
export type ToastType = 'success' | 'error' | 'info' | 'warn';
export interface ToastItem { id: string; type: ToastType; title: string; msg?: string; }
