import { useState, useEffect } from 'react';
import { Server, Cpu, Globe, Save, Info, HardDrive, Monitor } from 'lucide-react';
import { adminApi } from '../lib/api';
// TerminalProvisioning removed - functionality merged into modern dash or handled elsewhere

export function SettingsConfigPanel({
  addToast
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'media' | 'architecture' | 'terminals'>('media');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [mediaServerUrl, setMediaServerUrl] = useState('');
  const [agentStrategy, setAgentStrategy] = useState<'distributed' | 'centralized'>('distributed');
  const [maxMobileDl, setMaxMobileDl] = useState(5);
  const [mobileThrottle, setMobileThrottle] = useState(0);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await adminApi.settings();
      if (res.settings.media_server_url) setMediaServerUrl(res.settings.media_server_url);
      if (res.settings.agent_strategy) setAgentStrategy(res.settings.agent_strategy as any);
      if (res.settings.max_concurrent_mobile_downloads) setMaxMobileDl(parseInt(res.settings.max_concurrent_mobile_downloads, 10));
      if (res.settings.mobile_throttle_kbps) setMobileThrottle(parseInt(res.settings.mobile_throttle_kbps, 10));
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        adminApi.updateSetting('media_server_url', mediaServerUrl),
        adminApi.updateSetting('agent_strategy', agentStrategy),
        adminApi.updateSetting('max_concurrent_mobile_downloads', String(maxMobileDl)),
        adminApi.updateSetting('mobile_throttle_kbps', String(mobileThrottle)),
      ]);
      addToast('success', 'تنظیمات ذخیره شد', 'تغییرات با موفقیت اعمال شد.');
    } catch (e) {
      addToast('error', 'خطا در ذخیره', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm" style={{ color: 'var(--text3)' }}>در حال بارگذاری تنظیمات...</p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden fade-up">
      {/* Tab Header */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'media' ? 'bg-white/5 active-tab-indicator' : 'hover:bg-white/5'
          }`}
          style={{ color: activeTab === 'media' ? 'var(--accent)' : 'var(--text3)' }}
        >
          <Server className="w-4 h-4" />
          مسیر سرور رسانه
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'architecture' ? 'bg-white/5 active-tab-indicator' : 'hover:bg-white/5'
          }`}
          style={{ color: activeTab === 'architecture' ? 'var(--accent)' : 'var(--text3)' }}
        >
          <Cpu className="w-4 h-4" />
          معماری شبکه
        </button>
        <button
          onClick={() => setActiveTab('terminals')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'terminals' ? 'bg-white/5 active-tab-indicator' : 'hover:bg-white/5'
          }`}
          style={{ color: activeTab === 'terminals' ? 'var(--accent)' : 'var(--text3)' }}
        >
          <Monitor className="w-4 h-4" />
          مدیریت ترمینال‌ها
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'media' && (
          <div className="space-y-4 fade-in">
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text2)' }}>
                آدرس سرور رسانه (Media Server)
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text3)' }} />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="http://192.168.1.50:8000"
                  value={mediaServerUrl}
                  onChange={(e) => setMediaServerUrl(e.target.value)}
                />
              </div>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text3)' }}>
                <Info className="w-3 h-3 inline-block ml-1" />
                اگر فایل‌های فیلم روی سرور دیگری هستند، آدرس آن را اینجا وارد کنید. کلاینت‌ها فایل‌ها را مستقیماً از این آدرس دانلود خواهند کرد.
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <h4 className="text-xs font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--blue)' }}>
                <HardDrive className="w-3 h-3" />
                راهنمای مسیردهی
              </h4>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                در صورت خالی بودن، از آدرس سرور فعلی استفاده می‌شود. برای شبکه‌های محلی (LAN) استفاده از IP ثابت پیشنهاد می‌شود.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase opacity-60">حداکثر دانلود موبایل همزمان</label>
                <input 
                  type="number" 
                  className="input-field py-2 text-sm" 
                  value={maxMobileDl} 
                  onChange={e => setMaxMobileDl(parseInt(e.target.value, 10))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold mb-1.5 uppercase opacity-60">محدودیت سرعت (KB/s)</label>
                <input 
                  type="number" 
                  className="input-field py-2 text-sm" 
                  value={mobileThrottle} 
                  onChange={e => setMobileThrottle(parseInt(e.target.value, 10))}
                  placeholder="۰ = بدون محدودیت"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-6 fade-in">
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setAgentStrategy('distributed')}
                className={`p-4 rounded-xl border text-right transition-all group ${
                  agentStrategy === 'distributed' ? 'selected-strategy' : 'hover:bg-white/5'
                }`}
                style={{ borderColor: agentStrategy === 'distributed' ? 'var(--accent)' : 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    agentStrategy === 'distributed' ? 'bg-accent text-black' : 'bg-white/10 text-white'
                  }`}>
                    توزیع شده (Distributed)
                  </span>
                  <Cpu className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    agentStrategy === 'distributed' ? 'text-accent' : 'text-gray-500'
                  }`} />
                </div>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>یک عامل برای هر کلاینت</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                  ایده‌آل برای ۱۰۰+ کلاینت در شبکه‌های مختلف. هر کامپیوتری که USB به آن وصل می‌شود به عنوان یک گره مستقل عمل می‌کند.
                </p>
              </button>

              <button
                onClick={() => setAgentStrategy('centralized')}
                className={`p-4 rounded-xl border text-right transition-all group ${
                  agentStrategy === 'centralized' ? 'selected-strategy' : 'hover:bg-white/5'
                }`}
                style={{ borderColor: agentStrategy === 'centralized' ? 'var(--accent)' : 'var(--border)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    agentStrategy === 'centralized' ? 'bg-accent text-black' : 'bg-white/10 text-white'
                  }`}>
                    متمرکز (Centralized)
                  </span>
                  <Server className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    agentStrategy === 'centralized' ? 'text-accent' : 'text-gray-500'
                  }`} />
                </div>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--text)' }}>یک عامل روی سرور رسانه</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                  ایده‌آل برای زمانی که سرور رسانه قدرتمند است و کلاینت‌ها فقط تقاضا می‌دهند. عامل همیشه روی سرور رسانه بیدار و آماده است.
                </p>
              </button>
            </div>
            
            {agentStrategy === 'centralized' && (
              <div className="p-4 rounded-xl border-dashed border-2 flex flex-col items-center gap-2 text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
                  در حالت متمرکز، شما باید یک ترمینال را به عنوان گره اصلی انتخاب کنید.
                </p>
                <button 
                  onClick={() => setActiveTab('terminals')}
                  className="btn-ghost text-[10px] text-accent"
                >
                  برو به لیست ترمینال‌ها برای تعیین سرور اصلی ←
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'terminals' && (
          <div className="fade-in py-12 text-center" style={{ color: 'var(--text3)' }}>
            <Monitor className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-sm">مدیریت جزئی‌تر ترمینال‌ها در تب "درایوها و ترمینال" در منوی اصلی در دسترس است.</p>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary py-2.5 px-8 flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            ذخیره تنظیمات
          </button>
        </div>
      </div>
      
      <style>{`
        .active-tab-indicator {
          box-shadow: inset 0 -2px 0 var(--accent);
        }
        .selected-strategy {
          background: rgba(var(--accent-rgb), 0.05);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}
