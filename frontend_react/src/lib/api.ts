/**
 * SmartCopy API Client
 * Replaces @supabase/supabase-js with a lightweight custom client.
 * Uses native fetch() for REST and native WebSocket for real-time.
 * Zero external dependencies.
 */

import type {
  Media, Drive, Job, PricingTier, Sale,
  DashboardStats, DailyReport, WSEvent, WSEventType, Agent,
} from './types';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = '';   // Same-origin (served by FastAPI)
let   AUTH_TOKEN: string | null = null;

export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  if (token) localStorage.setItem('sc_admin_token', token);
  else       localStorage.removeItem('sc_admin_token');
}

export function getStoredToken(): string | null {
  return localStorage.getItem('sc_admin_token');
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

async function request<T>(
  path:    string,
  options: RequestInit = {},
  auth     = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (auth && AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  const res = await fetch(BASE_URL + path, { ...options, headers });

  if (res.status === 401) {
    setAuthToken(null);
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public Media API ─────────────────────────────────────────────────────────

export const mediaApi = {
  list: (params?: { category?: string; search?: string }): Promise<{ items: Media[]; total: number }> => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search)   qs.set('search',   params.search);
    const query = qs.toString() ? `?${qs}` : '';
    return request(`/api/media${query}`);
  },

  get: (id: string): Promise<Media> =>
    request(`/api/media/${encodeURIComponent(id)}`),

  featured: (): Promise<{ items: any[] }> =>
    request('/api/featured'),
};

// ─── Drive API ────────────────────────────────────────────────────────────────

export const driveApi = {
  list: (): Promise<{ drives: Drive[] }> =>
    request('/api/drives'),
};

// ─── Jobs API ─────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (all = false): Promise<{ jobs: Job[] }> =>
    request(`/api/jobs${all ? '?all=true' : ''}`),

  get: (id: string): Promise<Job> =>
    request(`/api/jobs/${encodeURIComponent(id)}`),

  create: (
    mediaId: string,
    driveId: string | null,
    deliveryType?: 'usb' | 'mobile',
    paymentMode?: 'manual' | 'online'
  ): Promise<Job> => {
    const body: Record<string, unknown> = {
      media_id: mediaId,
      drive_id: driveId ?? undefined,
      delivery_type: deliveryType ?? 'usb',
      payment_mode: paymentMode ?? 'manual',
    };
    return request('/api/jobs', {
      method: 'POST',
      body:   JSON.stringify(body),
    });
  },

  cancel: (id: string): Promise<{ status: string; job_id: string }> =>
    request(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// ─── Public Payment (Stripe checkout for customer) ─────────────────────────────

export const paymentApi = {
  createSession: (
    jobId: string,
    amountCents: number,
    currency = 'USD',
    description = 'SmartCopy Media'
  ): Promise<{ checkout_url: string; session_id: string }> =>
    request('/api/payment/create-session', {
      method: 'POST',
      body:   JSON.stringify({
        job_id:       jobId,
        amount_cents: amountCents,
        currency,
        description,
      }),
    }),
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string): Promise<{ access_token: string; expires_in: number }> =>
    request('/api/admin/login', {
      method: 'POST',
      body:   JSON.stringify({ username, password }),
    }),

  changePassword: (oldPassword: string, newPassword: string): Promise<{ status: string }> =>
    request('/api/admin/change-password', {
      method: 'POST',
      body:   JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }, true),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  dashboard: (): Promise<DashboardStats> =>
    request('/api/admin/dashboard', {}, true),

  queue: (): Promise<{ jobs: Job[]; active_count: number }> =>
    request('/api/admin/queue', {}, true),

  sales: (date?: string): Promise<{ sales: Sale[]; total: number }> =>
    request(`/api/admin/sales${date ? `?date=${date}` : ''}`, {}, true),

  confirmPayment: (jobId: string, txRef?: string): Promise<{ status: string; price_charged: number }> =>
    request('/api/admin/payment/confirm', {
      method: 'POST',
      body:   JSON.stringify({ job_id: jobId, tx_ref: txRef || '' }),
    }, true),

  reports: (days = 30): Promise<{ reports: DailyReport[] }> =>
    request(`/api/admin/reports/daily?days=${days}`, {}, true),

  pricing: (): Promise<{ tiers: PricingTier[] }> =>
    request('/api/admin/pricing', {}, true),

  updatePricing: (tiers: Omit<PricingTier, 'id'>[]): Promise<{ status: string }> =>
    request('/api/admin/pricing', {
      method: 'PUT',
      body:   JSON.stringify({ tiers }),
    }, true),

  adminMedia: (): Promise<{ media: Media[]; total: number }> =>
    request('/api/admin/media', {}, true),

  scan: (): Promise<{ status: string; files_found: number }> =>
    request('/api/admin/media/scan', { method: 'POST' }, true),

  cancelJob: (jobId: string): Promise<{ status: string }> =>
    request(`/api/admin/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' }, true),

  denyJob: (jobId: string): Promise<{ status: string }> =>
    request(`/api/admin/jobs/${encodeURIComponent(jobId)}/deny`, { method: 'POST' }, true),

  setJobPriority: (jobId: string, priority: number): Promise<{ status: string; job_id: string; priority: number }> =>
    request(`/api/admin/jobs/${encodeURIComponent(jobId)}/priority`, {
      method: 'POST',
      body:   JSON.stringify({ priority }),
    }, true),

  agents: (): Promise<{ agents: Agent[]; online_count: number }> =>
    request('/api/admin/agents', {}, true),

  settings: (): Promise<{ settings: Record<string, string> }> =>
    request('/api/admin/settings', {}, true),

  updateSetting: (key: string, value: string): Promise<{ status: string }> =>
    request('/api/admin/settings', {
      method: 'PUT',
      body:   JSON.stringify({ key, value }),
    }, true),

  updateMediaCopyable: (mediaId: string, isCopyable: boolean): Promise<{ status: string }> =>
    request(`/api/admin/media/${encodeURIComponent(mediaId)}/copyable`, {
      method: 'PATCH',
      body:   JSON.stringify({ is_copyable: isCopyable }),
    }, true),

  qr: (): Promise<{ resolved_base_url: string; qr_image_base64: string; ip_changed?: boolean; current_ip?: string }> =>
    request('/api/admin/qr', {}, true),

  license: (): Promise<any> =>
    request('/api/admin/license', {}, true),

  uploadLicense: (key: string): Promise<{ status: string }> =>
    request('/api/admin/license', {
      method: 'POST',
      body:   JSON.stringify({ license_key: key }),
    }, true),

  approveAgents: (agentIds: string[], status: 'approved' | 'denied'): Promise<any> =>
    request('/api/agent/approve', {
      method: 'POST',
      body: JSON.stringify({ agent_ids: agentIds, status }),
    }, true),

  setMasterAgent: (agentId: string | null): Promise<any> =>
    request('/api/agent/set-master', {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    }, true),
};

// ─── WebSocket Manager ────────────────────────────────────────────────────────

type WSListener = (event: WSEvent) => void;

class SmartCopyWebSocket {
  private ws:              WebSocket | null = null;
  private listeners:       Map<WSEventType | '*', Set<WSListener>> = new Map();
  private reconnectDelay:  number = 1000;
  private pingInterval:    ReturnType<typeof setInterval> | null = null;
  private connected:       boolean = false;

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws/jobs`);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit({ event: 'state.init', payload: {} } as WSEvent);

      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send('ping');
        }
      }, 20_000);
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as WSEvent;
        this.emit(event);
      } catch { /* ignore malformed */ }
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
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    // Return unsubscribe fn
    return () => this.listeners.get(eventType)?.delete(listener);
  }

  private emit(event: WSEvent): void {
    this.listeners.get(event.event)?.forEach(l => l(event));
    this.listeners.get('*')?.forEach(l => l(event));
  }

  get isConnected(): boolean { return this.connected; }

  disconnect(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.ws?.close();
  }
}

// Singleton WebSocket client — one connection for the whole app
export const wsClient = new SmartCopyWebSocket();
