import { useState, useMemo, useCallback, useId, useEffect } from "react";
import {
  Disc3,
  ListOrdered,
  ShieldCheck,
  WifiOff,
  Sun,
  Moon,
  LayoutDashboard,
  Film,
  ShoppingCart,
} from "lucide-react";
import { SmartCopyProvider, useSmartCopy } from "./contexts/SmartCopyContext";
import { SearchBar } from "./components/SearchBar";
import { CategoryFilter } from "./components/CategoryFilter";
import { MediaGrid } from "./components/MediaGrid";
import { JobQueue } from "./components/JobQueue";
import { MediaSelectionDrawer } from "./components/MediaSelectionDrawer";
import { AdminDashboardModern } from "./components/AdminDashboardModern";
import { FeaturedCarousel } from "./components/FeaturedCarousel";
import { CopyModal } from "./components/CopyModal";
import { ToastContainer } from "./components/Toast";
import type { ToastData, ToastType } from "./components/Toast";
import { authApi, setAuthToken, getStoredToken } from "./lib/api";
import type { Media, DeliveryType, PaymentMode } from "./lib/types";

// ─── Dark Mode ────────────────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("sc_theme");
    return stored ? stored === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("sc_theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

// ─── Toast hook ───────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const uid = useId();
  let counter = 0;

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `${uid}-${++counter}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
    },
    [uid],
  ); // eslint-disable-line

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !pass) return;
    setBusy(true);
    setErr("");
    try {
      const res = await authApi.login(user, pass);
      setAuthToken(res.access_token);
      onLogin();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, var(--accent), transparent)",
          }}
        />
      </div>

      <div
        className="w-full max-w-sm card-elevated p-8 scale-in"
        style={{ background: "var(--surface)" }}
      >
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), var(--accent2))",
            }}
          >
            <Disc3 className="w-8 h-8" style={{ color: "#07070d" }} />
          </div>
          <h1 className="text-2xl font-black brand-text">SmartCopy</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
            سیستم مدیریت کپی رسانه
          </p>
        </div>

        {err && (
          <div
            className="mb-4 p-3 rounded-xl text-sm fade-in"
            style={{
              background: "rgba(255,77,109,.1)",
              border: "1px solid rgba(255,77,109,.25)",
              color: "var(--red)",
            }}
          >
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
              style={{ color: "var(--text2)" }}
            >
              نام کاربری
            </label>
            <input
              className="input-field"
              type="text"
              value={user}
              placeholder="admin"
              autoComplete="username"
              onChange={(e) => setUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div>
            <label
              className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
              style={{ color: "var(--text2)" }}
            >
              رمز عبور
            </label>
            <input
              className="input-field"
              type="password"
              value={pass}
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <button
            onClick={submit}
            disabled={busy || !user || !pass}
            className="btn-primary w-full py-3 text-base"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            ورود به پنل
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer App ─────────────────────────────────────────────────────────────

function CustomerApp({
  onAdminClick,
  addToast,
  dark,
  toggleDark,
}: {
  onAdminClick: () => void;
  addToast: (type: ToastType, title: string, msg?: string) => void;
  dark: boolean;
  toggleDark: () => void;
}) {
  const {
    media,
    drives,
    jobsList,
    pricingTiers,
    selectedCategory,
    searchQuery,
    loading,
    error,
    wsConnected,
    activeJobCount,
    setCategory,
    setSearchQuery,
    createJob,
    cancelJob,
  } = useSmartCopy();

  const [selectedMediaItems, setSelectedMediaItems] = useState<Media[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  // FIX: CopyModal state for single-item copy (play button)
  const [copyModalMedia, setCopyModalMedia] = useState<Media | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedMediaItems.map((m) => m.id)),
    [selectedMediaItems],
  );

  const toggleSelection = (m: Media) => {
    setSelectedMediaItems((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      if (exists) return prev.filter((x) => x.id !== m.id);
      return [...prev, m];
    });
  };

  const removeMedia = (id: string) => {
    setSelectedMediaItems((prev) => prev.filter((x) => x.id !== id));
  };

  const filtered = useMemo(
    () =>
      media.filter((item) => {
        const byCategory =
          selectedCategory === "all" || item.type === selectedCategory;
        const bySearch = item.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return byCategory && bySearch;
      }),
    [media, selectedCategory, searchQuery],
  );

  const mediaMap = useMemo(() => {
    const m = new Map<string, string>();
    media.forEach((item) => m.set(item.id, item.name));
    return m;
  }, [media]);

  // FIX: Updated signature to include deliveryType
  const handleBatchRequest = async (
    driveId: string | null,
    paymentMode: PaymentMode,
    deliveryType: DeliveryType,
  ) => {
    if (selectedMediaItems.length === 0) return;
    try {
      for (const mediaItem of selectedMediaItems) {
        await createJob(mediaItem.id, driveId, deliveryType, paymentMode);
      }
      setIsDrawerOpen(false);
      setSelectedMediaItems([]);
      setShowQueue(true);
      addToast(
        "success",
        "درخواست‌ها ثبت شد",
        paymentMode === "manual"
          ? "به میز مدیریت مراجعه کنید."
          : `${selectedMediaItems.length} فیلم در صف قرار گرفت`,
      );
    } catch (err) {
      addToast("error", "خطا در ثبت درخواست", (err as Error).message);
    }
  };

  // FIX: Single-item copy via CopyModal (play button)
  const handleSingleCopy = async (
    driveId: string | null,
    deliveryType: DeliveryType,
    paymentMode: PaymentMode,
    _amountCents?: number,
  ) => {
    if (!copyModalMedia) return;
    try {
      await createJob(copyModalMedia.id, driveId, deliveryType, paymentMode);
      setCopyModalMedia(null);
      setShowQueue(true);
      addToast("success", "درخواست ثبت شد", copyModalMedia.name);
    } catch (err) {
      addToast("error", "خطا", (err as Error).message);
      setCopyModalMedia(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      addToast("info", "لغو شد", "کار کپی لغو شد");
    } catch (err) {
      addToast("error", "خطا", (err as Error).message);
    }
  };

  if (loading) return <CustomerSkeleton />;

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--bg)" }}
      >
        <div className="card p-8 max-w-md text-center scale-in">
          <div className="text-5xl mb-4">⚠️</div>
          <h2
            className="font-bold text-lg mb-2"
            style={{ color: "var(--text)" }}
          >
            خطا در اتصال
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--red)" }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 glass-header">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent2))",
              }}
            >
              <Disc3 className="w-4 h-4" style={{ color: "#07070d" }} />
            </div>
            <span className="font-black text-lg brand-text">SmartCopy</span>
          </div>

          {/* Center – stats bar */}
          <div
            className="hidden sm:flex items-center gap-4 text-xs"
            style={{ color: "var(--text3)" }}
          >
            <span className="flex items-center gap-1.5">
              <Film className="w-3 h-3" />
              {media.length.toLocaleString("fa")} عنوان
            </span>
            <span className="flex items-center gap-1.5">
              <div className={`live-dot ${wsConnected ? "" : "offline"}`} />
              {wsConnected ? "متصل" : "قطع"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--text2)" }}
            >
              {dark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Cart button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className={`relative p-2 rounded-lg transition-all ${isDrawerOpen ? "bg-accent/10" : "hover:bg-white/5"}`}
              style={{ color: isDrawerOpen ? "var(--accent)" : "var(--text2)" }}
            >
              <ShoppingCart className="w-5 h-5" />
              {selectedMediaItems.length > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-black text-xs font-black flex items-center justify-center"
                  style={{ background: "var(--accent)", fontSize: "10px" }}
                >
                  {selectedMediaItems.length}
                </span>
              )}
            </button>

            {/* Queue button */}
            <button
              onClick={() => setShowQueue((q) => !q)}
              className={`relative p-2 rounded-lg transition-all ${showQueue ? "bg-white/8" : "hover:bg-white/5"}`}
              style={{ color: showQueue ? "var(--accent)" : "var(--text2)" }}
            >
              <ListOrdered className="w-5 h-5" />
            </button>

            {/* Admin */}
            {getStoredToken() && (
              <button
                onClick={onAdminClick}
                className="p-2 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text2)" }}
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <CategoryFilter selected={selectedCategory} onChange={setCategory} />
        </div>

        {/* Featured Carousel */}
        <FeaturedCarousel
          onCopy={(mediaId) => {
            const m = media.find((x) => x.id === mediaId);
            if (m) toggleSelection(m);
          }}
        />

        <div
          className={`grid gap-5 ${showQueue ? "lg:grid-cols-[1fr_320px]" : ""}`}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--text2)" }}
              >
                <span
                  className="font-black text-base"
                  style={{ color: "var(--text)" }}
                >
                  {filtered.length.toLocaleString("fa")}
                </span>{" "}
                عنوان یافت شد
              </h2>
              {drives.length === 0 && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{
                    color: "var(--orange)",
                    background: "rgba(255,124,77,.08)",
                    border: "1px solid rgba(255,124,77,.2)",
                    borderRadius: "100px",
                    padding: "4px 10px",
                  }}
                >
                  <WifiOff className="w-3 h-3" />
                  درایو USB شناسایی نشده
                </div>
              )}
            </div>

            {/* FIX: pass onPlay to MediaGrid → MediaCard */}
            <MediaGrid
              media={filtered}
              onSelect={toggleSelection}
              onPlay={setCopyModalMedia}
              selectedIds={selectedIds}
              disabled={drives.length === 0}
            />
          </div>

          {/* Queue panel */}
          {showQueue && (
            <div className="lg:col-span-1">
              <div className="card sticky top-20 overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h2
                    className="font-bold text-sm"
                    style={{ color: "var(--text)" }}
                  >
                    صف کپی
                    {activeJobCount > 0 && (
                      <span className="mr-2 chip chip-active">
                        {activeJobCount} فعال
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={() => setShowQueue(false)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs hover:bg-white/8 transition-colors"
                    style={{ color: "var(--text3)" }}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  <JobQueue
                    jobs={jobsList}
                    mediaMap={mediaMap}
                    onCancel={handleCancelJob}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Selection Drawer (Cart) */}
      {isDrawerOpen && (
        <MediaSelectionDrawer
          selectedMedia={selectedMediaItems}
          onRemove={removeMedia}
          onClear={() => setSelectedMediaItems([])}
          onClose={() => setIsDrawerOpen(false)}
          onSubmit={handleBatchRequest}
          drives={drives}
        />
      )}

      {/* FIX: Single-item CopyModal (triggered from play button) */}
      {copyModalMedia && (
        <CopyModal
          media={copyModalMedia}
          drives={drives}
          pricingTiers={pricingTiers}
          onConfirm={handleSingleCopy}
          onClose={() => setCopyModalMedia(null)}
        />
      )}
    </div>
  );
}

// ─── Customer skeleton ────────────────────────────────────────────────────────

function CustomerSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="glass-header sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="skeleton w-32 h-6" />
          <div className="flex-1" />
          <div className="skeleton w-20 h-6" />
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-5">
          <div className="skeleton flex-1 h-10" />
          <div className="skeleton w-40 h-10" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "2/3" }} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#07070d] flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#e8c547] to-[#f0a500] flex items-center justify-center shadow-[0_0_50px_rgba(232,197,71,0.3)] animate-splash-pulse">
          <Disc3 className="w-12 h-12 text-black" />
        </div>
        <div className="absolute -inset-4 bg-[#e8c547]/10 rounded-[40px] blur-2xl animate-pulse delay-75" />
      </div>
      <h1 className="mt-10 text-4xl font-black brand-text tracking-tighter">
        SmartCopy Pro
      </h1>
      <p className="mt-2 text-[#8888a8] text-[10px] uppercase font-bold tracking-[0.3em]">
        Master Media Distribution
      </p>
      <div className="mt-8 w-40 h-1 bg-white/5 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 bg-accent animate-progress-fast" />
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<"customer" | "admin" | "login">("customer");
  const [init, setInit] = useState(true);
  const { toasts, addToast, dismiss } = useToasts();
  const { dark, toggle: toggleDark } = useDarkMode();

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      setAuthToken(token);
      if (window.location.hash === "#admin") setView("admin");
    }

    const timer = setTimeout(() => setInit(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  const handleAdminClick = () => {
    if (getStoredToken()) setView("admin");
    else setView("login");
  };

  const handleLogin = () => {
    addToast("success", "خوش آمدید", "به پنل مدیریت وارد شدید.");
    setView("admin");
  };

  const handleLogout = () => {
    setAuthToken(null);
    setView("customer");
    addToast("info", "خروج", "از سیستم خارج شدید.");
  };

  return (
    <SmartCopyProvider>
      {init && <SplashScreen />}

      <div
        className={`min-h-screen live-bg transition-opacity duration-700 ${init ? "opacity-0" : "opacity-100"}`}
      >
        {view === "login" ? (
          <LoginScreen onLogin={handleLogin} />
        ) : view === "admin" ? (
          <AdminDashboardModern
            onBack={() => setView("customer")}
            onLogout={handleLogout}
            addToast={addToast}
          />
        ) : (
          <CustomerApp
            onAdminClick={handleAdminClick}
            addToast={addToast}
            dark={dark}
            toggleDark={toggleDark}
          />
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </SmartCopyProvider>
  );
}
