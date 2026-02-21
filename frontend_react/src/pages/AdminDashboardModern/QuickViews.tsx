/**
 * SmartCopy Pro — QuickViews
 * Extracted sub-components: KpiCard, GaugeRow, ThroughputChart, DonutChart,
 * SessionsDrawer, OverviewTab — all visually identical to original.
 */
import { useState, useRef } from 'react';
import {
  Zap, CheckSquare, TrendingUp, Users, HardDrive,
  Activity, Clock, ChevronUp, ChevronDown,
} from 'lucide-react';
import { formatBytes, formatUptime } from '../../lib/utils';
import { LoadBalancerControl } from '../../components/LoadBalancerControl';
import { useAdminDashboard } from './AdminDashboardContext';
import type { Job, ThroughputPoint } from '../../lib/types';

// ── KPI Card ────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string; value: string | number; sub: string; color: string; icon: React.ReactNode;
}
export function KpiCard({ label, value, sub, color, icon }: KpiCardProps) {
  return (
    <div style={{
      background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
      padding: '18px 20px', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-1), 0 1px 0 var(--glass-hi) inset', transition: 'var(--t)', cursor: 'default',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent 80%)` }} />
      <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(ellipse, ${color} 0%, transparent 70%)`, opacity: 0.07, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', opacity: 0.12, color }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--text1)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono' }}>{sub}</div>
    </div>
  );
}

// ── Gauge Row ───────────────────────────────────────────────────────────────
export function GaugeRow({ label, value, pct, gradient }: { label: string; value: string; pct: number; gradient: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text1)' }}>{value}</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min(pct, 100)}%`, background: gradient }} />
      </div>
    </div>
  );
}

// ── Throughput Chart ─────────────────────────────────────────────────────────
export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; val: string } | null>(null);
  const W = 800, H = 160, pad = { l: 8, r: 8, t: 10, b: 10 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  if (!data.length) return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
      Collecting data...
    </div>
  );

  const maxV = Math.max(...data.map(d => d.v), 1);
  const minT = data[0].t, rangeT = (data[data.length - 1].t - minT) || 1;
  const xOf = (t: number) => pad.l + ((t - minT) / rangeT) * iW;
  const yOf = (v: number) => pad.t + iH - (v / maxV) * iH;
  const pts = data.map(d => [xOf(d.t), yOf(d.v)] as [number, number]);

  function smooth(pts: [number, number][]) {
    if (pts.length < 2) return `M${pts[0]?.[0]},${pts[0]?.[1]}`;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6, cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6, cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const linePath = smooth(pts);
  const first = pts[0], last = pts[pts.length - 1];
  const areaPath = linePath + ` L${last[0]},${H} L${first[0]},${H} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map(f =>
    `<line x1="${pad.l}" y1="${pad.t + iH - f * iH}" x2="${W - pad.r}" y2="${pad.t + iH - f * iH}" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>`
  ).join('');

  return (
    <div style={{ position: 'relative', height: 160 }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}
        onMouseMove={e => {
          if (!svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * W;
          const hoverT = minT + ((svgX - pad.l) / iW) * rangeT;
          let nearest = data[0];
          for (const d of data) if (Math.abs(d.t - hoverT) < Math.abs(nearest.t - hoverT)) nearest = d;
          setTooltip({ x: ((xOf(nearest.t) / W) * rect.width), y: (yOf(nearest.v) / H) * rect.height, val: `${formatBytes(nearest.v, 1)}/s` });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(77,159,255,0.45)" />
            <stop offset="60%" stopColor="rgba(77,159,255,0.08)" />
            <stop offset="100%" stopColor="rgba(77,159,255,0)" />
          </linearGradient>
          <linearGradient id="lGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--blue2)" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <clipPath id="clip"><rect x="0" y="0" width={W} height={H} /></clipPath>
        </defs>
        <g dangerouslySetInnerHTML={{ __html: grid }} />
        <path d={areaPath} fill="url(#aGrad)" clipPath="url(#clip)" />
        <path d={linePath} fill="none" stroke="url(#lGrad)" strokeWidth="2.5" strokeLinejoin="round" clipPath="url(#clip)" filter="url(#glow)" />
      </svg>
      {tooltip && (
        <div style={{ position: 'absolute', left: tooltip.x + 8, top: tooltip.y - 28, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r-sm)', padding: '5px 9px', fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text1)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10, boxShadow: 'var(--shadow-2)' }}>
          {tooltip.val}
        </div>
      )}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, fontFamily: 'DM Mono', color: 'var(--text4)', padding: '4px 0', pointerEvents: 'none' }}>
        {[1, 0.75, 0.5, 0.25, 0].map(f => <span key={f}>{formatBytes(maxV * f, 0)}</span>)}
      </div>
    </div>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────────────
export function DonutChart({ slices, total }: { slices: { label: string; value: number; color: string }[]; total: number }) {
  const r = 44, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let offset = -Math.PI / 2;
  const arcs = slices.filter(s => s.value > 0).map(s => {
    const frac = s.value / (total || 1);
    const dash = frac * circ;
    const arc = { s, dash, offset };
    offset += frac * 2 * Math.PI;
    return arc;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, flexShrink: 0 }} role="img" aria-label="Job distribution chart">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={11} />
        {arcs.map(({ s, dash, offset: off }, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={11}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-(off / (2 * Math.PI)) * circ + circ / 4}
            style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 4px ${s.color}88)` }}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="DM Mono" fontSize={18} fill="white" fontWeight={500}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="Inter" fontSize={8} fill="rgba(255,255,255,0.3)">total</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slices.filter(s => s.value > 0).map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}`, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <strong style={{ color: 'var(--text1)', fontFamily: 'DM Mono', fontSize: 12 }}>{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sessions Drawer ──────────────────────────────────────────────────────────
export function SessionsDrawer({ jobs, open, onToggle }: { jobs: Job[]; open: boolean; onToggle: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'rgba(3,11,20,0.97)', backdropFilter: 'blur(28px)',
      borderTop: '1px solid var(--border2)',
      boxShadow: '0 -8px 48px rgba(0,0,0,0.7), 0 -1px 0 rgba(77,159,255,0.1)',
      height: open ? 270 : 44, transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
    }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid var(--border)' : '1px solid transparent' }}
        onClick={onToggle} role="button" aria-expanded={open} aria-label="Toggle active sessions drawer"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text2)' }}>
          <Activity size={12} aria-hidden />
          Active Download Sessions
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--green-dim)', border: '1px solid rgba(0,245,160,0.3)', borderRadius: 99, fontSize: 9, color: 'var(--green)', fontWeight: 700, boxShadow: '0 0 8px var(--green-glow)' }}>
            <span className="pulse-dot" style={{ width: 5, height: 5 }} />
            Live
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ padding: '2px 9px', borderRadius: 99, background: jobs.length > 0 ? 'var(--blue-dim)' : 'rgba(255,255,255,0.04)', color: jobs.length > 0 ? 'var(--blue)' : 'var(--text3)', fontSize: 10, fontFamily: 'DM Mono', border: '1px solid var(--border)' }}>
            {jobs.length} sessions
          </span>
          {open ? <ChevronDown size={14} aria-hidden style={{ color: 'var(--text3)' }} /> : <ChevronUp size={14} aria-hidden style={{ color: 'var(--text3)' }} />}
        </div>
      </div>
      <div style={{ overflowY: 'auto', height: 226 }}>
        <table className="nt-table">
          <thead><tr><th>Media Title</th><th>Category</th><th>Size</th><th>Status</th><th>Delivery</th><th style={{ minWidth: 120 }}>Progress</th><th>Speed</th><th>Price</th><th>Drive</th><th>Time</th></tr></thead>
          <tbody>
            {!jobs.length ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)' }}>No active sessions</td></tr>
            ) : jobs.map(u => {
              const pct = Math.min(u.progress_pct ?? 0, 100);
              const speedPct = Math.min(((u.speed_mbps ?? 0) / 150) * 100, 100);
              return (
                <tr key={u.id}>
                  <td className="td-main" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.media_name}</td>
                  <td className="td-mono">{u.delivery_type === 'usb' ? 'USB' : 'Mobile'}</td>
                  <td className="td-mono">{u.media_size_gb ? `${u.media_size_gb} GB` : '—'}</td>
                  <td><span className={`chip chip-${u.status}`} style={{ fontSize: 9 }}>{u.status === 'active' ? 'Active' : u.status === 'queued' ? 'Queued' : 'Pending'}</span></td>
                  <td className="td-mono">{u.delivery_type === 'usb' ? 'USB' : 'Mobile'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,var(--blue2),var(--cyan))', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: 'DM Mono', color: 'var(--text3)' }}>{pct}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${speedPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--cyan),var(--blue))' }} />
                      </div>
                      <span className="td-mono" style={{ fontSize: 10 }}>{u.speed_mbps ?? 0}</span>
                    </div>
                  </td>
                  <td className="td-mono">${(u.price_usd ?? 0).toFixed(2)}</td>
                  <td className="td-dim">{u.drive_id ?? '—'}</td>
                  <td className="td-mono">{u.elapsed_s ? `${u.elapsed_s}s` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
export function OverviewTab() {
  const { snap, throughput } = useAdminDashboard();
  const sys = snap?.system;
  const jbs = snap?.jobs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KpiCard label="Active Jobs" value={jbs?.active ?? '—'} sub={`${jbs?.queued ?? 0} queued · ${jbs?.pending ?? 0} pending`} color="var(--blue)" icon={<Zap size={36} aria-hidden />} />
        <KpiCard label="Completed Today" value={jbs?.today_completed ?? '—'} sub={`$${(jbs?.today_revenue_usd ?? 0).toFixed(2)} revenue`} color="var(--green)" icon={<CheckSquare size={36} aria-hidden />} />
        <KpiCard label="Bandwidth Today" value={formatBytes(jbs?.today_bytes_copied ?? 0, 1).split(' ')[0]} sub={formatBytes(jbs?.today_bytes_copied ?? 0, 1).split(' ').slice(1).join(' ') + ' transferred'} color="var(--cyan)" icon={<TrendingUp size={36} aria-hidden />} />
        <KpiCard label="Active Agents" value={(snap?.agents ?? []).length} sub={`${(snap?.agents ?? []).reduce((s, a) => s + (a.drives_count ?? 0), 0)} drives connected`} color="var(--violet)" icon={<Users size={36} aria-hidden />} />
      </div>

      {/* Chart + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title">
            <div className="card-dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
            Live Bandwidth — Last 30 Minutes
            <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono', fontSize: 9, color: 'var(--text3)' }}>
              peak: {throughput.length ? formatBytes(Math.max(...throughput.map(d => d.v)), 1) + '/s' : '—'}
            </span>
          </div>
          <ThroughputChart data={throughput} />
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title">
            <div className="card-dot" style={{ background: 'var(--blue)' }} />
            Job Distribution
          </div>
          <DonutChart
            total={(jbs?.active ?? 0) + (jbs?.queued ?? 0) + (jbs?.pending ?? 0) + (jbs?.completed ?? 0) + (jbs?.failed ?? 0)}
            slices={[
              { label: 'Active', value: jbs?.active ?? 0, color: 'var(--blue)' },
              { label: 'Queued', value: jbs?.queued ?? 0, color: 'var(--cyan)' },
              { label: 'Pending', value: jbs?.pending ?? 0, color: 'var(--amber)' },
              { label: 'Completed', value: jbs?.completed ?? 0, color: 'var(--green)' },
              { label: 'Failed', value: jbs?.failed ?? 0, color: 'var(--red)' },
            ]}
          />
        </div>
      </div>

      {/* System + Running Jobs + Agents */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title"><div className="card-dot" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />System Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <GaugeRow label="CPU" value={`${(sys?.cpu_percent ?? 0).toFixed(1)}%`} pct={sys?.cpu_percent ?? 0} gradient={(sys?.cpu_percent ?? 0) > 85 ? 'linear-gradient(90deg,var(--red),var(--amber))' : 'linear-gradient(90deg,var(--blue2),var(--cyan))'} />
            <GaugeRow label="RAM" value={`${(sys?.ram_percent ?? 0).toFixed(1)}%`} pct={sys?.ram_percent ?? 0} gradient="linear-gradient(90deg,var(--violet),var(--blue))" />
            <GaugeRow label="Disk" value={`${(sys?.disk_percent ?? 0).toFixed(1)}%`} pct={sys?.disk_percent ?? 0} gradient="linear-gradient(90deg,var(--cyan),var(--green))" />
            <GaugeRow label="Load" value={(sys?.load_avg ?? [0, 0, 0]).map(v => v.toFixed(2)).join(' · ')} pct={((sys?.load_avg ?? [0])[0] / (sys?.cpu_count ?? 1)) * 100} gradient="linear-gradient(90deg,var(--amber),var(--red))" />
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={11} aria-hidden />Uptime: {sys ? formatUptime(sys.uptime_seconds) : '—'}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title"><div className="card-dot" style={{ background: 'var(--blue)', boxShadow: '0 0 8px var(--blue)' }} />Running Jobs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
            {!(snap?.active_users?.length) ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>No active jobs</p>
            ) : snap.active_users.filter(u => u.status === 'active' || u.status === 'queued').slice(0, 5).map(u => (
              <div key={u.id} style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span className={`chip chip-${u.status}`} style={{ fontSize: 9 }}>{u.status === 'active' ? 'Active' : 'Queued'}</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.media_name}</span>
                  <span style={{ fontSize: 9, fontFamily: 'DM Mono', color: 'var(--cyan)' }}>{u.speed_mbps ?? 0} MB/s</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(u.progress_pct ?? 0, 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title"><div className="card-dot" style={{ background: 'var(--violet)', boxShadow: '0 0 8px var(--violet)' }} />Agent Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!(snap?.agents?.length) ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>No agents registered</p>
            ) : snap.agents.map(a => {
              const online = a.status === 'online';
              return (
                <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? 'var(--green)' : 'var(--text3)', boxShadow: online ? '0 0 8px var(--green-glow)' : 'none', animation: online ? 'pulse 2s infinite' : 'none', flexShrink: 0 }} aria-hidden />
                  <span style={{ flex: 1, fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text1)' }}>{a.hostname}</span>
                  <span style={{ fontSize: 9, color: 'var(--text3)' }}><HardDrive size={9} aria-hidden style={{ display: 'inline' }} /> {a.drives_count}</span>
                  <span className={`chip ${online ? 'chip-online' : 'chip-offline'}`} style={{ fontSize: 8 }}>{online ? 'Online' : 'Offline'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LoadBalancerControl addToast={useAdminDashboard().addToast} />
    </div>
  );
}
