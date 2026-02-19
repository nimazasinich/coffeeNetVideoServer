/**
 * Admin Dashboard Modern v3 — SmartCopy Pro
 * ─────────────────────────────────────────────
 * کامل‌ترین نسخه: شامل همه قابلیت‌های Backend
 *   • Overview + Live Stats
 *   • Job Queue Management
 *   • Drives & Agents (approve/deny/master)
 *   • Media Library (toggle copyable, scan)
 *   • Pricing Tiers (edit & save)
 *   • Sales & Daily Reports
 *   • Settings (media server, architecture)
 *   • Change Password
 *   • Functional Search
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, BarChart3, DollarSign, HardDrive, Cpu, Activity,
  RefreshCw, Menu, X, Clock, QrCode, Shield, Settings,
  Database, Search, Bell, LogOut, Film, Tag,
  ShoppingCart, ChevronLeft, Check, XCircle,
  Star, Scan, Lock, Unlock, TrendingUp, Zap,
  Server, Globe, Key, Eye, EyeOff, Save, Pencil, Trash2,
  Plus, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { adminApi, driveApi, wsClient, authApi } from '../lib/api';
import { formatPrice, formatBytes, formatDateTime } from '../lib/utils';
import { MetricCard } from './MetricCard';
import { ConsumptionChart } from './ConsumptionChart';
import { JobQueuePanel } from './JobQueuePanel';
import { LoadBalancerControl } from './LoadBalancerControl';
import { SettingsConfigPanel } from './SettingsConfigPanel';
import { ModalDrawer } from './ModalDrawer';
import { DriveAgentPanel } from './DriveAgentPanel'; // FIX: was unused, now wired in drives tab
import type {
  DashboardStats, DailyReport, Job, Drive, Agent,
  Media, PricingTier, Sale,
} from '../lib/types';

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview',  label: 'خلاصه وضعیت',       icon: LayoutDashboard },
  { id: 'queue',     label: 'مدیریت صف',          icon: BarChart3       },
  { id: 'drives',    label: 'درایوها و ترمینال',       icon: HardDrive       },  // UX: adopted from v2 redesign
  { id: 'media',     label: 'کتابخانه رسانه',      icon: Film            },
  { id: 'pricing',   label: 'قیمت‌گذاری',          icon: Tag             },
  { id: 'sales',     label: 'فروش و گزارشات',      icon: ShoppingCart    },
  { id: 'settings',  label: 'تنظیمات سیستم',      icon: Settings        },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  open, onClose, activeId, onNavigate, onBack,
}: {
  open: boolean; onClose: () => void; activeId: string;
  onNavigate: (id: string) => void; onBack?: () => void;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-[70] w-72 flex flex-col border-l border-white/5 transition-all duration-500 md:relative md:right-0 ${
          open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
        style={{ background: 'rgba(7,7,12,0.97)', backdropFilter: 'blur(20px)' }}
      >
        {/* Brand */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-[0_0_20px_rgba(232,197,71,0.3)]">  {/* UX: adopted from v2 redesign */}
              <Database className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white">SmartCopy</h2>
              <span className="text-[9px] uppercase tracking-widest text-[#E8C547]/60 font-black">Admin Panel v2</span>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-2 text-[#8888a8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-[#8888a8] mb-3 mt-2">مدیریت اصلی</p>
          {NAV_ITEMS.map((item) => {
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); onClose(); }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group relative overflow-hidden ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-[#eeeef5]/60 hover:bg-white/5 hover:text-white'
                }`}  /* UX: adopted from v2 redesign — larger targets, rounded-2xl */
              >
                <item.icon className={`w-5 h-5 transition-transform duration-500 group-hover:scale-110 ${active ? 'stroke-[2.5px]' : 'opacity-70'}`} />  {/* UX: adopted from v2 redesign */}
                <span className="text-sm font-bold tracking-tight">{item.label}</span>  {/* UX: adopted from v2 redesign */}
                {active && (
                  <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-accent rounded-l-full shadow-[0_0_10px_var(--accent)]" />  /* UX: adopted from v2 redesign — cleaner active bar */
                )}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-white/5">
            <p className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-[#8888a8] mb-3">سایر</p>
            {onBack && (
              <button
                onClick={onBack}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#eeeef5]/50 hover:bg-white/5 hover:text-white/80 transition-all"
              >
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-semibold">بازگشت به فروشگاه</span>
              </button>
            )}
          </div>
        </nav>

        {/* Sidebar Footer: Profile info — UX: adopted from v2 redesign */}
        <div className="p-4 mt-auto border-t border-white/5">
          <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#222236] border border-white/5 flex items-center justify-center overflow-hidden">
              <Database className="w-5 h-5 text-[#8888a8]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Administrator</p>
              <p className="text-[10px] text-[#8888a8] font-medium">Root Presence</p>
            </div>
            <Shield className="w-4 h-4 text-[#8888a8] hover:text-white cursor-pointer" />
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Media Library Panel ──────────────────────────────────────────────────────

function MediaLibraryPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [items,    setItems   ] = useState<Media[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search,   setSearch  ] = useState('');
  const [filter,   setFilter  ] = useState<'all' | 'movie' | 'series'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.adminMedia();
      setItems(res.media ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await adminApi.scan();
      addToast('success', 'اسکن کامل شد', `${r.files_found} فایل یافت شد`);
      load();
    } catch (e) {
      addToast('error', 'خطا در اسکن', (e as Error).message);
    } finally { setScanning(false); }
  };

  const toggleCopyable = async (item: Media) => {
    try {
      await adminApi.updateMediaCopyable(item.id, !item.is_copyable);
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, is_copyable: !m.is_copyable } : m));
      addToast('success', item.is_copyable ? 'غیرفعال شد' : 'فعال شد', item.name);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    }
  };

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter(m => m.type === filter);
    if (search.trim()) list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [items, filter, search]);

  const catBadge = (cat: string) => {
    const map: Record<string, string> = {
      '4K': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      'HD': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      'SD': 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    return map[cat] ?? 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">کتابخانه رسانه</h1>
          <p className="text-xs text-[#8888a8] mt-1">{items.length} فایل در سیستم</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8C547]/10 border border-[#E8C547]/20 text-[#E8C547] text-sm font-bold hover:bg-[#E8C547]/20 transition-all disabled:opacity-50"
          >
            <Scan className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'در حال اسکن...' : 'اسکن مجدد'}
          </button>
          <button onClick={load} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] hover:text-white hover:bg-white/10 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#44445a]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجوی فیلم یا سریال..."
            className="w-full h-10 bg-white/5 border border-white/5 rounded-xl pr-9 pl-4 text-sm text-white focus:border-[#E8C547]/30 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white/5 border border-white/5 rounded-xl">
          {(['all', 'movie', 'series'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filter === f ? 'bg-[#E8C547]/15 text-[#E8C547]' : 'text-[#8888a8] hover:text-white'
              }`}
            >
              {f === 'all' ? 'همه' : f === 'movie' ? '🎬 فیلم' : '📺 سریال'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-[#E8C547]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#44445a]">
            <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">فایلی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-right px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">نام</th>
                  <th className="text-right px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">نوع</th>
                  <th className="text-right px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">کیفیت</th>
                  <th className="text-right px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">حجم</th>
                  <th className="text-right px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">قیمت</th>
                  <th className="text-right px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">وضعیت</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3.5 font-medium text-white max-w-[220px]">
                      <span className="truncate block">{m.name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[#8888a8]">
                      {m.type === 'series' ? '📺 سریال' : '🎬 فیلم'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${catBadge(m.category)}`}>
                        {m.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#8888a8] text-xs font-mono">
                      {formatBytes(m.size_bytes)}
                    </td>
                    <td className="px-4 py-3.5 text-[#E8C547] font-bold text-xs">
                      {m.price_usd ? formatPrice(m.price_usd) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        m.is_copyable
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {m.is_copyable ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                        {m.is_copyable ? 'فعال' : 'مسدود'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleCopyable(m)}
                        title={m.is_copyable ? 'غیرفعال کردن' : 'فعال کردن'}
                        className={`opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg text-xs font-bold ${
                          m.is_copyable
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        {m.is_copyable ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pricing Panel ────────────────────────────────────────────────────────────

function PricingPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [tiers,   setTiers  ] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving ] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<{ name: string; max_size_gb: string; price_usd: string }>({ name: '', max_size_gb: '', price_usd: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.pricing();
      setTiers(r.tiers ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: PricingTier) => {
    setEditing(t.id);
    setEditVals({ name: t.name, max_size_gb: String(t.max_size_gb), price_usd: String(t.price_usd) });
  };

  const saveEdit = () => {
    setTiers(prev => prev.map(t =>
      t.id === editing
        ? { ...t, name: editVals.name, max_size_gb: parseFloat(editVals.max_size_gb), price_usd: parseFloat(editVals.price_usd) }
        : t
    ));
    setEditing(null);
  };

  const addTier = () => {
    const newId = Math.max(0, ...tiers.map(t => t.id)) + 1;
    setTiers(prev => [...prev, { id: newId, name: 'تیر جدید', max_size_gb: 50, price_usd: 5 }]);
    startEdit({ id: newId, name: 'تیر جدید', max_size_gb: 50, price_usd: 5 });
  };

  const removeTier = (id: number) => {
    setTiers(prev => prev.filter(t => t.id !== id));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await adminApi.updatePricing(tiers.map(({ name, max_size_gb, price_usd }) => ({ name, max_size_gb, price_usd })));
      addToast('success', 'تعرفه‌ها ذخیره شدند', `${tiers.length} تیر قیمت‌گذاری به‌روز شد`);
    } catch (e) {
      addToast('error', 'خطا در ذخیره', (e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">قیمت‌گذاری</h1>
          <p className="text-xs text-[#8888a8] mt-1">تعرفه‌ها بر اساس حجم فایل تعیین می‌شوند</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addTier}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
          >
            <Plus className="w-4 h-4" />
            افزودن تیر
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E8C547]/10 border border-[#E8C547]/20 text-[#E8C547] text-sm font-bold hover:bg-[#E8C547]/20 transition-all disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'در حال ذخیره...' : 'ذخیره همه'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#E8C547]" />
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="glass-card rounded-2xl p-5 group">
              {editing === tier.id ? (
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#44445a]">نام تیر</label>
                    <input
                      value={editVals.name}
                      onChange={e => setEditVals(v => ({ ...v, name: e.target.value }))}
                      className="w-full h-9 bg-white/5 border border-[#E8C547]/30 rounded-lg px-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#44445a]">حداکثر (GB)</label>
                    <input
                      type="number"
                      value={editVals.max_size_gb}
                      onChange={e => setEditVals(v => ({ ...v, max_size_gb: e.target.value }))}
                      className="w-full h-9 bg-white/5 border border-[#E8C547]/30 rounded-lg px-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#44445a]">قیمت (USD)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editVals.price_usd}
                      onChange={e => setEditVals(v => ({ ...v, price_usd: e.target.value }))}
                      className="w-full h-9 bg-white/5 border border-[#E8C547]/30 rounded-lg px-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="h-9 px-3 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-all">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg bg-white/5 text-[#8888a8] hover:bg-white/10 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#E8C547]/10 border border-[#E8C547]/20 flex items-center justify-center text-[#E8C547] font-black text-xs">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{tier.name}</div>
                    <div className="text-xs text-[#8888a8] mt-0.5">تا {tier.max_size_gb} گیگابایت</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-[#E8C547]">{formatPrice(tier.price_usd)}</div>
                    <div className="text-[10px] text-[#44445a]">به ازای هر فایل</div>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEdit(tier)} className="p-2 rounded-lg bg-white/5 text-[#8888a8] hover:bg-white/10 hover:text-white transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeTier(tier.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {tiers.length === 0 && (
            <div className="p-12 text-center glass-card rounded-2xl">
              <Tag className="w-8 h-8 mx-auto mb-3 text-[#44445a]" />
              <p className="text-sm text-[#8888a8]">هیچ تیر قیمتی تعریف نشده — روی «افزودن تیر» کلیک کنید</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sales & Reports Panel ────────────────────────────────────────────────────

function SalesPanel({
  addToast,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [sales,   setSales  ] = useState<Sale[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab    ] = useState<'sales' | 'daily'>('sales');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        adminApi.sales(dateFilter || undefined),
        adminApi.reports(30),
      ]);
      setSales(s.sales ?? []);
      setReports(r.reports ?? []);
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setLoading(false); }
  }, [addToast, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = useMemo(() => sales.reduce((s, x) => s + (x.price_charged || 0), 0), [sales]);
  const confirmedCount = useMemo(() => sales.filter(s => s.payment_status === 'confirmed').length, [sales]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">فروش و گزارشات</h1>
          <p className="text-xs text-[#8888a8] mt-1">تاریخچه تراکنش‌ها و آمار روزانه</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] hover:text-white hover:bg-white/10 transition-all self-start">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'تعداد فروش', value: sales.length, color: '#3ECF8E' },
          { label: 'تأیید شده', value: confirmedCount, color: '#4A9EFF' },
          { label: 'مجموع درآمد', value: formatPrice(totalRevenue), color: '#E8C547' },
        ].map(k => (
          <div key={k.label} className="glass-card rounded-2xl p-4 text-center">
            <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-[#8888a8] mt-1 font-semibold uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/5 rounded-xl w-fit">
        <button
          onClick={() => setTab('sales')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'sales' ? 'bg-[#E8C547]/15 text-[#E8C547]' : 'text-[#8888a8] hover:text-white'}`}
        >
          💰 تراکنش‌ها
        </button>
        <button
          onClick={() => setTab('daily')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'daily' ? 'bg-[#E8C547]/15 text-[#E8C547]' : 'text-[#8888a8] hover:text-white'}`}
        >
          📈 گزارش روزانه
        </button>
      </div>

      {/* Date filter - only for sales */}
      {tab === 'sales' && (
        <div className="flex gap-3">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="h-9 bg-white/5 border border-white/5 rounded-xl px-3 text-sm text-white outline-none focus:border-[#E8C547]/30 transition-all"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="h-9 px-3 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] text-xs hover:text-white transition-all">
              پاک کردن فیلتر
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#E8C547]" />
        </div>
      ) : tab === 'sales' ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['زمان', 'فیلم', 'قیمت', 'نوع پرداخت', 'وضعیت', 'مرجع'].map(h => (
                    <th key={h} className="text-right px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="p-12 text-center text-[#44445a]">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">هیچ فروشی ثبت نشده</p>
                    </div>
                  </td></tr>
                ) : sales.map(s => (
                  <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-xs font-mono text-[#8888a8]">{formatDateTime(s.timestamp)}</td>
                    <td className="px-5 py-3.5 font-medium text-white max-w-[180px]">
                      <span className="truncate block">{s.media_name ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 font-black text-[#E8C547]">{formatPrice(s.price_charged)}</td>
                    <td className="px-5 py-3.5 text-[#8888a8] text-xs">{s.payment_mode ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        s.payment_status === 'confirmed'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {s.payment_status === 'confirmed' ? '✓ تأیید' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[#44445a]">{s.payment_ref ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['تاریخ', 'کپی موفق', 'درآمد کل'].map(h => (
                    <th key={h} className="text-right px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={3}>
                    <div className="p-12 text-center text-[#44445a]">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">داده‌ای موجود نیست</p>
                    </div>
                  </td></tr>
                ) : reports.map(r => (
                  <tr key={r.date} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 font-mono text-sm text-white">{r.date}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {r.total_copies} کپی
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-black text-[#E8C547]">{formatPrice(r.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agents Management Panel ──────────────────────────────────────────────────

function AgentsManagementPanel({
  agents, drives, loading, addToast, onRefresh,
}: {
  agents: Agent[]; drives: Drive[]; loading?: boolean;
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (agentId: string, status: 'approved' | 'denied') => {
    setBusyId(agentId);
    try {
      await adminApi.approveAgents([agentId], status);
      addToast('success', status === 'approved' ? 'عامل تأیید شد' : 'عامل رد شد');
      onRefresh();
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setBusyId(null); }
  };

  const handleSetMaster = async (agentId: string | null) => {
    try {
      await adminApi.setMasterAgent(agentId);
      addToast('success', agentId ? 'عامل اصلی تعیین شد' : 'عامل اصلی لغو شد');
      onRefresh();
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">درایو و عامل‌ها</h1>
          <p className="text-xs text-[#8888a8] mt-1">
            {drives.length} درایو متصل · {agents.filter(a => a.online).length} عامل آنلاین از {agents.length}
          </p>
        </div>
        <button onClick={onRefresh} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] hover:text-white hover:bg-white/10 transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Drives Grid */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-[#44445a] mb-3">درایوهای USB</h2>
        {drives.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <HardDrive className="w-8 h-8 mx-auto mb-2 text-[#44445a]" />
            <p className="text-sm text-[#8888a8]">درایوی متصل نیست</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {drives.map(d => {
              const usedPct = d.capacity_bytes > 0
                ? Math.round(((d.capacity_bytes - d.free_bytes) / d.capacity_bytes) * 100)
                : 0;
              return (
                <div key={d.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.is_locked ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' : 'bg-green-400 shadow-[0_0_6px_#4ade80]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{d.label || d.path}</div>
                      <div className="text-[10px] text-[#44445a] font-mono truncate">{d.path}</div>
                    </div>
                    {d.is_locked && <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-[#8888a8]">
                      <span>{formatBytes(d.free_bytes)} آزاد</span>
                      <span>{usedPct}% مصرف</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${usedPct}%`,
                          background: usedPct > 85 ? '#ff4d6d' : usedPct > 60 ? '#E8C547' : '#3ECF8E',
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#44445a]">{formatBytes(d.capacity_bytes)} کل</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agents Table */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-[#44445a] mb-3">عامل‌های Windows</h2>
        {agents.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Cpu className="w-8 h-8 mx-auto mb-2 text-[#44445a]" />
            <p className="text-sm text-[#8888a8]">هیچ عاملی ثبت نشده</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['وضعیت', 'نام هاست', 'نسخه', 'آخرین اتصال', 'عملیات'].map(h => (
                      <th key={h} className="text-right px-5 py-3.5 text-[9px] font-black uppercase tracking-widest text-[#44445a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a => (
                    <tr key={a.agent_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${a.online ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-[#44445a]'}`} />
                          <span className={`text-[10px] font-bold ${a.online ? 'text-green-400' : 'text-[#44445a]'}`}>
                            {a.online ? 'آنلاین' : 'آفلاین'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{a.hostname}</div>
                        <div className="text-[10px] text-[#44445a] font-mono">{a.agent_id.slice(0, 12)}...</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-[#8888a8]">{a.version}</td>
                      <td className="px-5 py-3.5 text-xs text-[#8888a8]">
                        {a.last_seen ? new Date(a.last_seen * 1000).toLocaleString('fa-IR') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(a.agent_id, 'approved')}
                            disabled={busyId === a.agent_id}
                            className="p-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
                            title="تأیید"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleApprove(a.agent_id, 'denied')}
                            disabled={busyId === a.agent_id}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            title="رد"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSetMaster(a.agent_id)}
                            className="p-1.5 rounded-lg bg-[#E8C547]/10 text-[#E8C547] border border-[#E8C547]/20 hover:bg-[#E8C547]/20 transition-all"
                            title="تعیین به عنوان عامل اصلی"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  onClose, addToast,
}: {
  onClose: () => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
}) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow   ] = useState(false);
  const [busy,    setBusy   ] = useState(false);

  const submit = async () => {
    if (newPass !== confirm) { addToast('error', 'رمز تطابق ندارد'); return; }
    if (newPass.length < 6)  { addToast('error', 'رمز باید حداقل ۶ کاراکتر باشد'); return; }
    setBusy(true);
    try {
      await authApi.changePassword(oldPass, newPass);
      addToast('success', 'رمز عبور تغییر کرد', 'لطفاً دوباره وارد شوید');
      onClose();
    } catch (e) {
      addToast('error', 'خطا', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 p-2">
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#44445a]">رمز فعلی</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={oldPass}
            onChange={e => setOldPass(e.target.value)}
            className="w-full h-10 bg-white/5 border border-white/5 rounded-xl px-4 pr-4 pl-10 text-sm text-white outline-none focus:border-[#E8C547]/30 transition-all"
          />
          <button onClick={() => setShow(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44445a] hover:text-white">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#44445a]">رمز جدید</label>
        <input
          type={show ? 'text' : 'password'}
          value={newPass}
          onChange={e => setNewPass(e.target.value)}
          className="w-full h-10 bg-white/5 border border-white/5 rounded-xl px-4 text-sm text-white outline-none focus:border-[#E8C547]/30 transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#44445a]">تأیید رمز جدید</label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={`w-full h-10 bg-white/5 border rounded-xl px-4 text-sm text-white outline-none transition-all ${
            confirm && confirm !== newPass ? 'border-red-500/40' : 'border-white/5 focus:border-[#E8C547]/30'
          }`}
        />
      </div>
      <button
        onClick={submit}
        disabled={busy || !oldPass || !newPass || newPass !== confirm}
        className="w-full h-10 rounded-xl bg-[#E8C547]/15 border border-[#E8C547]/25 text-[#E8C547] text-sm font-bold hover:bg-[#E8C547]/25 transition-all disabled:opacity-40 mt-2"
      >
        {busy ? 'در حال تغییر...' : 'تغییر رمز عبور'}
      </button>
    </div>
  );
}

// ─── QR Quick View ────────────────────────────────────────────────────────────

// ─── QuickAction helper component — UX: adopted from v2 redesign ─────────────

function QuickAction({ label, icon: Icon, onClick }: { label: string; icon: React.ElementType; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-accent/10 hover:border-accent/30 transition-all group"
    >
      <Icon className="w-6 h-6 text-[#8888a8] group-hover:text-accent transition-colors" />
      <span className="text-[10px] font-black uppercase text-[#44445a] group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}

function QrQuickView() {
  const [data, setData] = useState<{ qr_image_base64?: string; resolved_base_url?: string; current_ip?: string } | null>(null);
  useEffect(() => { adminApi.qr().then(setData).catch(() => setData(null)); }, []);
  if (!data) return (
    <div className="p-12 flex justify-center">
      <RefreshCw className="w-8 h-8 animate-spin text-[#E8C547]" />
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-5 p-4">
      <div className="p-4 bg-white rounded-3xl shadow-2xl">
        {data.qr_image_base64 && <img src={data.qr_image_base64} alt="QR" className="w-48 h-48" />}
      </div>
      <div className="text-center space-y-2 w-full">
        <p className="text-xs font-mono bg-white/5 px-4 py-2.5 rounded-xl text-[#E8C547] border border-[#E8C547]/20 break-all">
          {data.resolved_base_url}
        </p>
        {data.current_ip && (
          <p className="text-[10px] text-[#8888a8]">IP: {data.current_ip}</p>
        )}
        <p className="text-[10px] text-[#44445a]">مشتریان در شبکه محلی با این QR متصل می‌شوند</p>
      </div>
    </div>
  );
}

// ─── License Quick View ───────────────────────────────────────────────────────

function LicenseQuickView() {
  const [lic, setLic] = useState<{ valid?: boolean; status?: string; tier?: string; expires_at?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => adminApi.license().then(setLic).catch(() => setLic(null));
  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    const key = prompt('لایسنس جدید را وارد کنید (JSON):');
    if (!key) return;
    setUploading(true);
    try {
      await adminApi.uploadLicense(key);
      alert('لایسنس با موفقیت ثبت شد');
      load();
    } catch (e) { alert('خطا: ' + (e as Error).message); }
    finally { setUploading(false); }
  };

  if (!lic) return <div className="p-12 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-[#E8C547]" /></div>;
  return (
    <div className="space-y-4 p-4">
      <div className={`p-6 rounded-2xl border flex flex-col items-center text-center ${lic.valid ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${lic.valid ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          <Shield className="w-7 h-7" />
        </div>
        <h4 className={`text-base font-black uppercase tracking-widest ${lic.valid ? 'text-green-400' : 'text-red-400'}`}>{lic.status || 'UNLICENSED'}</h4>
        <p className="text-[10px] text-[#8888a8] mt-1">{lic.tier ?? 'Standard'}</p>
        {lic.expires_at && <p className="text-[10px] text-[#44445a] mt-1">اعتبار تا: {lic.expires_at.split('T')[0]}</p>}
      </div>
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] text-sm font-bold hover:bg-white/10 hover:text-white transition-all"
      >
        {uploading ? 'در حال بارگذاری...' : '↑ ارتقاء لایسنس'}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboardModern({
  addToast,
  onBack,
  onLogout,
}: {
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  onBack?: () => void;
  onLogout?: () => void;
}) {
  const [activeTab,    setActiveTab   ] = useState('overview');
  const [sidebarOpen,  setSidebarOpen ] = useState(false);
  const [searchQuery,  setSearchQuery ] = useState('');
  const [searchFocus,  setSearchFocus ] = useState(false);

  const [stats,       setStats      ] = useState<DashboardStats | null>(null);
  const [reports,     setReports    ] = useState<DailyReport[]>([]);
  const [jobs,        setJobs       ] = useState<Job[]>([]);
  const [drives,      setDrives     ] = useState<Drive[]>([]);
  const [agents,      setAgents     ] = useState<Agent[]>([]);
  const [loading,     setLoading    ] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [wsConnected, setWsConnected] = useState(false);

  const [qrModal,       setQrModal      ] = useState(false);
  const [licenseModal,  setLicenseModal ] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, rep, queue, drivesRes, agentsRes] = await Promise.all([
        adminApi.dashboard(),
        adminApi.reports(30),
        adminApi.queue(),
        driveApi.list(),
        adminApi.agents().catch(() => ({ agents: [], online_count: 0 })),
      ]);
      setStats(dash);
      setReports(rep.reports ?? []);
      setJobs(queue.jobs ?? []);
      setDrives(drivesRes.drives ?? []);
      setAgents(agentsRes.agents ?? []);
      setLastRefresh(Date.now());
    } catch (e) {
      addToast('error', 'خطا در بارگذاری', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
    wsClient.connect();
    const unsub = wsClient.on('*', (ev) => {
      setWsConnected(wsClient.isConnected);
      if (['job.created', 'job.started', 'job.completed', 'job.failed'].includes(ev.event)) load();
    });
    return () => { unsub(); };
  }, [load]);

  const activeJobsCount = stats?.active_workers ?? 0;
  const queueDepth      = stats?.queue_depth ?? 0;
  const successRate     = stats && (stats.copies_today + stats.failures_today) > 0
    ? Math.round((stats.copies_today / (stats.copies_today + stats.failures_today)) * 100)
    : 100;

  return (
    <div className="flex h-screen w-full bg-[#07070d] text-[#eeeef5] overflow-hidden font-vazir relative" dir="rtl">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={activeTab}
        onNavigate={(id) => { setActiveTab(id); setSearchQuery(''); }}
        onBack={onBack}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-[#07070d]/50 backdrop-blur-xl sticky top-0 z-40">  {/* UX: h-20, px-8 adopted from v2 redesign */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white"  /* UX: larger tap target */
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Functional Search */}
            <div className={`relative transition-all duration-300 ${searchFocus ? 'w-72' : 'w-52'} hidden sm:block`}>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#44445a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                placeholder="جستجو در سیستم..."
                className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl pr-9 pl-4 text-sm text-white focus:border-accent/30 focus:bg-white/[0.08] transition-all outline-none"  /* UX: h-12 rounded-2xl adopted from v2 redesign */
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold">
              <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-red-400'}`} />
              <span className="text-[#8888a8] uppercase tracking-widest hidden sm:inline">
                {wsConnected ? 'Live' : 'Offline'}
              </span>
              <span className="text-[#44445a] hidden sm:inline">|</span>
              <span className="text-[#eeeef5] hidden sm:inline">
                {new Date(lastRefresh).toLocaleTimeString('fa-IR')}
              </span>
              <button onClick={load} className="hover:text-[#E8C547] transition-colors mr-1">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Password change */}
            <button
              onClick={() => setPasswordModal(true)}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
              title="تغییر رمز عبور"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Notifications — UX: animated glow on hover, adopted from v2 redesign */}
            <div className="relative group">
              <div className="absolute inset-0 bg-accent/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <button className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/5 text-[#8888a8] hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">
                <Bell className="w-5 h-5" />
              </button>
              {stats && stats.failures_today > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black text-white flex items-center justify-center border-2 border-[#07070d]">
                  {stats.failures_today}
                </span>
              ) : (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#07070d]" />
              )}
            </div>

            {/* Logout */}
            {/* UX: w-12 h-12 rounded-2xl adopted from v2 redesign */}
            <button
              onClick={onLogout}
              className="w-12 h-12 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400/80 hover:text-red-400 flex items-center justify-center transition-all border border-red-500/10"
              title="خروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-7xl mx-auto">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header>  {/* UX: semantic header + text-2xl tracking-tight adopted from v2 redesign */}
                  <h1 className="text-2xl font-black text-white tracking-tight">خلاصه وضعیت سیستم</h1>
                  <p className="text-sm text-[#8888a8] mt-1">مانیتورینگ همزمان منابع، درآمد و صف پردازش</p>
                </header>

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard label="کارهای فعال"    value={activeJobsCount}                              icon={Activity}    color="#3ECF8E" loading={loading} />
                  <MetricCard label="در صف انتظار"   value={Math.max(0, queueDepth - activeJobsCount)}   icon={Clock}       color="#E8C547" loading={loading} />
                  <MetricCard label="درآمد امروز"    value={formatPrice(stats?.revenue_today ?? 0)}       icon={DollarSign}  color="#3ECF8E" loading={loading} />
                  <MetricCard label="عامل‌های متصل"  value={stats?.agents_online ?? 0}                   icon={Cpu}         color="#A78BFA" loading={loading} />
                </div>

                {/* Secondary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard label="کپی‌های امروز"  value={stats?.copies_today ?? 0}    icon={Database}    color="#4A9EFF" loading={loading} />
                  <MetricCard label="خطاهای امروز"   value={stats?.failures_today ?? 0}  icon={AlertTriangle} color="#FF4D6D" loading={loading} />
                  <MetricCard label="نرخ موفقیت"     value={`${successRate}%`}            icon={TrendingUp}  color="#3ECF8E" loading={loading} />
                  <MetricCard label="تعداد رسانه"    value={stats?.media_count ?? 0}      icon={Film}        color="#E8C547" loading={loading} />
                </div>

                {/* Chart + Quick Actions */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <ConsumptionChart reports={reports} loading={loading} />
                  </div>
                  <div className="xl:col-span-1 space-y-4">
                    {/* Quick Actions — UX: using QuickAction component adopted from v2 redesign */}
                    <div className="glass-card p-5 rounded-2xl">
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#44445a] mb-4 flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-accent" />
                        دسترسی سریع
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <QuickAction label="کد QR"     icon={QrCode}   onClick={() => setQrModal(true)}      />
                        <QuickAction label="لایسنس"    icon={Shield}   onClick={() => setLicenseModal(true)} />
                        <QuickAction label="صف کارها"  icon={BarChart3} onClick={() => setActiveTab('queue')} />
                        <QuickAction label="رسانه‌ها"   icon={Film}     onClick={() => setActiveTab('media')} />
                      </div>
                    </div>

                    {/* System Health */}
                    <div className="glass-card p-5 rounded-2xl">
                      <h3 className="text-xs font-black uppercase tracking-widest text-[#44445a] mb-4">سلامت سیستم</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'WebSocket', value: `${stats?.ws_connections ?? 0} اتصال`, ok: true,                icon: Globe },
                          { label: 'صف پردازش', value: `${queueDepth} کار`,                  ok: queueDepth < 50,    icon: Zap   },
                          { label: 'Workers',   value: `${activeJobsCount} فعال`,              ok: true,               icon: Server },
                          { label: 'عامل‌ها',   value: `${stats?.agents_online ?? 0} آنلاین`, ok: true,               icon: Cpu   },
                        ].map(({ label, value, ok, icon: Icon }) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-[#8888a8]">
                              <Icon className="w-3.5 h-3.5" />
                              <span className="text-xs">{label}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ok ? 'bg-green-500/10 text-green-400 border border-green-500/15' : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'}`}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Queue Tab */}
            {activeTab === 'queue' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <JobQueuePanel
                  jobs={jobs}
                  loading={loading}
                  onRefresh={load}
                  addToast={addToast}
                  cancelAvailable
                  priorityAvailable
                />
              </div>
            )}

            {/* Drives & Agents Tab — FIX: DriveAgentPanel now wired here as detail panel */}
            {activeTab === 'drives' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                {/* Quick visual overview using DriveAgentPanel (was unused) */}
                <DriveAgentPanel drives={drives} agents={agents} loading={loading} />
                {/* Full management table with approve/deny/master controls */}
                <AgentsManagementPanel
                  agents={agents}
                  drives={drives}
                  loading={loading}
                  addToast={addToast}
                  onRefresh={load}
                />
              </div>
            )}

            {/* Media Library Tab */}
            {activeTab === 'media' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <MediaLibraryPanel addToast={addToast} />
              </div>
            )}

            {/* Pricing Tab */}
            {activeTab === 'pricing' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <PricingPanel addToast={addToast} />
              </div>
            )}

            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <SalesPanel addToast={addToast} />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="lg:col-span-2">
                  <SettingsConfigPanel addToast={addToast} />
                </div>
                <div className="space-y-4">
                  <LoadBalancerControl addToast={addToast} settingsAvailable />
                  <div className="glass-card rounded-2xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#44445a] mb-4">امنیت حساب</h3>
                    <button
                      onClick={() => setPasswordModal(true)}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#E8C547]/10 border border-[#E8C547]/20 text-[#E8C547] text-sm font-bold hover:bg-[#E8C547]/20 transition-all"
                    >
                      <Key className="w-4 h-4" />
                      تغییر رمز عبور
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modals */}
      <ModalDrawer open={qrModal}       onClose={() => setQrModal(false)}       title="QR اتصال موبایل"       variant="modal">
        <QrQuickView />
      </ModalDrawer>
      <ModalDrawer open={licenseModal}  onClose={() => setLicenseModal(false)}  title="وضعیت لایسنس تجاری"   variant="modal">
        <LicenseQuickView />
      </ModalDrawer>
      <ModalDrawer open={passwordModal} onClose={() => setPasswordModal(false)} title="تغییر رمز عبور مدیر"   variant="modal">
        <ChangePasswordModal onClose={() => setPasswordModal(false)} addToast={addToast} />
      </ModalDrawer>
    </div>
  );
}
