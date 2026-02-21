import { useState, useCallback } from 'react';
import { ListOrdered, XCircle, ArrowUp, Banknote, CheckCircle, RefreshCw } from 'lucide-react';
import { adminApi } from '../lib/api';
import { getStatusLabel, getStatusChipClass, formatBytes } from '../lib/utils';
import { ModalDrawer } from './ModalDrawer';
import type { Job } from '../lib/types';

interface Props {
  jobs:              Job[];
  loading?:          boolean;
  onRefresh:         () => void;
  addToast:          (type: 'success' | 'error' | 'info', title: string, msg?: string) => void;
  cancelAvailable?:  boolean;
  priorityAvailable?: boolean;
}

export function JobQueuePanel({ jobs, loading, onRefresh, addToast, cancelAvailable = true, priorityAvailable = true }: Props) {
  const [detailJob,        setDetailJob]        = useState<Job | null>(null);
  const [confirmCancelJob, setConfirmCancelJob] = useState<Job | null>(null);
  const [confirmPayJob,    setConfirmPayJob]    = useState<Job | null>(null);
  const [paymentRef,       setPaymentRef]       = useState('');
  const [actionBusy,       setActionBusy]       = useState<string | null>(null);

  const activePending = jobs
    .filter(j => j.status === 'active' || j.status === 'pending' || j.status === 'queued')
    .slice(0, 10);

  const commitCancel = useCallback(async (job: Job) => {
    setActionBusy(job.id);
    setConfirmCancelJob(null);
    try {
      await adminApi.denyJob(job.id);
      addToast('success', 'Denied', `${job.media_name ?? job.id}`);
      onRefresh();
      setDetailJob(null);
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
    } finally { setActionBusy(null); }
  }, [onRefresh, addToast]);

  const commitConfirmPayment = useCallback(async (job: Job) => {
    setActionBusy(job.id);
    setConfirmPayJob(null);
    setPaymentRef('');
    try {
      await adminApi.confirmPayment(job.id, paymentRef.trim() || undefined);
      addToast('success', 'Payment Confirmed', 'Job added to copy queue');
      onRefresh();
      setDetailJob(null);
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
    } finally { setActionBusy(null); }
  }, [onRefresh, addToast, paymentRef]);

  const handlePriority = useCallback(async (job: Job, delta: number) => {
    if (!priorityAvailable) return;
    const next = Math.max(0, ((job as { priority?: number }).priority ?? 0) + delta);
    setActionBusy(job.id);
    try {
      await adminApi.setJobPriority(job.id, next);
      addToast('success', 'Priority Updated', `Priority: ${next}`);
      onRefresh();
    } catch (e) {
      addToast('error', 'Error', (e as Error).message);
    } finally { setActionBusy(null); }
  }, [priorityAvailable, onRefresh, addToast]);

  return (
    <div className="card" style={{ padding: '16px', height: '100%' }}>
      <div className="card-title">
        <ListOrdered size={13} style={{ color: 'var(--blue)' }} />
        Job Queue
        <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono', fontSize: 10, color: 'var(--text3)' }}>
          {activePending.length} jobs
        </span>
        <button
          className="btn-icon"
          style={{ width: 26, height: 26 }}
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={11} className={loading ? 'anim-spin' : ''} />
        </button>
      </div>

      {loading && !activePending.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--r-sm)' }} />)}
        </div>
      ) : !activePending.length ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
          No active jobs
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {activePending.map(job => {
            const pct = job.progress_pct ?? job.progress ?? 0;
            return (
              <div
                key={job.id}
                style={{
                  padding: '9px 11px',
                  borderRadius: 'var(--r-sm)',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'var(--t)',
                }}
                onClick={() => setDetailJob(job)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span className={getStatusChipClass(job.status)} style={{ fontSize: 9 }}>
                    {getStatusLabel(job.status)}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.media_name ?? job.id}
                  </span>
                  {job.speed_mbps && job.speed_mbps > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'DM Mono', color: 'var(--cyan)' }}>
                      {job.speed_mbps} MB/s
                    </span>
                  )}
                </div>
                <div className="progress-track" style={{ marginBottom: 5 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {job.status === 'pending' && job.payment_mode === 'manual' && (
                    <button
                      className="btn-icon"
                      style={{ width: 24, height: 24, color: 'var(--green)' }}
                      onClick={e => { e.stopPropagation(); setConfirmPayJob(job); }}
                      disabled={actionBusy === job.id}
                      title="Confirm Payment"
                    >
                      <Banknote size={12} />
                    </button>
                  )}
                  <button
                    className="btn-icon"
                    style={{ width: 24, height: 24, color: 'var(--red)', marginLeft: 'auto' }}
                    onClick={e => { e.stopPropagation(); setConfirmCancelJob(job); }}
                    disabled={actionBusy === job.id || !cancelAvailable}
                    title="Deny Request"
                  >
                    <XCircle size={12} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: 24, height: 24 }}
                    onClick={e => { e.stopPropagation(); handlePriority(job, 1); }}
                    disabled={actionBusy === job.id || !priorityAvailable}
                    title="Increase Priority"
                  >
                    <ArrowUp size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm deny */}
      <ModalDrawer open={!!confirmCancelJob} onClose={() => setConfirmCancelJob(null)} title="Deny Request?" variant="modal">
        {confirmCancelJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              Are you sure you want to deny «{confirmCancelJob.media_name ?? confirmCancelJob.id}»?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmCancelJob(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: 'var(--red)', boxShadow: '0 4px 16px rgba(255,85,119,0.3)' }}
                onClick={() => commitCancel(confirmCancelJob)}
              >
                Deny Request
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>

      {/* Confirm payment */}
      <ModalDrawer open={!!confirmPayJob} onClose={() => { setConfirmPayJob(null); setPaymentRef(''); }} title="Confirm Payment" variant="modal">
        {confirmPayJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Payment reference (optional):</p>
            <input className="input-field" placeholder="Receipt or reference number" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setConfirmPayJob(null); setPaymentRef(''); }}>Cancel</button>
              <button className="btn-primary" onClick={() => commitConfirmPayment(confirmPayJob)}>
                <CheckCircle size={14} /> Confirm Payment
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>

      {/* Detail drawer */}
      <ModalDrawer open={!!detailJob} onClose={() => setDetailJob(null)} title={detailJob?.media_name ?? 'Job Details'} variant="drawer-right">
        {detailJob && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text3)' }}>Status</span>
              <span className={getStatusChipClass(detailJob.status)}>{getStatusLabel(detailJob.status)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text3)' }}>Progress</span>
              <span>{Math.round(detailJob.progress_pct ?? 0)}%</span>
            </div>
            {detailJob.media_size_gb && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text3)' }}>Size</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: 11 }}>{detailJob.media_size_gb} GB</span>
              </div>
            )}
            {detailJob.delivery_type && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text3)' }}>Delivery</span>
                <span>{detailJob.delivery_type === 'usb' ? 'USB' : 'Mobile'}</span>
              </div>
            )}
            {detailJob.error_message && (
              <p style={{ fontSize: 11, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--red-dim)', color: 'var(--red)' }}>
                {detailJob.error_message}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {detailJob.status === 'pending' && detailJob.payment_mode === 'manual' && (
                <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => setConfirmPayJob(detailJob)}>
                  <Banknote size={13} /> Confirm Payment
                </button>
              )}
              {cancelAvailable && (
                <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'rgba(255,85,119,0.3)', fontSize: 12 }} onClick={() => setConfirmCancelJob(detailJob)}>
                  Deny Request
                </button>
              )}
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setDetailJob(null)}>Close</button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
