/**
 * SmartCopy Pro — Skeleton Components
 * Loading skeletons for media cards, job rows, and agent rows.
 * Use during data loading states.
 */

// ── Base skeleton pulse style ────────────────────────────────────────────────
const skeletonBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 'var(--r-sm)',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
};

function SkeletonBlock({ width, height, style }: { width?: string | number; height?: number | string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...skeletonBase,
        width: width ?? '100%',
        height: height ?? 14,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

// ── Media Card Skeleton ──────────────────────────────────────────────────────
export function MediaCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      aria-label="Loading media item"
      role="status"
    >
      {/* Poster area */}
      <SkeletonBlock height={120} style={{ borderRadius: 'var(--r-sm)' }} />
      {/* Title */}
      <SkeletonBlock width="80%" height={14} />
      {/* Subtitle row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <SkeletonBlock width={40} height={18} style={{ borderRadius: 99 }} />
        <SkeletonBlock width={60} height={18} />
      </div>
      {/* Price */}
      <SkeletonBlock width={50} height={20} />
      {/* Button */}
      <SkeletonBlock height={36} style={{ borderRadius: 'var(--r-sm)' }} />
    </div>
  );
}

// ── Job Row Skeleton ─────────────────────────────────────────────────────────
export function JobRowSkeleton() {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--r-sm)',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
      aria-label="Loading job"
      role="status"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SkeletonBlock width={50} height={16} style={{ borderRadius: 99 }} />
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width={40} height={14} style={{ marginLeft: 'auto' }} />
      </div>
      <SkeletonBlock height={3} style={{ borderRadius: 99 }} />
    </div>
  );
}

// ── Agent Row Skeleton ───────────────────────────────────────────────────────
export function AgentRowSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--r-sm)',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid var(--border)',
      }}
      aria-label="Loading agent"
      role="status"
    >
      <SkeletonBlock width={8} height={8} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <SkeletonBlock width="50%" height={12} />
      <SkeletonBlock width={40} height={18} style={{ borderRadius: 99, marginLeft: 'auto' }} />
    </div>
  );
}

// ── Media Grid Skeleton — multiple cards ─────────────────────────────────────
export function MediaGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </>
  );
}

// ── Dashboard KPI Skeleton ───────────────────────────────────────────────────
export function KpiSkeleton() {
  return (
    <div
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      aria-label="Loading metric"
      role="status"
    >
      <SkeletonBlock width="50%" height={10} />
      <SkeletonBlock width="70%" height={32} />
      <SkeletonBlock width="80%" height={10} />
    </div>
  );
}
