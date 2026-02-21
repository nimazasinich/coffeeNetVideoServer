import { useState, useEffect, useCallback } from 'react';
import { Cpu, HardDrive, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { adminApi } from '../lib/api';
import { timeAgo } from '../lib/utils';
import type { Agent } from '../lib/types';

interface Props {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

export function DriveAgentPanel({ addToast }: Props) {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.agents();
      setAgents(res.agents);
    } catch (e) {
      setError((e as Error).message || 'Failed to load agents');
      setAgents([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const online  = agents.filter(a => a.status === 'online');
  const offline = agents.filter(a => a.status === 'offline');

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div className="card-title">
        <Cpu size={13} style={{ color: 'var(--violet)' }} />
        Agents
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--green)' }}>
            <Wifi size={9} /> {online.length}
          </span>
          {offline.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--red)' }}>
              <WifiOff size={9} /> {offline.length}
            </span>
          )}
        </div>
        <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={load} disabled={loading} aria-label="Close">
          <RefreshCw size={11} className={loading ? 'anim-spin' : ''} />
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--red-dim)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--red)', marginBottom: 10 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {loading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--r-sm)' }} />)
        ) : !agents.length ? (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text3)', fontSize: 12 }}>No agents registered</div>
        ) : (
          agents.map(a => {
            const isOnline = a.status === 'online';
            return (
              <div key={a.agent_id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${isOnline ? 'rgba(0,245,160,0.12)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                transition: 'var(--t)',
              }}>
                {/* Status indicator */}
                <div style={{
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: isOnline ? 'var(--green)' : 'var(--text3)',
                  boxShadow: isOnline ? '0 0 8px var(--green-glow)' : 'none',
                  flexShrink: 0,
                  animation: isOnline ? 'pulse 2s infinite' : 'none',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', fontFamily: 'DM Mono' }}>
                    {a.hostname}
                    {a.ip && <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 6 }}>{a.ip}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <HardDrive size={9} /> {a.drives_count} drives
                    </span>
                    <span>{a.jobs_active} active</span>
                    <span>v{a.version ?? '—'}</span>
                    <span>{timeAgo(a.last_seen)}</span>
                  </div>
                </div>

                <span className={`chip ${isOnline ? 'chip-online' : 'chip-offline'}`} style={{ fontSize: 8 }}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
