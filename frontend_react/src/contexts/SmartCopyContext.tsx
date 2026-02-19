import {
  createContext, useContext, useEffect, useReducer,
  useCallback, ReactNode,
} from 'react';
import { mediaApi, driveApi, jobsApi, adminApi, wsClient } from '../lib/api';
import type { Media, Drive, Job, PricingTier, WSEvent, JobProgressPayload, StateInitPayload } from '../lib/types';

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  media:            Media[];
  drives:           Drive[];
  jobs:             Record<string, Job>;  // keyed by id for O(1) updates
  pricingTiers:     PricingTier[];
  selectedCategory: 'all' | 'movie' | 'series';
  searchQuery:      string;
  loading:          boolean;
  error:            string | null;
  wsConnected:      boolean;
}

type Action =
  | { type: 'SET_MEDIA';      payload: Media[]         }
  | { type: 'SET_DRIVES';     payload: Drive[]         }
  | { type: 'SET_JOBS';       payload: Job[]           }
  | { type: 'SET_PRICING';    payload: PricingTier[]   }
  | { type: 'SET_CATEGORY';   payload: State['selectedCategory'] }
  | { type: 'SET_SEARCH';     payload: string          }
  | { type: 'SET_LOADING';    payload: boolean         }
  | { type: 'SET_ERROR';      payload: string | null   }
  | { type: 'SET_WS';         payload: boolean         }
  | { type: 'UPSERT_JOB';     payload: Job             }
  | { type: 'UPDATE_JOB_PROGRESS'; payload: JobProgressPayload }
  | { type: 'UPSERT_DRIVE';   payload: Drive           }
  | { type: 'REMOVE_DRIVE';   payload: string          };

const initial: State = {
  media:            [],
  drives:           [],
  jobs:             {},
  pricingTiers:     [],
  selectedCategory: 'all',
  searchQuery:      '',
  loading:          true,
  error:            null,
  wsConnected:      false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MEDIA':      return { ...state, media:    action.payload };
    case 'SET_DRIVES':     return { ...state, drives:   action.payload };
    case 'SET_JOBS': {
      const jobs: Record<string, Job> = {};
      action.payload.forEach(j => { jobs[j.id] = j; });
      return { ...state, jobs };
    }
    case 'SET_PRICING':    return { ...state, pricingTiers: action.payload };
    case 'SET_CATEGORY':   return { ...state, selectedCategory: action.payload };
    case 'SET_SEARCH':     return { ...state, searchQuery: action.payload };
    case 'SET_LOADING':    return { ...state, loading: action.payload };
    case 'SET_ERROR':      return { ...state, error:   action.payload };
    case 'SET_WS':         return { ...state, wsConnected: action.payload };

    case 'UPSERT_JOB': {
      return {
        ...state,
        jobs: { ...state.jobs, [action.payload.id]: action.payload },
      };
    }

    case 'UPDATE_JOB_PROGRESS': {
      const existing = state.jobs[action.payload.job_id];
      if (!existing) return state;
      return {
        ...state,
        jobs: {
          ...state.jobs,
          [action.payload.job_id]: {
            ...existing,
            status:         'active',
            progress:       action.payload.progress,
            progress_bytes: action.payload.bytes_written,
            throughput_mbps:action.payload.throughput_mbps,
          },
        },
      };
    }

    case 'UPSERT_DRIVE': {
      const exists = state.drives.some(d => d.id === action.payload.id);
      return {
        ...state,
        drives: exists
          ? state.drives.map(d => d.id === action.payload.id ? action.payload : d)
          : [...state.drives, action.payload],
      };
    }

    case 'REMOVE_DRIVE':
      return { ...state, drives: state.drives.filter(d => d.id !== action.payload) };

    default: return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ContextValue extends State {
  jobsList:        Job[];
  activeJobCount:  number;
  setCategory:     (c: State['selectedCategory']) => void;
  setSearchQuery:  (q: string) => void;
  createJob:       (
    mediaId: string,
    driveId: string | null,
    deliveryType?: 'usb' | 'mobile',
    paymentMode?: 'manual' | 'online'
  ) => Promise<Job>;
  cancelJob:       (jobId: string) => Promise<void>;
  refreshMedia:    () => Promise<void>;
  refreshDrives:   () => Promise<void>;
}

const Ctx = createContext<ContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SmartCopyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // ── Initial data load ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [mediaRes, drivesRes, jobsRes] = await Promise.all([
        mediaApi.list(),
        driveApi.list(),
        jobsApi.list(),
      ]);
      dispatch({ type: 'SET_MEDIA',   payload: mediaRes.items  });
      dispatch({ type: 'SET_DRIVES',  payload: drivesRes.drives });
      dispatch({ type: 'SET_JOBS',    payload: jobsRes.jobs    });
      dispatch({ type: 'SET_ERROR',   payload: null            });
      // FIX: Load pricing tiers (best-effort; may fail if user is not admin)
      adminApi.pricing()
        .then(r => dispatch({ type: 'SET_PRICING', payload: r.tiers ?? [] }))
        .catch(() => { /* public users can't fetch pricing — that's OK */ });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const refreshMedia  = useCallback(() => mediaApi.list().then(r => dispatch({ type: 'SET_MEDIA',  payload: r.items })), []);
  const refreshDrives = useCallback(() => driveApi.list().then(r => dispatch({ type: 'SET_DRIVES', payload: r.drives })), []);

  // ── WebSocket subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    wsClient.connect();

    const unsubs = [
      // Connection state
      wsClient.on('state.init', (ev: WSEvent) => {
        const p = ev.payload as StateInitPayload & { disconnected?: boolean };
        if (p.disconnected) {
          dispatch({ type: 'SET_WS', payload: false });
          return;
        }
        dispatch({ type: 'SET_WS', payload: true });
        if (p.drives) dispatch({ type: 'SET_DRIVES', payload: p.drives });
        if (p.queue)  dispatch({ type: 'SET_JOBS',   payload: p.queue  });
      }),

      // Job lifecycle
      wsClient.on('job.created',   (ev: WSEvent) => dispatch({ type: 'UPSERT_JOB', payload: ev.payload as Job })),
      wsClient.on('job.started',   (ev: WSEvent) => {
        const p = ev.payload as { job_id: string };
        const existing = state.jobs[p.job_id];
        if (existing) dispatch({ type: 'UPSERT_JOB', payload: { ...existing, status: 'active' } });
      }),
      wsClient.on('job.progress',  (ev: WSEvent) => dispatch({ type: 'UPDATE_JOB_PROGRESS', payload: ev.payload as JobProgressPayload })),
      wsClient.on('job.completed', (ev: WSEvent) => {
        const p = ev.payload as { job_id: string };
        const existing = state.jobs[p.job_id];
        if (existing) dispatch({ type: 'UPSERT_JOB', payload: { ...existing, status: 'completed', progress: 100 } });
        refreshDrives();
      }),
      wsClient.on('job.failed',    (ev: WSEvent) => {
        const p = ev.payload as { job_id: string; reason: string };
        const existing = state.jobs[p.job_id];
        if (existing) dispatch({ type: 'UPSERT_JOB', payload: { ...existing, status: 'failed', error_message: p.reason } });
      }),
      wsClient.on('job.cancelled', (ev: WSEvent) => {
        const p = ev.payload as { job_id: string };
        const existing = state.jobs[p.job_id];
        if (existing) dispatch({ type: 'UPSERT_JOB', payload: { ...existing, status: 'cancelled' } });
      }),

      // Drive events
      wsClient.on('drive.connected',    (ev: WSEvent) => {
        const p = ev.payload as { drive: Drive };
        if (p.drive) dispatch({ type: 'UPSERT_DRIVE', payload: p.drive });
      }),
      wsClient.on('drive.disconnected', (ev: WSEvent) => {
        const p = ev.payload as { drive_id: string };
        dispatch({ type: 'REMOVE_DRIVE', payload: p.drive_id });
      }),
    ];

    loadAll();

    return () => {
      unsubs.forEach(fn => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const createJob = useCallback(async (
    mediaId: string,
    driveId: string | null,
    deliveryType: 'usb' | 'mobile' = 'usb',
    paymentMode: 'manual' | 'online' = 'manual'
  ): Promise<Job> => {
    const job = await jobsApi.create(mediaId, driveId, deliveryType, paymentMode);
    dispatch({ type: 'UPSERT_JOB', payload: job });
    return job;
  }, []);

  const cancelJob = useCallback(async (jobId: string): Promise<void> => {
    await jobsApi.cancel(jobId);
    const existing = state.jobs[jobId];
    if (existing) dispatch({ type: 'UPSERT_JOB', payload: { ...existing, status: 'cancelled' } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobs]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const jobsList = Object.values(state.jobs).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const activeJobCount = jobsList.filter(j => j.status === 'pending' || j.status === 'active').length;

  const value: ContextValue = {
    ...state,
    jobsList,
    activeJobCount,
    setCategory:    (c) => dispatch({ type: 'SET_CATEGORY', payload: c }),
    setSearchQuery: (q) => dispatch({ type: 'SET_SEARCH',   payload: q }),
    createJob,
    cancelJob,
    refreshMedia,
    refreshDrives,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSmartCopy(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSmartCopy must be used within SmartCopyProvider');
  return ctx;
}
