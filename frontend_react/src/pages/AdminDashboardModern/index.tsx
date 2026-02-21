/**
 * SmartCopy Pro — Admin Dashboard Page
 * Decomposed from AdminDashboardModern.tsx for maintainability.
 * Visually identical to original — only code organization changed.
 */
import React from 'react';
import { Monitor, List, Server, Settings as SettingsIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { AdminDashboardProvider, useAdminDashboard, type AdminTab } from './AdminDashboardContext';
import { OverviewTab } from './QuickViews';
import { JobQueuePanel } from '../../components/JobQueuePanel';
import { DriveAgentPanel } from '../../components/DriveAgentPanel';
import { SettingsConfigPanel } from '../../components/SettingsConfigPanel';
import { SessionsDrawer } from './QuickViews';

interface Props {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview',  icon: <Monitor size={14} /> },
  { id: 'jobs',     label: 'Job Queue', icon: <List    size={14} /> },
  { id: 'agents',   label: 'Agents',    icon: <Server  size={14} /> },
  { id: 'settings', label: 'Settings',  icon: <SettingsIcon size={14} /> },
];

// ── Inner component (consumes context) ───────────────────────────────────────
function AdminDashboardInner() {
  const {
    tab, setTab, snap, jobs, jobsLoading, clock,
    snapError, drawerOpen, setDrawerOpen, fetchRest, loadJobs, addToast,
  } = useAdminDashboard();

  const drawerPad = drawerOpen ? 270 : 44;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Sub-header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'rgba(1,4,6,0.6)', flexShrink: 0,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-selected={tab === t.id}
              aria-label={t.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                border: tab === t.id ? '1px solid var(--border2)' : '1px solid transparent',
                background: tab === t.id ? 'var(--blue-dim)' : 'transparent',
                color: tab === t.id ? 'var(--blue)' : 'var(--text3)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'var(--t)',
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Clock + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text2)',
            padding: '4px 10px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)', borderRadius: 8, letterSpacing: '0.06em',
          }}>
            {clock}
          </div>
          <button className="btn-icon" onClick={fetchRest} title="Refresh" aria-label="Refresh dashboard">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        paddingBottom: `calc(${drawerPad}px + 16px)`,
        transition: 'padding-bottom 0.35s ease',
      }}>
        {/* Server error banner */}
        {snapError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', marginBottom: 14,
            background: 'rgba(255,204,68,0.08)', border: '1px solid rgba(255,204,68,0.25)',
            borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--amber)',
          }}>
            <AlertCircle size={12} aria-hidden />
            <span>Connection error — retrying automatically</span>
          </div>
        )}

        {tab === 'overview' && <OverviewTab />}
        {tab === 'jobs'     && (
          <JobQueuePanel
            jobs={jobs} loading={jobsLoading}
            onRefresh={loadJobs} addToast={addToast}
          />
        )}
        {tab === 'agents'   && <DriveAgentPanel addToast={addToast} />}
        {tab === 'settings' && <SettingsConfigPanel addToast={addToast} />}
      </div>

      <SessionsDrawer
        jobs={snap?.active_users ?? []}
        open={drawerOpen}
        onToggle={() => setDrawerOpen(o => !o)}
      />
    </div>
  );
}

// ── Public export (wraps with context provider) ───────────────────────────────
export function AdminDashboardModern({ addToast }: Props) {
  return (
    <AdminDashboardProvider addToast={addToast}>
      <AdminDashboardInner />
    </AdminDashboardProvider>
  );
}
