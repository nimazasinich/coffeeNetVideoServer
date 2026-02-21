import { useState } from 'react';
import { RefreshCw, HardDrive, Cpu, Lock, CheckCircle, XCircle, Star, ShieldCheck, Monitor } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatBytes } from '../../lib/utils';
import type { Agent, Drive } from '../../lib/types';

export function AdminAgentsManagementPanel({
  agents,
  drives,
  loading,
  addToast,
  onRefresh,
}: {
  agents: Agent[];
  drives: Drive[];
  loading?: boolean;
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (agentId: string, status: 'approved' | 'denied') => {
    setBusyId(agentId);
    try {
      await adminApi.approveAgents([agentId], status);
      addToast('success', status === 'approved' ? 'عامل با موفقیت تأیید شد' : 'دسترسی عامل لغو شد');
      onRefresh();
    } catch (e) {
      addToast('error', 'خطا در تغییر وضعیت عامل', (e as Error).message);
    } finally { setBusyId(null); }
  };

  const handleSetMaster = async (agentId: string | null) => {
    try {
      await adminApi.setMasterAgent(agentId);
      addToast('success', agentId ? 'عامل انتخاب شده به عنوان گره اصلی تعیین شد' : 'وضعیت گره اصلی لغو شد');
      onRefresh();
    } catch (e) {
      addToast('error', 'خطا در تعیین گره اصلی', (e as Error).message);
    }
  };

  return (
    <div className="space-y-10 adm-animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--adm-primary)]/10 text-[var(--adm-primary)] flex items-center justify-center shadow-sm">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--adm-text-main)]">مدیریت زیرساخت و ترمینال‌ها</h2>
            <p className="text-xs font-medium text-[var(--adm-text-muted)] mt-1">
              پیکربندی گره‌های پردازشی، تایید هویت و مانیتورینگ درایوهای ذخیره‌سازی
            </p>
          </div>
        </div>
        <button 
          onClick={onRefresh} 
          className="adm-btn adm-btn-secondary h-11 px-4"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی وضعیت</span>
        </button>
      </div>

      {/* Agents Table */}
      <div className="adm-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--adm-border)] bg-[var(--adm-surface-subtle)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--adm-text-main)] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--adm-primary)]" />
            ترمینال‌های شناسایی شده در شبکه
          </h3>
          <span className="adm-badge adm-badge-info">{agents.length} گره</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>وضعیت</th>
                <th>نام و شناسه دستگاه</th>
                <th>نسخه هسته</th>
                <th>آخرین فعالیت</th>
                <th>عملیات مدیریتی</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-40">
                    <Cpu className="w-12 h-12 mx-auto mb-4 text-[var(--adm-text-muted)]" />
                    <p className="text-sm font-bold text-[var(--adm-text-muted)]">هیچ عاملی در شبکه یافت نشد</p>
                  </td>
                </tr>
              ) : (
                agents.map(a => (
                  <tr key={a.agent_id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${a.online ? 'bg-[var(--adm-success)] animate-pulse' : 'bg-[var(--adm-text-muted)]'}`} />
                        <span className={`text-[10px] font-bold ${a.online ? 'text-[var(--adm-success)]' : 'text-[var(--adm-text-muted)]'}`}>
                          {a.online ? 'آنلاین' : 'آفلاین'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-[var(--adm-text-main)]">{a.hostname}</span>
                        <span className="text-[10px] text-[var(--adm-text-muted)] font-mono">{a.agent_id.slice(0, 16)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="adm-badge !bg-slate-100 !text-slate-600 font-mono text-[10px]">v{a.version}</span>
                    </td>
                    <td>
                      <span className="text-xs font-bold text-[var(--adm-text-secondary)] tabular-nums">
                        {a.last_seen ? new Date(a.last_seen * 1000).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(a.agent_id, 'approved')}
                          disabled={busyId === a.agent_id}
                          className="p-2 rounded-lg bg-green-50 text-[var(--adm-success)] border border-green-100 hover:bg-[var(--adm-success)] hover:text-white transition-all disabled:opacity-50"
                          title="تأیید دسترسی"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleApprove(a.agent_id, 'denied')}
                          disabled={busyId === a.agent_id}
                          className="p-2 rounded-lg bg-red-50 text-[var(--adm-danger)] border border-red-100 hover:bg-[var(--adm-danger)] hover:text-white transition-all disabled:opacity-50"
                          title="مسدود سازی"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSetMaster(a.agent_id)}
                          className="p-2 rounded-lg bg-amber-50 text-[var(--adm-warning)] border border-amber-100 hover:bg-[var(--adm-warning)] hover:text-white transition-all"
                          title="انتخاب به عنوان گره اصلی (Master)"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drives Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--adm-text-main)] flex items-center gap-2 px-1">
            <HardDrive className="w-4 h-4 text-[var(--adm-secondary)]" />
            وضعیت درایوهای ذخیره‌سازی (USB / Local)
          </h3>
        </div>
        
        {drives.length === 0 ? (
          <div className="adm-card p-12 text-center opacity-40">
            <HardDrive className="w-12 h-12 mx-auto mb-4 text-[var(--adm-text-muted)]" />
            <p className="text-sm font-bold text-[var(--adm-text-muted)]">درایو فعالی شناسایی نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {drives.map(d => {
              const usedPct = d.capacity_bytes > 0
                ? Math.round(((d.capacity_bytes - d.free_bytes) / d.capacity_bytes) * 100)
                : 0;
              const barColor = usedPct > 90 ? 'var(--adm-danger)' : usedPct > 75 ? 'var(--adm-warning)' : 'var(--adm-success)';
              
              return (
                <div key={d.id} className="adm-card p-5 hover:shadow-lg hover:-translate-y-1 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.is_locked ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[var(--adm-text-main)] text-sm truncate">{d.label || d.path}</div>
                      <div className="text-[10px] text-[var(--adm-text-muted)] font-mono truncate">{d.path}</div>
                    </div>
                    {d.is_locked && (
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center" title="Locked">
                        <Lock className="w-3 h-3 text-amber-600" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-[var(--adm-text-muted)]">
                      <span>{formatBytes(d.free_bytes)} Free</span>
                      <span style={{ color: barColor }}>{usedPct}% Full</span>
                    </div>
                    <div className="progress-track h-2">
                      <div
                        className="progress-fill transition-all duration-1000"
                        style={{ width: `${usedPct}%`, background: barColor }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-[var(--adm-text-secondary)] text-left" dir="ltr">
                      {formatBytes(d.capacity_bytes)} Total
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
