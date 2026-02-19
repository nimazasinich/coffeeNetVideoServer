// ─── Core Domain Types ────────────────────────────────────────────────────────

export type MediaType       = 'movie' | 'series';
export type QualityCategory = 'SD' | 'HD' | '4K';
export type JobStatus       = 'pending' | 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
export type PaymentStatus   = 'pending' | 'confirmed' | 'refunded';
export type AdminRole       = 'admin' | 'operator';
export type DeliveryType    = 'usb' | 'mobile';
export type PaymentMode     = 'manual' | 'online';
export type AgentStatus     = 'pending' | 'approved' | 'denied';

// ─── Media ────────────────────────────────────────────────────────────────────

export interface Media {
  id:          string;
  name:        string;
  size_bytes:  number;
  type:        MediaType;
  category:    QualityCategory;
  is_copyable: boolean;
  added_at:    string;
  extension:   string;
  price_usd?:  number;
}

// ─── Drive ────────────────────────────────────────────────────────────────────

export interface Drive {
  id:             string;
  path:           string;
  label:          string;
  capacity_bytes: number;
  free_bytes:     number;
  is_locked:      boolean;
  locked_by_job?: string | null;
  detected_at:    string;
  updated_at?:    string;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface Job {
  id:              string;
  media_id:        string;
  drive_id:        string;
  status:          JobStatus;
  progress:        number;
  progress_bytes?: number;
  bytes_written?:  number;
  total_bytes:     number;
  throughput_mbps: number | null;
  error_message:   string | null;
  retry_count:     number;
  priority?:       number;
  created_at:      string;
  started_at:      string | null;
  completed_at:    string | null;
  customer_ip:     string | null;
  delivery_type?:  DeliveryType;
  payment_mode?:   PaymentMode;
  media_name?:     string;
  media_size?:     number;
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface Sale {
  id:             string;
  job_id:         string;
  media_id:       string;
  price_charged:  number;
  currency:       string;
  payment_ref:    string | null;
  payment_status: PaymentStatus;
  payment_mode?:  PaymentMode;   // FIX: was missing from original
  timestamp:      string;
  media_name?:    string;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface PricingTier {
  id:          number;
  name:        string;
  max_size_gb: number;
  price_usd:   number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:         number;
  username:   string;
  role:       AdminRole;
  created_at: string;
}

export interface DashboardStats {
  copies_today:   number;
  revenue_today:  number;
  queue_depth:    number;
  media_count:    number;
  failures_today: number;
  active_workers: number;
  ws_connections: number;
  agents_online?: number;
}

export interface Agent {
  id:               string;
  agent_id:         string;
  hostname:         string;
  version:          string;
  drives?:          string | null;
  online:           boolean;
  status?:          AgentStatus;    // FIX: was missing from original
  is_master_agent?: number;         // FIX: was missing from original
  registered_at:    number;
  last_seen?:       number | null;
}

export interface DailyReport {
  date:          string;
  total_copies:  number;
  total_revenue: number;
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export type WSEventType =
  | 'state.init'
  | 'job.created'
  | 'job.started'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'drive.connected'
  | 'drive.disconnected'
  | 'pong';

export interface WSEvent<T = unknown> {
  event:   WSEventType;
  payload: T;
}

export interface JobProgressPayload {
  job_id:          string;
  progress:        number;
  bytes_written:   number;
  total_bytes:     number;
  throughput_mbps: number;
  eta_seconds:     number;
}

export interface StateInitPayload {
  drives: Drive[];
  queue:  Job[];
}
