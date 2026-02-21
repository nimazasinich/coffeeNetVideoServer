import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, FolderOpen, AlertCircle } from 'lucide-react';
import { adminApi } from '../lib/api';

interface Props {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}

const EDITABLE_KEYS = [
  { key: 'media_root',             label: 'Media Files Path',              icon: <FolderOpen size={13} /> },
  { key: 'max_copies_per_session', label: 'Max Concurrent Copies' },
  { key: 'max_mobile_downloads',   label: 'Max Concurrent Mobile Downloads' },
  { key: 'mobile_throttle_kbps',   label: 'Speed Limit (KB/s, 0=unlimited)' },
  { key: 'price_base_usd',         label: 'Base Price (USD)' },
];

export function SettingsConfigPanel({ addToast }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [edits,    setEdits]    = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.settings();
      setSettings(res.settings ?? {});
      setEdits(res.settings ?? {});
    } catch (e) {
      setError((e as Error).message || 'Failed to load settings');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async (key: string) => {
    setSaving(key);
    try {
      await adminApi.updateSetting(key, edits[key] ?? '');
      setSettings(prev => ({ ...prev, [key]: edits[key] ?? '' }));
      addToast('success', 'Saved', key);
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
    } finally { setSaving(null); }
  }, [edits, addToast]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '16px' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="skeleton" style={{ height: 10, width: 160, marginBottom: 6, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 38, borderRadius: 'var(--r-sm)' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div className="card-title" style={{ marginBottom: 16 }}>
        <SettingsIcon size={13} style={{ color: 'var(--blue)' }} />
        Server Settings
        <button className="btn-icon" style={{ width: 26, height: 26, marginLeft: 'auto' }} onClick={load}>
          <RefreshCw size={11} />
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--red-dim)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--red)', marginBottom: 14 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {EDITABLE_KEYS.map(({ key, label, icon }) => {
          const isDirty = edits[key] !== settings[key];
          return (
            <div key={key}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text2)',
                marginBottom: 6,
              }}>
                {icon} {label}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-field"
                  value={edits[key] ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <button
                  className={isDirty ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '9px 14px', fontSize: 11, flexShrink: 0 }}
                  onClick={() => handleSave(key)}
                  disabled={saving === key || !isDirty}
                >
                  {saving === key ? '...' : <><Save size={12} /> Save</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
