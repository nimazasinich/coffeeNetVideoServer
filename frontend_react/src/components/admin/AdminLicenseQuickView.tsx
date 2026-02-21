/**
 * AdminLicenseQuickView v3 — Enterprise Light Theme.
 * Status and management of the software license.
 * Uses modal input instead of browser alert/prompt.
 */
import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Shield, ShieldCheck, ShieldAlert, Award, Calendar, Activity, X, Check } from 'lucide-react';
import { adminApi } from '../../lib/api';

export function AdminLicenseQuickView({ addToast }: {
  addToast?: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [lic, setLic] = useState<{ valid?: boolean; status?: string; tier?: string; expires_at?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [licenseText, setLicenseText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = () => adminApi.license().then(setLic).catch(() => setLic(null));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (showInput) textareaRef.current?.focus(); }, [showInput]);

  const handleUpload = async () => {
    const key = licenseText.trim();
    if (!key) return;
    setUploading(true);
    try {
      await adminApi.uploadLicense(key);
      setShowInput(false);
      setLicenseText('');
      if (addToast) addToast('success', 'License applied', 'Your license has been validated and activated.');
      load();
    } catch (e) {
      if (addToast) addToast('error', 'License error', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (!lic)
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-[var(--adm-primary)]" />
        <p className="text-xs font-bold text-[var(--adm-text-muted)]">Checking license...</p>
      </div>
    );

  const isValid = lic.valid;

  return (
    <div className="space-y-6 adm-animate-in">
      <div
        className={`p-8 rounded-[32px] border-2 flex flex-col items-center text-center transition-all ${
          isValid 
            ? 'bg-green-50/50 border-green-100 shadow-sm' 
            : 'bg-red-50/50 border-red-100 shadow-sm'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-inner ${
            isValid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
          }`}
        >
          {isValid ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
        </div>
        
        <h4 className={`text-xl font-black uppercase tracking-widest ${isValid ? 'text-green-700' : 'text-red-700'}`}>
          {lic.status || 'No License'}
        </h4>
        
        <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-white border border-[var(--adm-border)] shadow-sm">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-black text-[var(--adm-text-secondary)] uppercase">Tier: {lic.tier ?? 'Basic'}</span>
        </div>

        {lic.expires_at && (
          <div className="flex items-center gap-2 mt-4 text-[var(--adm-text-muted)]">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">Expires: {new Date(lic.expires_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Inline license input (no browser alert/prompt) */}
      {showInput && (
        <div className="adm-card p-4 space-y-3 border-2 border-[var(--adm-primary)]/20">
          <p className="text-xs font-bold text-[var(--adm-text-secondary)]">Paste your license JSON below:</p>
          <textarea
            ref={textareaRef}
            value={licenseText}
            onChange={e => setLicenseText(e.target.value)}
            rows={5}
            className="w-full text-[11px] font-mono p-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] text-[var(--adm-text-main)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--adm-primary)]/30"
            placeholder='{"signature":"...","tier":"professional","expires_at":"..."}'
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading || !licenseText.trim()}
              className="adm-btn adm-btn-primary flex-1 h-10"
            >
              {uploading ? <Activity className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Apply License</span>
            </button>
            <button
              onClick={() => { setShowInput(false); setLicenseText(''); }}
              className="adm-btn adm-btn-secondary h-10 px-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            disabled={uploading}
            className="adm-btn adm-btn-primary w-full h-12 shadow-lg shadow-[var(--adm-primary)]/10"
          >
            {uploading ? <Activity className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            <span>Upgrade or Renew License</span>
          </button>
        )}
        <p className="text-[9px] text-center text-[var(--adm-text-muted)] font-medium leading-relaxed px-4">
          To change access level or increase client count, paste the new license provided by support.
        </p>
      </div>
    </div>
  );
}
