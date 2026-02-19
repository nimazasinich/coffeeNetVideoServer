/**
 * Job Queue Panel — Top 10 active/pending jobs, progress bars, Cancel / Prioritize.
 * Uses existing adminApi.cancelJob and adminApi.setJobPriority; disables with tooltip if API missing.
 */
import { useState, useCallback } from 'react';
import { ListOrdered, XCircle, ArrowUp, Banknote, CheckCircle } from 'lucide-react';
import { adminApi } from '../lib/api';
import { getStatusLabel } from '../lib/utils';
import { ModalDrawer } from './ModalDrawer';
import type { Job } from '../lib/types';

const CANCEL_API = 'POST /api/admin/jobs/{id}/cancel';
const PRIORITY_API = 'POST /api/admin/jobs/{id}/priority';

export function JobQueuePanel({
  jobs,
  loading,
  onRefresh,
  addToast,
  cancelAvailable = true,
  priorityAvailable = true,
}: {
  jobs: Job[];
  loading?: boolean;
  onRefresh: () => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  cancelAvailable?: boolean;
  priorityAvailable?: boolean;
}) {
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [confirmCancelJob, setConfirmCancelJob] = useState<Job | null>(null);
  const [confirmPaymentJob, setConfirmPaymentJob] = useState<Job | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const activePending = jobs
    .filter((j) => j.status === 'active' || j.status === 'pending' || j.status === 'queued')
    .slice(0, 10);

  const handleCancel = useCallback(
    async (job: Job) => {
      if (!cancelAvailable) return;
      setConfirmCancelJob(job);
    },
    [cancelAvailable]
  );

  const commitCancel = useCallback(
    async (job: Job) => {
      setActionBusy(job.id);
      setConfirmCancelJob(null);
      try {
        await adminApi.denyJob(job.id);
        addToast('success', 'درخواست رد شد', `کار ${job.media_name ?? job.id} رد شد`);
        onRefresh();
        setDetailJob(null);
      } catch (e) {
        addToast('error', 'خطا', (e as Error).message);
      } finally {
        setActionBusy(null);
      }
    },
    [onRefresh, addToast]
  );

  const commitConfirmPayment = useCallback(
    async (job: Job) => {
      setActionBusy(job.id);
      setConfirmPaymentJob(null);
      setPaymentRef('');
      try {
        await adminApi.confirmPayment(job.id, paymentRef.trim() || undefined);
        addToast('success', 'پرداخت تأیید شد', 'کپی به صف اجرا اضافه شد');
        onRefresh();
        setDetailJob(null);
      } catch (e) {
        addToast('error', 'خطا', (e as Error).message);
      } finally {
        setActionBusy(null);
      }
    },
    [onRefresh, addToast, paymentRef]
  );

  const handlePriority = useCallback(
    async (job: Job, delta: number) => {
      if (!priorityAvailable) return;
      const current = (job as { priority?: number }).priority ?? 0;
      const next = Math.max(0, current + delta);
      setActionBusy(job.id);
      try {
        await adminApi.setJobPriority(job.id, next);
        addToast('success', 'اولویت به‌روز شد', `اولویت: ${next}`);
        onRefresh();
      } catch (e) {
        addToast('error', 'خطا', (e as Error).message);
      } finally {
        setActionBusy(null);
      }
    },
    [priorityAvailable, onRefresh, addToast]
  );

  const progressBytes = (j: Job) => (j as { bytes_written?: number }).bytes_written ?? j.progress_bytes ?? 0;
  const totalBytes = (j: Job) => j.total_bytes ?? 1;

  if (loading) {
    return (
      <div className="card p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <ListOrdered className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            صف کارها
          </h3>
        </div>
        <div className="skeleton h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className="card p-4 rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <ListOrdered className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          صف کارها
          <span className="chip chip-active text-xs">{activePending.length}</span>
        </h3>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activePending.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text3)' }}>
            کاری در صف نیست
          </p>
        ) : (
          activePending.map((job) => {
            const total = totalBytes(job);
            const written = progressBytes(job);
            const pct = total > 0 ? Math.round((written / total) * 100) : 0;
            return (
              <div
                key={job.id}
                className="p-2 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => setDetailJob(job)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setDetailJob(job)}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text)' }}>
                    {job.media_name ?? job.id.slice(0, 8)}
                  </span>
                  <span className={`chip text-xs ${job.status === 'active' ? 'chip-active' : 'chip-pending'}`}>
                    {getStatusLabel(job.status)}
                  </span>
                  {job.delivery_type && (
                    <span className="chip text-xs" style={{ background: 'rgba(74,158,255,.12)', color: 'var(--blue)' }}>
                      {job.delivery_type === 'usb' ? 'USB' : 'موبایل'}
                    </span>
                  )}
                  {job.payment_mode && (
                    <span className="chip text-xs" style={{ background: 'rgba(62,207,142,.12)', color: 'var(--green)' }}>
                      {job.payment_mode === 'manual' ? 'دستی' : 'آنلاین'}
                    </span>
                  )}
                </div>
                <div className="progress-track mt-1.5">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {job.status === 'pending' && job.payment_mode === 'manual' && (
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-green-500/20 text-green-400 disabled:opacity-50 flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmPaymentJob(job);
                      }}
                      disabled={actionBusy === job.id}
                      title="تأیید پرداخت"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span className="text-xs">تأیید پرداخت</span>
                    </button>
                  )}
                  {cancelAvailable ? (
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmCancelJob(job);
                      }}
                      disabled={actionBusy === job.id}
                      title="رد درخواست"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      className="p-1.5 rounded opacity-50 cursor-not-allowed"
                      title={`Backend API not available. To enable: ${CANCEL_API}`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {priorityAvailable ? (
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-white/10 disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePriority(job, 1);
                      }}
                      disabled={actionBusy === job.id}
                      title="افزایش اولویت"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      className="p-1.5 rounded opacity-50 cursor-not-allowed"
                      title={`Backend API not available. To enable: ${PRIORITY_API}`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirm cancel / Deny */}
      <ModalDrawer
        open={!!confirmCancelJob}
        onClose={() => setConfirmCancelJob(null)}
        title="رد درخواست؟"
        variant="modal"
      >
        {confirmCancelJob && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              آیا از رد درخواست «{confirmCancelJob.media_name ?? confirmCancelJob.id}» اطمینان دارید؟
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setConfirmCancelJob(null)}>
                انصراف
              </button>
              <button
                type="button"
                className="btn-primary bg-red-500/90 hover:bg-red-500"
                onClick={() => commitCancel(confirmCancelJob)}
                disabled={actionBusy === confirmCancelJob.id}
              >
                رد درخواست
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>

      {/* Confirm payment (manual) */}
      <ModalDrawer
        open={!!confirmPaymentJob}
        onClose={() => { setConfirmPaymentJob(null); setPaymentRef(''); }}
        title="تأیید پرداخت"
        variant="modal"
      >
        {confirmPaymentJob && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              مشتری پرداخت را در میز انجام داده است. مرجع پرداخت (اختیاری):
            </p>
            <input
              type="text"
              className="input-field"
              placeholder="مثلاً شماره فیش یا رسید"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => { setConfirmPaymentJob(null); setPaymentRef(''); }}>
                انصراف
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                onClick={() => commitConfirmPayment(confirmPaymentJob)}
                disabled={actionBusy === confirmPaymentJob.id}
              >
                <CheckCircle className="w-4 h-4" />
                تأیید پرداخت
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ModalDrawer
        open={!!detailJob}
        onClose={() => setDetailJob(null)}
        title={detailJob ? (detailJob.media_name ?? 'جزئیات کار') : ''}
        variant="drawer-right"
      >
        {detailJob && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>وضعیت</span>
              <span className={`chip ${detailJob.status === 'active' ? 'chip-active' : 'chip-pending'}`}>
                {getStatusLabel(detailJob.status)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>پیشرفت</span>
              <span>{Math.round(detailJob.progress ?? 0)}٪</span>
            </div>
            {detailJob.error_message && (
              <p className="text-xs p-2 rounded bg-red-500/10 text-red-400">{detailJob.error_message}</p>
            )}
            {(detailJob.delivery_type != null || detailJob.payment_mode != null) && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--text3)' }}>
                {detailJob.delivery_type && <span>تحویل: {detailJob.delivery_type === 'usb' ? 'USB' : 'موبایل'}</span>}
                {detailJob.payment_mode && <span>پرداخت: {detailJob.payment_mode === 'manual' ? 'دستی' : 'آنلاین'}</span>}
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t flex-wrap" style={{ borderColor: 'var(--border)' }}>
              {detailJob.status === 'pending' && detailJob.payment_mode === 'manual' && (
                <button
                  type="button"
                  className="btn-primary text-sm flex items-center gap-1.5"
                  onClick={() => setConfirmPaymentJob(detailJob)}
                  disabled={actionBusy === detailJob.id}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  تأیید پرداخت
                </button>
              )}
              {cancelAvailable && (
                <button
                  type="button"
                  className="btn-ghost text-red-400 border-red-500/30"
                  onClick={() => setConfirmCancelJob(detailJob)}
                  disabled={actionBusy === detailJob.id}
                >
                  رد درخواست
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={() => setDetailJob(null)}>
                بستن
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
