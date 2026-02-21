import { useState, useEffect, useCallback } from 'react';
import { Sliders, CheckCircle, AlertCircle } from 'lucide-react';
import { adminApi } from '../lib/api';

const KEY = 'max_copies_per_session';
const MIN = 1, MAX = 16;

interface Props {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

export function LoadBalancerControl({ addToast }: Props) {
  const [current,  setCurrent]  = useState(4);
  const [proposed, setProposed] = useState(4);
  const [loading,  setLoading]  = useState(true);
  const [applying, setApplying] = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.settings();
      const raw = res.settings?.[KEY];
      const num = raw ? parseInt(raw, 10) : 4;
      const safe = Math.min(MAX, Math.max(MIN, isNaN(num) ? 4 : num));
      setCurrent(safe); setProposed(safe);
    } catch (e) {
      setError((e as Error).message || 'Failed to load settings');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      await adminApi.updateSetting(KEY, String(proposed));
      setCurrent(proposed);
      addToast('success', 'Applied', `Concurrency limit: ${proposed}`);
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
    } finally { setApplying(false); }
  }, [proposed, addToast]);

  const pct = ((proposed - MIN) / (MAX - MIN)) * 100;

  if (loading) {
    return (
      <div className="card" style={{ padding: '16px' }}>
        <div className="skeleton" style={{ height: 14, width: 160, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 5, width: '100%', borderRadius: 99 }} />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div className="card-title">
        <Sliders size={13} style={{ color: 'var(--blue)' }} />
        Max Concurrent Copies
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--amber)', marginBottom: 10 }}>
          <AlertCircle size={11} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <input
            type="range" min={MIN} max={MAX} value={proposed}
            onChange={e => setProposed(parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              background: `linear-gradient(to right, var(--blue) 0%, var(--blue) ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono', color: 'var(--blue)', width: 26, textAlign: 'center' }}>
          {proposed}
        </span>
        <button
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 11 }}
          onClick={handleApply}
          disabled={applying || proposed === current}
        >
          {applying ? '...' : <><CheckCircle size={11} /> Apply</>}
        </button>
      </div>
      <p style={{ fontSize: 10, color: 'var(--text3)' }}>Current: {current}. Maximum concurrent copy jobs.</p>
    </div>
  );
}
