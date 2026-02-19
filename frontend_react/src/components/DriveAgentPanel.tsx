/**
 * Drive & Agent Panel — Cards per drive (free/used, status) and per agent (online/offline, last seen).
 * Color-coded indicator; expand drawer for details.
 */
import { useState } from 'react';
import { HardDrive, Cpu, ChevronDown, ChevronLeft } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import { ModalDrawer } from './ModalDrawer';
import type { Drive } from '../lib/types';
import type { Agent } from '../lib/types';

export function DriveAgentPanel({
  drives,
  agents,
  loading,
}: {
  drives: Drive[];
  agents: Agent[];
  loading?: boolean;
}) {
  const [driveDetail, setDriveDetail] = useState<Drive | null>(null);
  const [agentDetail, setAgentDetail] = useState<Agent | null>(null);

  if (loading) {
    return (
      <div className="card p-4 rounded-xl">
        <div className="skeleton h-6 w-32 mb-3" />
        <div className="skeleton h-20 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Drives */}
      <div
        className="card p-4 rounded-xl"
        style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)' }}
      >
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: 'var(--text)' }}>
          <HardDrive className="w-4 h-4" style={{ color: 'var(--blue)' }} />
          درایوها
          <span className="chip chip-completed text-xs">{drives.length}</span>
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {drives.length === 0 ? (
            <p className="text-sm py-2" style={{ color: 'var(--text3)' }}>درایوی متصل نیست</p>
          ) : (
            drives.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => setDriveDetail(d)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setDriveDetail(d)}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.is_locked ? 'bg-amber-500' : 'bg-green-500'}`}
                  title={d.is_locked ? 'قفل' : 'آزاد'}
                />
                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>
                  {d.label || d.path}
                </span>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  {formatBytes(d.free_bytes ?? 0)} آزاد
                </span>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text3)' }} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agents */}
      <div
        className="card p-4 rounded-xl"
        style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)' }}
      >
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3" style={{ color: 'var(--text)' }}>
          <Cpu className="w-4 h-4" style={{ color: 'var(--purple)' }} />
          عامل‌ها
          <span className="chip chip-active text-xs">{agents.filter((a) => a.online).length} / {agents.length}</span>
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {agents.length === 0 ? (
            <p className="text-sm py-2" style={{ color: 'var(--text3)' }}>عاملی ثبت نشده</p>
          ) : (
            agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => setAgentDetail(a)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setAgentDetail(a)}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.online ? 'bg-green-500' : 'bg-red-500/80'}`}
                  title={a.online ? 'آنلاین' : 'آفلاین'}
                />
                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>
                  {a.hostname}
                </span>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  v{a.version}
                </span>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text3)' }} />
              </div>
            ))
          )}
        </div>
      </div>

      <ModalDrawer
        open={!!driveDetail}
        onClose={() => setDriveDetail(null)}
        title={driveDetail ? (driveDetail.label || driveDetail.path) : ''}
        variant="drawer-right"
      >
        {driveDetail && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>مسیر</span>
              <span className="font-mono text-xs break-all">{driveDetail.path}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>ظرفیت</span>
              <span>{formatBytes(driveDetail.capacity_bytes ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>آزاد</span>
              <span>{formatBytes(driveDetail.free_bytes ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>وضعیت</span>
              <span className={driveDetail.is_locked ? 'text-amber-500' : 'text-green-500'}>
                {driveDetail.is_locked ? 'قفل' : 'آزاد'}
              </span>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ModalDrawer
        open={!!agentDetail}
        onClose={() => setAgentDetail(null)}
        title={agentDetail ? agentDetail.hostname : ''}
        variant="drawer-right"
      >
        {agentDetail && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>وضعیت</span>
              <span className={agentDetail.online ? 'text-green-500' : 'text-red-500'}>
                {agentDetail.online ? 'آنلاین' : 'آفلاین'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>نسخه</span>
              <span className="font-mono">{agentDetail.version}</span>
            </div>
            {agentDetail.last_seen != null && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text3)' }}>آخرین بازدید</span>
                <span>{new Date(agentDetail.last_seen * 1000).toLocaleString('fa-IR')}</span>
              </div>
            )}
            {agentDetail.drives != null && (
              <div>
                <span style={{ color: 'var(--text3)' }}>درایوها</span>
                <p className="font-mono text-xs mt-1 break-all">{String(agentDetail.drives)}</p>
              </div>
            )}
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
