/**
 * AdminDashboardModern — SmartCopy Pro
 * Unified admin panel: V6 visual shell + all V4 panel tabs
 */
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, BarChart3, HardDrive, Film, Tag,
  ShoppingCart, Settings as SettingsIcon, Menu, X, RefreshCw,
  QrCode, Key, Shield, LogOut, ChevronRight, Database, Activity,
  Globe, Server, ListOrdered, Cpu,
} from 'lucide-react';
import { adminApi, wsClient, setAuthToken } from '../lib/api';
import { formatPrice, formatBytes } from '../lib/utils';
import { JobQueuePanel } from './JobQueuePanel';
import { DriveAgentPanel } from './DriveAgentPanel';
import { LoadBalancerControl } from './LoadBalancerControl';
import { SettingsConfigPanel } from './SettingsConfigPanel';
import { MetricCard } from './MetricCard';
import { ConsumptionChart } from './ConsumptionChart';
import { LiveThroughputMeter } from './LiveThroughputMeter';
import { SystemStatusBar } from './SystemStatusBar';
import { AdminMediaLibraryPanel } from './admin/AdminMediaLibraryPanel';
import { AdminPricingPanel } from './admin/AdminPricingPanel';
import { AdminSalesPanel } from './admin/AdminSalesPanel';
import { AdminAgentsManagementPanel } from './admin/AdminAgentsManagementPanel';
import { AdminSettingsPanel } from './admin/AdminSettingsPanel';
import { AdminChangePasswordModal } from './admin/AdminChangePasswordModal';
import { AdminQrQuickView } from './admin/AdminQrQuickView';
import { AdminLicenseQuickView } from './admin/AdminLicenseQuickView';
import { AdminQuickAction } from './admin/AdminQuickAction';
import { ModalDrawer } from './ModalDrawer';
import type { DashboardStats, DailyReport, Job, Drive, Agent } from '../lib/types';

/* ── Navigation config ───────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',       icon: LayoutDashboard, group: 'Main' },
  { id: 'queue',     label: 'Job Queue',       icon: BarChart3,       group: 'Operations' },
  { id: 'agents',    label: 'Drives & Agents', icon: HardDrive,       group: 'Operations' },
  { id: 'media',     label: 'Media Library',   icon: Film,            group: 'Content' },
  { id: 'pricing',   label: 'Pricing',         icon: Tag,             group: 'System' },
  { id: 'sales',     label: 'Sales & Reports', icon: ShoppingCart,    group: 'System' },
  { id: 'settings',  label: 'Settings',        icon: SettingsIcon,    group: 'System' },
] as const;

type TabId = typeof NAV_ITEMS[number]['id'];

/* ── Sidebar ─────────────────────────────────────────────────── */
function Sidebar({
  open, onClose, activeId, onNavigate, collapsed, onToggleCollapse, onLogout,
}: {
  open: boolean; onClose: () => void; activeId: TabId;
  onNavigate: (id: TabId) => void; collapsed?: boolean;
  onToggleCollapse?: () => void; onLogout?: () => void;
}) {
  const groups = Array.from(new Set(NAV_ITEMS.map(i => i.group)));
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
             onClick={onClose} aria-hidden="true" />
      )}
      <aside style={{
        position: 'fixed', top: 0, bottom: 0, right: 0, zIndex: 70,
        width: collapsed ? 60 : 240,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease, transform 0.25s ease',
        transform: open || window.innerWidth >= 768 ? 'translateX(0)' : 'translateX(100%)',
        boxShadow: 'var(--shadow-2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 64, gap: 8,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(145deg,var(--blue2),var(--cyan))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px var(--blue-glow)',
              }}>
                <Database size={16} color="white" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text1)', whiteSpace: 'nowrap' }}>SmartCopy</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.08em' }}>PRO ADMIN</div>
              </div>
            </div>
          )}
          <button
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onClick={onToggleCollapse ?? onClose}
          >
            {collapsed ? <ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /> : <ChevronRight size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {groups.map(group => (
            <div key={group}>
              {!collapsed && (
                <div style={{
                  padding: '10px 14px 4px',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                  color: 'var(--text3)', textTransform: 'uppercase',
                }}>
                  {group}
                </div>
              )}
              {NAV_ITEMS.filter(i => i.group === group).map(item => {
                const active = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    title={collapsed ? item.label : undefined}
                    style={{
                      width: '100%', textAlign: 'right',
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 10,
                      padding: collapsed ? '10px 0' : '9px 14px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'var(--blue-dim)' : 'transparent',
                      color: active ? 'var(--blue)' : 'var(--text2)',
                      borderRight: active ? '3px solid var(--blue)' : '3px solid transparent',
                      cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
                      transition: 'all 0.15s', border: 'none',
                    }}
                  >
                    <item.icon size={16} style={{ flexShrink: 0 }} />
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {onLogout && !collapsed && (
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text3)', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ── Stat Pill (for header status bar) ──────────────────────── */
function StatPill({ icon: Icon, label, value, ok }: {
  icon: React.FC<{ size?: number }>; label: string; value: string | number; ok?: boolean;
}) {
  const color = ok === false ? 'var(--red)' : ok === true ? 'var(--green)' : 'var(--text3)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 99,
      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
      fontSize: 10, fontWeight: 700,
    }}>
      <Icon size={10} style={{ color }} />
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

/* ── Overview Tab ────────────────────────────────────────────── */
function OverviewTab({
  stats, reports, jobs, loading, addToast,
}: {
  stats: DashboardStats | null;
  reports: DailyReport[];
  jobs: Job[];
  loading: boolean;
  addToast: Props['addToast'];
}) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Status Bar */}
      <SystemStatusBar stats={stats} loading={loading} />

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <MetricCard label="Copies Today"   value={stats?.copies_today}   icon={Activity}   color="var(--blue)"   loading={loading} />
        <MetricCard label="Revenue Today"  value={stats ? formatPrice(stats.revenue_today) : undefined}
                    icon={ShoppingCart}  color="var(--green)"  loading={loading} />
        <MetricCard label="Media Files"    value={stats?.media_count}    icon={Film}        color="var(--cyan)"   loading={loading} />
        <MetricCard label="Queue Depth"    value={stats?.queue_depth}    icon={ListOrdered} color="var(--orange)" loading={loading}
          trend={stats ? (stats.queue_depth > 20 ? -10 : 5) : undefined} />
        <MetricCard label="Active Workers" value={stats?.active_workers} icon={Cpu}         color="var(--blue2)"  loading={loading} />
        <MetricCard label="WS Connections" value={stats?.ws_connections} icon={Globe}       color="var(--text2)"  loading={loading} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--glass)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '20px 24px', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Consumption Trend
          </div>
          <ConsumptionChart reports={reports} loading={loading} />
        </div>

        <div style={{
          background: 'var(--glass)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '20px 24px', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live Throughput
          </div>
          <LiveThroughputMeter jobs={jobs} loading={loading} />
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: 'var(--glass)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '20px 24px', backdropFilter: 'blur(20px)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
          <AdminQuickAction label="Rescan Media" icon={Film}
            onClick={() => adminApi.scan().then(() => addToast('success', 'Scan complete')).catch(e => addToast('error', 'Scan failed', e.message))} />
          <AdminQuickAction label="QR Connect" icon={QrCode} onClick={() => {}} />
          <AdminQuickAction label="License" icon={Shield} onClick={() => {}} />
          <AdminQuickAction label="Change Pass" icon={Key} onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
interface Props {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  onBack?: () => void;
  onLogout?: () => void;
}

export function AdminDashboardModern({ addToast, onBack, onLogout }: Props) {
  const [activeTab,        setActiveTab       ] = useState<TabId>('overview');
  const [sidebarOpen,      setSidebarOpen     ] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [stats,       setStats      ] = useState<DashboardStats | null>(null);
  const [reports,     setReports    ] = useState<DailyReport[]>([]);
  const [jobs,        setJobs       ] = useState<Job[]>([]);
  const [drives,      setDrives     ] = useState<Drive[]>([]);
  const [agents,      setAgents     ] = useState<Agent[]>([]);
  const [loading,     setLoading    ] = useState(true);

  const [qrModal,       setQrModal      ] = useState(false);
  const [licenseModal,  setLicenseModal ] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, rep, queue, drivesRes, agentsRes] = await Promise.all([
        adminApi.stats().catch(() => null),
        adminApi.reports(30).catch(() => ({ reports: [] })),
        adminApi.queue().catch(() => ({ jobs: [] })),
        adminApi.agents().catch(() => ({ agents: [] })),
        adminApi.agents().catch(() => ({ agents: [] })),
      ]);

      // Map DashboardSnapshot → DashboardStats if needed
      const rawStats: unknown = dash;
      if (rawStats && typeof rawStats === 'object') {
        const d = rawStats as Record<string, unknown>;
        if (d.jobs && typeof d.jobs === 'object') {
          const j = d.jobs as Record<string, number>;
          setStats({
            copies_today:   j.today_completed ?? 0,
            revenue_today:  j.today_revenue_usd ?? 0,
            queue_depth:    (j.queued ?? 0) + (j.pending ?? 0),
            media_count:    0,
            failures_today: j.failed ?? 0,
            active_workers: j.active ?? 0,
            ws_connections: 0,
            agents_online:  Array.isArray((d as Record<string, unknown>).agents)
              ? ((d as Record<string, unknown[]>).agents.length) : 0,
          });
        } else if (d.copies_today !== undefined) {
          setStats(dash as DashboardStats);
        }
      }

      setReports(rep.reports ?? []);
      setJobs(queue.jobs ?? []);
      const agentsList = (agentsRes as { agents?: Agent[] }).agents ?? [];
      setAgents(agentsList);
      const drivesList = (drivesRes as { agents?: Agent[] }).agents ?? [];
      setDrives(drivesList as unknown as Drive[]);
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes('Session expired')) addToast('error', 'Load error', msg);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
    wsClient.connect();
    const unsub = wsClient.on('*', (ev) => {
      if (['job.created', 'job.started', 'job.completed', 'job.failed'].includes(ev.event)) load();
    });
    return () => unsub();
  }, [load]);

  const handleLogout = () => {
    setAuthToken(null);
    onLogout?.();
  };

  const sidebarWidth = sidebarCollapsed ? 60 : 240;

  /* ── render active tab ─── */
  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab stats={stats} reports={reports} jobs={jobs} loading={loading} addToast={addToast} />;
      case 'queue':
        return (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <JobQueuePanel addToast={addToast} />
            <LoadBalancerControl addToast={addToast} />
          </div>
        );
      case 'agents':
        return (
          <div style={{ padding: '24px 28px' }}>
            <AdminAgentsManagementPanel
              agents={agents} drives={drives} loading={loading}
              addToast={addToast} onRefresh={load}
            />
          </div>
        );
      case 'media':
        return <div style={{ padding: '24px 28px' }}><AdminMediaLibraryPanel addToast={addToast} /></div>;
      case 'pricing':
        return <div style={{ padding: '24px 28px' }}><AdminPricingPanel addToast={addToast} /></div>;
      case 'sales':
        return <div style={{ padding: '24px 28px' }}><AdminSalesPanel addToast={addToast} /></div>;
      case 'settings':
        return (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AdminSettingsPanel addToast={addToast} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <SettingsConfigPanel addToast={addToast} />
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', direction: 'ltr' }}>

      {/* ── Sidebar ── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={activeTab}
        onNavigate={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        onLogout={handleLogout}
      />

      {/* ── Main content area (offset by sidebar width on desktop) ── */}
      <div style={{
        flex: 1,
        marginRight: `${sidebarWidth}px`,
        display: 'flex', flexDirection: 'column',
        minHeight: '100%', overflow: 'hidden',
        transition: 'margin-right 0.2s ease',
      }}>

        {/* Sub-header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          background: 'rgba(1,4,6,0.7)', backdropFilter: 'blur(20px)',
          flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text3)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
            </button>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>
              {NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Admin'}
            </div>
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <StatPill icon={Server}      label="Workers" value={stats?.active_workers ?? 0} ok={(stats?.active_workers ?? 0) > 0} />
            <StatPill icon={ListOrdered} label="Queue"   value={stats?.queue_depth ?? 0}    ok={(stats?.queue_depth ?? 0) < 20} />
            <StatPill icon={Globe}       label="WS"      value={stats?.ws_connections ?? 0} ok={true} />

            <button
              onClick={load}
              style={{
                width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text3)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Refresh"
            >
              <RefreshCw size={12} className={loading ? 'anim-spin' : ''} />
            </button>

            {/* Quick-action modals */}
            <button className="btn-icon" title="QR Code"        onClick={() => setQrModal(true)}>       <QrCode size={13} /></button>
            <button className="btn-icon" title="License"        onClick={() => setLicenseModal(true)}>  <Shield size={13} /></button>
            <button className="btn-icon" title="Change Password" onClick={() => setPasswordModal(true)}><Key    size={13} /></button>
            {onBack && (
              <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }} onClick={onBack}>
                ← Back
              </button>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderTab()}
        </div>
      </div>

      {/* ── Modal Drawers ── */}
      {qrModal && (
        <ModalDrawer open onClose={() => setQrModal(false)} title="QR Connection Code">
          <AdminQrQuickView />
        </ModalDrawer>
      )}
      {licenseModal && (
        <ModalDrawer open onClose={() => setLicenseModal(false)} title="License Status">
          <AdminLicenseQuickView addToast={addToast} />
        </ModalDrawer>
      )}
      {passwordModal && (
        <ModalDrawer open onClose={() => setPasswordModal(false)} title="Change Password">
          <AdminChangePasswordModal onClose={() => setPasswordModal(false)} addToast={addToast} />
        </ModalDrawer>
      )}
    </div>
  );
}
