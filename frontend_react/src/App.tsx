/**
 * SmartCopy Pro — App Shell (Merged v4+v6)
 * V6 visual base + V4 features: SplashScreen, dark mode, multi-select, JobQueue, MediaSelectionDrawer
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Zap, LayoutDashboard, LogOut, LogIn, X, Lock, Eye, EyeOff, WifiOff,
  Sun, Moon, ShoppingCart, ListOrdered, Film, Disc3, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { SmartCopyProvider, useSmartCopy } from './context/SmartCopyContext';
import { ToastContainer } from './components/Toast';
import { SearchBar } from './components/SearchBar';
import { CategoryFilter } from './components/CategoryFilter';
import { MediaGrid } from './components/MediaGrid';
import { FeaturedCarousel } from './components/FeaturedCarousel';
import { CopyModal } from './components/CopyModal';
import { JobQueue } from './components/JobQueue';
import { MediaSelectionDrawer } from './components/MediaSelectionDrawer';
import { AdminDashboardModern } from './components/AdminDashboardModern';
import { authApi, setAuthToken, getStoredToken } from './lib/api';
import type { Media, PaymentMode, DeliveryType } from './lib/types';

/* ─── Dark Mode ──────────────────────────────────────────────── */
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('sc_theme');
    return stored ? stored === 'dark' : true;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem('sc_theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

/* ─── Splash Screen ──────────────────────────────────────────── */
function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#07070d',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 28,
          background: 'linear-gradient(135deg, var(--blue2), var(--cyan))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 50px rgba(77,159,255,0.35)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          <Disc3 size={44} color="white" />
        </div>
      </div>
      <h1 style={{
        marginTop: 40, fontSize: 36, fontWeight: 900,
        background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.03em',
      }}>SmartCopy Pro</h1>
      <p style={{ marginTop: 8, color: 'var(--text3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
        Master Media Distribution
      </p>
      <div style={{ marginTop: 32, width: 160, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg,var(--blue),var(--cyan))',
          animation: 'progressFast 2.2s ease forwards',
        }} />
      </div>
      <style>{`
        @keyframes progressFast { from { width: 0 } to { width: 100% } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 50px rgba(77,159,255,.35) } 50% { box-shadow: 0 0 80px rgba(77,159,255,.6) } }
      `}</style>
    </div>
  );
}

/* ─── Login Modal ────────────────────────────────────────────── */
function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { addToast } = useSmartCopy();
  const [user,    setUser]    = useState('');
  const [pass,    setPass]    = useState('');
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleLogin = async () => {
    if (!user || !pass) { setError('Enter username and password'); return; }
    setLoading(true); setError('');
    try {
      const res = await authApi.login(user, pass);
      setAuthToken(res.access_token);
      addToast('success', 'Login Successful', 'Welcome to Admin Panel');
      onSuccess();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-2)',
        animation: 'scaleIn 0.25s ease',
      }}>
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: 'linear-gradient(135deg,var(--blue2),var(--cyan))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px var(--blue-glow)',
          }}>
            <Lock size={18} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>Admin Login</h2>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>SmartCopy Pro</p>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ marginLeft: 'auto', width: 30, height: 30 }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Username</label>
              <input className="input-field" type="text" placeholder="admin" value={user}
                onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type={show ? 'text' : 'password'} placeholder="••••••••"
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ paddingRight: 36 }} />
                <button style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 2,
                }} onClick={() => setShow(s => !s)}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && (
              <p style={{ fontSize: 11, color: 'var(--red)', padding: '8px 10px', background: 'var(--red-dim)', borderRadius: 'var(--r-sm)' }}>
                {error}
              </p>
            )}
            <button className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: 4 }}
              onClick={handleLogin} disabled={loading}>
              {loading
                ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                : <LogIn size={14} />}
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Offline Banner ─────────────────────────────────────────── */
function OfflineBanner() {
  const { serverOnline } = useSmartCopy();
  if (serverOnline) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
      background: 'rgba(255,85,119,0.1)', borderBottom: '1px solid rgba(255,85,119,0.25)',
      fontSize: 11, color: 'var(--red)',
    }}>
      <WifiOff size={12} />
      Server offline — start the backend at{' '}
      <code style={{ fontFamily: 'DM Mono', background: 'rgba(255,85,119,0.15)', padding: '1px 5px', borderRadius: 4 }}>
        http://localhost:8000
      </code>
    </div>
  );
}

/* ─── Customer App ───────────────────────────────────────────── */
function CustomerApp({
  onAdminClick, dark, toggleDark,
}: {
  onAdminClick: () => void; dark: boolean; toggleDark: () => void;
}) {
  const {
    media, drives, pricingTiers, loading, error, wsConnected, addToast,
    selectedCategory, searchQuery, setCategory, setSearchQuery,
    jobsList, activeJobCount, createJob, cancelJob,
  } = useSmartCopy();

  const [selectedMediaItems, setSelectedMediaItems] = useState<Media[]>([]);
  const [isDrawerOpen,  setIsDrawerOpen ] = useState(false);
  const [showQueue,     setShowQueue    ] = useState(false);
  const [copyModalMedia, setCopyModalMedia] = useState<Media | null>(null);

  const selectedIds = useMemo(() => new Set(selectedMediaItems.map(m => m.id)), [selectedMediaItems]);

  const toggleSelection = useCallback((m: Media) => {
    setSelectedMediaItems(prev => prev.find(x => x.id === m.id) ? prev.filter(x => x.id !== m.id) : [...prev, m]);
  }, []);

  const filtered = useMemo(() => media.filter(item => {
    const byCategory = selectedCategory === 'all' || item.type === selectedCategory;
    const bySearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return byCategory && bySearch;
  }), [media, selectedCategory, searchQuery]);

  const mediaMap = useMemo(() => {
    const m = new Map<string, string>();
    media.forEach(item => m.set(item.id, item.name));
    return m;
  }, [media]);

  const handleBatchRequest = async (driveId: string | null, paymentMode: PaymentMode, deliveryType: DeliveryType) => {
    if (!selectedMediaItems.length) return;
    try {
      for (const item of selectedMediaItems) await createJob(item.id, driveId, deliveryType, paymentMode);
      setIsDrawerOpen(false);
      setSelectedMediaItems([]);
      setShowQueue(true);
      addToast('success', 'Requests submitted', `${selectedMediaItems.length} items queued`);
    } catch (err) {
      addToast('error', 'Request error', (err as Error).message);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try { await cancelJob(jobId); addToast('info', 'Job cancelled', ''); }
    catch (err) { addToast('error', 'Error', (err as Error).message); }
  };

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ height: 44, background: 'var(--glass)', borderRadius: 10, border: '1px solid var(--border)' }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <AlertTriangle size={56} style={{ color: 'var(--red)', margin: '0 auto 16px' }} />
        <h2 style={{ color: 'var(--text1)', marginBottom: 8 }}>Connection Error</h2>
        <p style={{ color: 'var(--red)', marginBottom: 24, fontSize: 13 }}>{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: 'linear-gradient(145deg,var(--blue2),var(--cyan))',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px var(--blue-glow)', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
          }}>
            <Zap size={17} color="white" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            SmartCopy <span style={{ color: 'var(--blue)' }}>Pro</span>
          </div>
        </div>

        {/* Center stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Film size={12} />
            {media.length} titles
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className={`live-dot ${wsConnected ? '' : 'offline'}`} style={{ width: 6, height: 6, borderRadius: '50%', background: wsConnected ? 'var(--green)' : 'var(--red)' }} />
            {wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="btn-icon"
            style={{ width: 32, height: 32 }}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Cart */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            style={{
              position: 'relative', width: 32, height: 32, borderRadius: 8,
              background: isDrawerOpen ? 'var(--blue-dim)' : 'var(--glass)',
              border: '1px solid var(--border)', color: isDrawerOpen ? 'var(--blue)' : 'var(--text3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Selection cart"
          >
            <ShoppingCart size={14} />
            {selectedMediaItems.length > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, width: 16, height: 16,
                background: 'var(--blue)', borderRadius: '50%', fontSize: 9, fontWeight: 800,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selectedMediaItems.length}
              </span>
            )}
          </button>

          {/* Queue */}
          <button
            onClick={() => setShowQueue(q => !q)}
            style={{
              position: 'relative', width: 32, height: 32, borderRadius: 8,
              background: showQueue ? 'var(--glass)' : 'var(--glass)',
              border: '1px solid var(--border)', color: showQueue ? 'var(--blue)' : 'var(--text3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Job queue"
          >
            <ListOrdered size={14} />
            {activeJobCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, width: 16, height: 16,
                background: 'var(--green)', borderRadius: '50%', fontSize: 9, fontWeight: 800,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeJobCount}
              </span>
            )}
          </button>

          {/* Online badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
            background: 'var(--green-dim)', border: '1px solid rgba(0,245,160,0.28)',
            borderRadius: 99, fontSize: 10, fontWeight: 700, color: 'var(--green)',
            letterSpacing: '0.05em', boxShadow: '0 0 10px var(--green-glow)',
          }}>
            <span className="pulse-dot" />
            Online
          </div>

          {/* Admin */}
          {getStoredToken() ? (
            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={onAdminClick}>
              <LayoutDashboard size={12} /> Admin
            </button>
          ) : (
            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={onAdminClick}>
              <Lock size={12} /> Admin
            </button>
          )}
        </div>
      </header>

      <OfflineBanner />

      {/* ── Main ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FeaturedCarousel onSelect={m => toggleSelection(m)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SearchBar />
          <CategoryFilter />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4 }}>
          <div style={{ width: 3, height: 16, background: 'var(--blue)', borderRadius: 99, boxShadow: '0 0 8px var(--blue)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Media Library &nbsp;
            <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({filtered.length})</span>
          </span>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: showQueue ? '1fr 320px' : '1fr' }}>
          <div>
            <MediaGrid onSelect={m => toggleSelection(m)} selectedIds={selectedIds} onPlay={setCopyModalMedia} />
          </div>
          {showQueue && (
            <div>
              <div style={{
                position: 'sticky', top: 80, background: 'var(--glass)', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', overflow: 'hidden', backdropFilter: 'blur(20px)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>
                    Job Queue
                    {activeJobCount > 0 && (
                      <span style={{
                        marginLeft: 8, padding: '2px 7px', borderRadius: 99, fontSize: 9,
                        background: 'var(--green-dim)', color: 'var(--green)', fontWeight: 700,
                      }}>{activeJobCount} active</span>
                    )}
                  </span>
                  <button className="btn-icon" onClick={() => setShowQueue(false)} style={{ width: 24, height: 24 }}>
                    <X size={12} />
                  </button>
                </div>
                <div style={{ padding: 12, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                  <JobQueue jobs={jobsList} mediaMap={mediaMap} onCancel={handleCancelJob} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Drawers & Modals ── */}
      {isDrawerOpen && (
        <MediaSelectionDrawer
          selectedMedia={selectedMediaItems}
          onRemove={id => setSelectedMediaItems(prev => prev.filter(x => x.id !== id))}
          onClear={() => setSelectedMediaItems([])}
          onClose={() => setIsDrawerOpen(false)}
          onSubmit={handleBatchRequest}
          drives={drives}
        />
      )}
      {copyModalMedia && (
        <CopyModal
          media={copyModalMedia}
          drives={drives}
          pricingTiers={pricingTiers}
          onClose={() => { setCopyModalMedia(null); setShowQueue(true); }}
        />
      )}
    </div>
  );
}

/* ─── AdminDashboardWrapper (connects to context toasts) ─────── */
function AdminDashboardWrapper({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  const { addToast } = useSmartCopy();
  return (
    <AdminDashboardModern addToast={addToast} onBack={onBack} onLogout={onLogout} />
  );
}

/* ─── Root App ───────────────────────────────────────────────── */
export default function App() {
  const [view,  setView ] = useState<'customer' | 'admin' | 'login'>('customer');
  const [init,  setInit ] = useState(true);
  const { dark, toggle: toggleDark } = useDarkMode();

  useEffect(() => {
    const token = getStoredToken();
    if (token) setAuthToken(token);
    if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      setView(token ? 'admin' : 'login');
    }
    const onExpired = () => {
      setView('login');
    };
    window.addEventListener('sc:auth:expired', onExpired);
    const timer = setTimeout(() => setInit(false), 2200);
    return () => { window.removeEventListener('sc:auth:expired', onExpired); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (view === 'admin') document.documentElement.classList.add('light');
    else document.documentElement.classList.toggle('light', !dark);
  }, [dark, view]);

  return (
    <SmartCopyProvider>
      {init && <SplashScreen />}
      <div style={{ minHeight: '100vh', opacity: init ? 0 : 1, transition: 'opacity 0.7s ease' }}>
        {view === 'login' ? (
          <LoginModal
            onClose={() => setView('customer')}
            onSuccess={() => setView('admin')}
          />
        ) : view === 'admin' ? (
          <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AdminDashboardWrapper
              onBack={() => setView('customer')}
              onLogout={() => { setAuthToken(null); setView('customer'); }}
            />
          </div>
        ) : (
          <CustomerApp
            onAdminClick={() => setView(getStoredToken() ? 'admin' : 'login')}
            dark={dark}
            toggleDark={toggleDark}
          />
        )}
      </div>
      <ToastContainer />
    </SmartCopyProvider>
  );
}
