/**
 * SmartCopy Pro — AdminDashboard Context & Data Hook
 * Extracted from AdminDashboardModern.tsx for maintainability.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { adminApi } from '../../lib/api';
import type { DashboardSnapshot, ThroughputPoint, Job } from '../../lib/types';

interface AdminDashboardCtx {
  snap:           DashboardSnapshot | null;
  throughput:     ThroughputPoint[];
  jobs:           Job[];
  jobsLoading:    boolean;
  clock:          string;
  snapError:      string;
  tab:            AdminTab;
  setTab:         (t: AdminTab) => void;
  drawerOpen:     boolean;
  setDrawerOpen:  (fn: (prev: boolean) => boolean) => void;
  fetchRest:      () => void;
  loadJobs:       () => void;
  addToast:       (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

export type AdminTab = 'overview' | 'jobs' | 'agents' | 'settings';

const AdminDashboardCtx = createContext<AdminDashboardCtx | null>(null);

export function useAdminDashboard() {
  const ctx = useContext(AdminDashboardCtx);
  if (!ctx) throw new Error('useAdminDashboard: must be inside AdminDashboardProvider');
  return ctx;
}

interface ProviderProps {
  children:  ReactNode;
  addToast:  (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

export function AdminDashboardProvider({ children, addToast }: ProviderProps) {
  const [tab,          setTab]         = useState<AdminTab>('overview');
  const [snap,         setSnap]        = useState<DashboardSnapshot | null>(null);
  const [throughput,   setThroughput]  = useState<ThroughputPoint[]>([]);
  const [jobs,         setJobs]        = useState<Job[]>([]);
  const [jobsLoading,  setJobsLoading] = useState(false);
  const [drawerOpen,   setDrawerOpen]  = useState(false);
  const [clock,        setClock]       = useState('');
  const [snapError,    setSnapError]   = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Clock
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-US', { hour12: false });
    setClock(fmt());
    const t = setInterval(() => { if (mountedRef.current) setClock(fmt()); }, 1000);
    return () => clearInterval(t);
  }, []);

  const pushTP = useCallback((bps: number) => {
    const now = Date.now();
    setThroughput(prev => {
      const next = [...prev, { t: now, v: bps }];
      return next.filter(p => p.t > now - 30 * 60 * 1000);
    });
  }, []);

  const applySnap = useCallback((data: DashboardSnapshot) => {
    if (!mountedRef.current) return;
    setSnap(data);
    setSnapError('');
    if (data.active_users) {
      setJobs(data.active_users);
      const bps = data.active_users.reduce((s, u) => s + ((u.speed_mbps ?? 0) * 1024 * 1024), 0);
      pushTP(bps);
    }
  }, [pushTP]);

  const fetchRest = useCallback(async () => {
    try {
      const data = await adminApi.dashboard();
      applySnap(data);
    } catch (e) {
      if (mountedRef.current)
        setSnapError((e as Error).message || 'Failed to connect to server');
    }
  }, [applySnap]);

  useEffect(() => {
    fetchRest();
    const t = setInterval(fetchRest, 5000);
    return () => clearInterval(t);
  }, [fetchRest]);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await adminApi.jobs();
      if (mountedRef.current) setJobs(res.jobs);
    } catch (e) {
      addToast('error', 'Failed to load jobs', (e as Error).message);
    } finally {
      if (mountedRef.current) setJobsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (tab === 'jobs') loadJobs();
  }, [tab, loadJobs]);

  return (
    <AdminDashboardCtx.Provider value={{
      snap, throughput, jobs, jobsLoading, clock, snapError,
      tab, setTab, drawerOpen, setDrawerOpen, fetchRest, loadJobs, addToast,
    }}>
      {children}
    </AdminDashboardCtx.Provider>
  );
}
