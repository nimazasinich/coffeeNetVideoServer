/**
 * SmartCopyContext — Merged v4+v6
 * V6 base + V4 features: jobsList, createJob, cancelJob, wsConnected, error
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Media, Drive, PricingTier, Job, ToastItem, ToastType } from '../lib/types';
import { publicApi, jobsApi } from '../lib/api';

function uid() { return Math.random().toString(36).slice(2); }

interface SmartCopyCtx {
  /* Data */
  media:          Media[];
  drives:         Drive[];
  pricingTiers:   PricingTier[];
  jobsList:       Job[];
  /* Loading / status */
  loading:        boolean;
  mediaLoading:   boolean;
  serverOnline:   boolean;
  wsConnected:    boolean;
  error:          string | null;
  activeJobCount: number;
  /* Filters */
  searchQuery:    string;
  setSearchQuery: (v: string) => void;
  selectedCategory: string;
  setCategory:    (v: string) => void;
  /* V6 compat aliases */
  search:         string;
  setSearch:      (v: string) => void;
  category:       string;
  /* Admin state */
  isAdmin:        boolean;
  setIsAdmin:     (v: boolean) => void;
  /* Toasts */
  toasts:         ToastItem[];
  addToast:       (type: ToastType, title: string, msg?: string) => void;
  /* Actions */
  refreshMedia:   () => void;
  refreshDrives:  () => void;
  createJob:      (mediaId: string, driveId: string | null, deliveryType?: string, paymentMode?: string) => Promise<Job>;
  cancelJob:      (jobId: string) => Promise<void>;
}

const Ctx = createContext<SmartCopyCtx | null>(null);

export function useSmartCopy() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSmartCopy: must be inside SmartCopyProvider');
  return ctx;
}

export function SmartCopyProvider({ children }: { children: ReactNode }) {
  const [media,          setMedia         ] = useState<Media[]>([]);
  const [drives,         setDrives        ] = useState<Drive[]>([]);
  const [pricingTiers,   setPricingTiers  ] = useState<PricingTier[]>([]);
  const [jobsList,       setJobsList      ] = useState<Job[]>([]);
  const [mediaLoading,   setMediaLoading  ] = useState(true);
  const [serverOnline,   setServerOnline  ] = useState(false);
  const [wsConnected,    setWsConnected   ] = useState(false);
  const [error,          setError         ] = useState<string | null>(null);
  const [searchQuery,    setSearchQuery   ] = useState('');
  const [selectedCategory, setCategory   ] = useState('');
  const [isAdmin,        setIsAdmin       ] = useState(false);
  const [toasts,         setToasts        ] = useState<ToastItem[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((type: ToastType, title: string, msg?: string) => {
    const id = uid();
    setToasts(prev => [...prev, { id, type, title, msg }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(id);
    }, 4500);
    toastTimers.current.set(id, timer);
  }, []);

  const refreshMedia = useCallback(async () => {
    setMediaLoading(true);
    setError(null);
    try {
      const res = await publicApi.media(searchQuery || undefined, selectedCategory || undefined);
      setMedia(res.items);
      setServerOnline(true);
    } catch (e) {
      setServerOnline(false);
      setMedia([]);
      const msg = (e as Error).message;
      setError(msg);
    } finally {
      setMediaLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  const refreshDrives = useCallback(async () => {
    try {
      const res = await publicApi.drives();
      setDrives(res.drives);
    } catch { setDrives([]); }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await jobsApi.list();
      setJobsList(res.jobs ?? []);
    } catch { /**/ }
  }, []);

  const createJob = useCallback(async (
    mediaId: string, driveId: string | null, deliveryType?: string, paymentMode?: string
  ): Promise<Job> => {
    const job = await jobsApi.create(mediaId, driveId, deliveryType, paymentMode);
    refreshJobs();
    return job;
  }, [refreshJobs]);

  const cancelJob = useCallback(async (jobId: string) => {
    await jobsApi.cancel(jobId);
    refreshJobs();
  }, [refreshJobs]);

  /* Initial loads */
  useEffect(() => { refreshMedia(); }, [refreshMedia]);
  useEffect(() => {
    refreshDrives();
    const t = setInterval(refreshDrives, 10000);
    return () => clearInterval(t);
  }, [refreshDrives]);
  useEffect(() => {
    publicApi.pricing().then(r => setPricingTiers(r.tiers)).catch(() => setPricingTiers([]));
  }, []);
  useEffect(() => {
    refreshJobs();
    const t = setInterval(refreshJobs, 5000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  /* WebSocket */
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${window.location.host}/ws/jobs`;
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          retryTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (['job.created', 'job.started', 'job.completed', 'job.failed', 'state.init'].includes(msg.event)) {
              refreshJobs();
              refreshDrives();
            }
          } catch { /**/ }
        };
      } catch { /**/ }
    };

    connect();
    return () => { clearTimeout(retryTimer); ws?.close(); };
  }, [refreshJobs, refreshDrives]);

  const activeJobCount = jobsList.filter(j => j.status === 'active' || j.status === 'queued').length;

  return (
    <Ctx.Provider value={{
      media, drives, pricingTiers, jobsList,
      loading: mediaLoading, mediaLoading, serverOnline, wsConnected, error,
      activeJobCount,
      searchQuery, setSearchQuery,
      selectedCategory, setCategory,
      /* V6 compat */
      search: searchQuery, setSearch: setSearchQuery, category: selectedCategory,
      isAdmin, setIsAdmin,
      toasts, addToast,
      refreshMedia, refreshDrives,
      createJob, cancelJob,
    }}>
      {children}
    </Ctx.Provider>
  );
}
