/* SmartCopy Pro — Unified API Client (Merged v4+v6) */
import type {
  Media, Drive, PricingTier, Job, Agent, Settings,
  DashboardSnapshot, DashboardStats, DailyReport, Sale, WSEvent, WSEventType,
} from './types';

const BASE = '';

/* ── Token management ───────────────────────────────────────── */
let AUTH_TOKEN: string | null = null;

export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  if (token) localStorage.setItem('sc_admin_token', token);
  else       localStorage.removeItem('sc_admin_token');
  // Also keep sessionStorage in sync for V6 compatibility
  if (token) sessionStorage.setItem('sc_token', token);
  else       sessionStorage.removeItem('sc_token');
}

export function getStoredToken(): string | null {
  return localStorage.getItem('sc_admin_token') || sessionStorage.getItem('sc_token');
}

/* ── HTTP core ──────────────────────────────────────────────── */
async function req<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = AUTH_TOKEN || getStoredToken();
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('sc:auth:expired'));
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.detail ?? d.message ?? msg; } catch { /**/ }
    throw new Error(msg);
  }
  return res.json();
}

const get  = <T>(p: string, auth = true)           => req<T>('GET',    p, undefined, auth);
const post = <T>(p: string, b: unknown, auth = true) => req<T>('POST',   p, b, auth);
const put  = <T>(p: string, b: unknown, auth = true) => req<T>('PUT',    p, b, auth);
const patch = <T>(p: string, b: unknown, auth = true) => req<T>('PATCH', p, b, auth);

/* ── Public API ─────────────────────────────────────────────── */
export const publicApi = {
  media: (q?: string, cat?: string) =>
    get<{ items: Media[]; total: number }>(
      `/api/media?${new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { category: cat } : {}) }).toString()}`,
      false
    ),
  drives:   () => get<{ drives: Drive[] }>('/api/drives', false),
  pricing:  () => get<{ tiers: PricingTier[] }>('/api/pricing', false),
  createJob: (payload: {
    media_id: string; drive_id?: string | null;
    delivery_type: string; payment_mode: string; amount_cents?: number;
  }) => post<{ job_id: string }>('/api/jobs', payload, false),
};

export const mediaApi = {
  list: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search)   qs.set('search',   params.search);
    return get<{ items: Media[]; total: number }>(`/api/media${qs.toString() ? '?' + qs : ''}`, false);
  },
  get:      (id: string) => get<Media>(`/api/media/${encodeURIComponent(id)}`, false),
  featured: () => get<{ items: unknown[] }>('/api/featured', false),
};

export const driveApi = {
  list: () => get<{ drives: Drive[] }>('/api/drives', false),
};

export const jobsApi = {
  list:   (all = false) => get<{ jobs: Job[] }>(`/api/jobs${all ? '?all=true' : ''}`, false),
  get:    (id: string)  => get<Job>(`/api/jobs/${encodeURIComponent(id)}`, false),
  create: (mediaId: string, driveId: string | null, deliveryType?: string, paymentMode?: string) =>
    post<Job>('/api/jobs', {
      media_id: mediaId, drive_id: driveId ?? undefined,
      delivery_type: deliveryType ?? 'usb', payment_mode: paymentMode ?? 'manual',
    }, false),
  cancel: (id: string) => req<{ status: string; job_id: string }>('DELETE', `/api/jobs/${encodeURIComponent(id)}`, undefined, false),
};

/* ── Auth API ───────────────────────────────────────────────── */
export const authApi = {
  login: (username: string, password: string) =>
    post<{ access_token: string; expires_in?: number }>('/api/admin/login', { username, password }, false),
  changePassword: (oldPassword: string, newPassword: string) =>
    post<{ status: string }>('/api/admin/change-password', { old_password: oldPassword, new_password: newPassword }),
};

/* ── Admin API ──────────────────────────────────────────────── */
export const adminApi = {
  /* Auth */
  login: (username: string, password: string) => authApi.login(username, password),

  /* Dashboard */
  dashboard:  () => get<DashboardSnapshot>('/api/dashboard/overview'),
  stats:      () => get<DashboardStats>('/api/dashboard/overview'),
  throughput: (minutes = 30) =>
    get<{ series: { minute: string; bytes: number }[] }>(`/api/dashboard/throughput?minutes=${minutes}`),

  /* Jobs */
  jobs:     (status?: string) => get<{ jobs: Job[] }>(`/api/admin/jobs${status ? `?status=${status}` : ''}`),
  queue:    ()                => get<{ jobs: Job[] }>('/api/admin/jobs'),
  approveJob: (id: string, opts?: { delivery_type?: string; payment_mode?: string; priority?: number }) =>
    post<void>(`/api/admin/jobs/${id}/approve`, opts ?? {}),
  denyJob:    (id: string) => post<void>(`/api/admin/jobs/${id}/cancel`, {}),
  cancelJob:  (id: string) => post<{ status: string }>(`/api/admin/jobs/${encodeURIComponent(id)}/cancel`, {}),
  confirmPayment: (id: string, ref?: string) =>
    post<void>(`/api/admin/jobs/${id}/confirm-payment`, { payment_ref: ref }),
  setJobPriority: (id: string, priority: number) =>
    post<void>(`/api/admin/jobs/${id}/priority`, { priority }),

  /* Agents */
  agents:       () => get<{ agents: Agent[]; online_count?: number }>('/api/admin/agents'),
  approveAgents: (agentIds: string[], status: 'approved' | 'denied') =>
    post<unknown>('/api/agent/approve', { agent_ids: agentIds, status }),
  setMasterAgent: (agentId: string | null) =>
    post<unknown>('/api/agent/set-master', { agent_id: agentId }),

  /* Media */
  adminMedia:         () => get<{ media: Media[]; total: number }>('/api/admin/media'),
  scan:               () => post<{ status: string; files_found: number }>('/api/admin/media/scan', {}),
  mediaRescan:        () => post<void>('/api/admin/media/scan', {}),
  updateMediaCopyable: (mediaId: string, isCopyable: boolean) =>
    patch<{ status: string }>(`/api/admin/media/${encodeURIComponent(mediaId)}/copyable`, { is_copyable: isCopyable }),

  /* Pricing */
  pricing:       () => get<{ tiers: PricingTier[] }>('/api/admin/pricing'),
  updatePricing: (tiers: Omit<PricingTier, 'id'>[]) =>
    put<{ status: string }>('/api/admin/pricing', { tiers }),

  /* Sales & Reports */
  sales:   (date?: string) => get<{ sales: Sale[] }>(`/api/admin/sales${date ? `?date=${date}` : ''}`),
  reports: (days = 30)     => get<{ reports: DailyReport[] }>(`/api/admin/reports/daily?days=${days}`),

  /* Settings */
  settings:      () => get<{ settings: Settings | Record<string, string> }>('/api/admin/settings'),
  getSettings:   () => get<Record<string, unknown>>('/api/admin/settings'),
  updateSetting: (key: string, value: string) => put<void>('/api/admin/settings', { key, value }),
  updateSettings: (data: Record<string, unknown>) => put<{ status: string }>('/api/admin/settings', data),

  /* QR */
  qr: () => get<{ resolved_base_url: string; qr_image_base64: string; ip_changed?: boolean; current_ip?: string }>('/api/admin/qr'),

  /* License */
  license:       () => get<unknown>('/api/admin/license'),
  uploadLicense: (key: string) => post<{ status: string }>('/api/admin/license', { license_key: key }),
};

/* ── WebSocket Manager ──────────────────────────────────────── */
type WSListener = (event: WSEvent) => void;

class SmartCopyWebSocket {
  private ws:             WebSocket | null = null;
  private listeners:      Map<WSEventType | '*', Set<WSListener>> = new Map();
  private reconnectDelay: number = 1000;
  private pingInterval:   ReturnType<typeof setInterval> | null = null;
  private connected:      boolean = false;

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws/jobs`);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit({ event: 'state.init', payload: {} } as WSEvent);
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
      }, 20_000);
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try { this.emit(JSON.parse(e.data as string) as WSEvent); } catch { /**/ }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.emit({ event: 'state.init', payload: { disconnected: true } } as WSEvent);
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => this.ws?.close();
  }

  on(eventType: WSEventType | '*', listener: WSListener): () => void {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
    this.listeners.get(eventType)!.add(listener);
    return () => this.listeners.get(eventType)?.delete(listener);
  }

  private emit(event: WSEvent): void {
    this.listeners.get(event.event)?.forEach(l => l(event));
    this.listeners.get('*')?.forEach(l => l(event));
  }

  get isConnected(): boolean { return this.connected; }
  disconnect(): void { if (this.pingInterval) clearInterval(this.pingInterval); this.ws?.close(); }
}

export const wsClient = new SmartCopyWebSocket();
