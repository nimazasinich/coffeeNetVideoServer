import { MediaCard } from './MediaCard';
import type { Media } from '../lib/types';

interface MediaGridProps {
  media:        Media[];
  onSelect:     (media: Media) => void;
  onPlay?:      (media: Media) => void;   // FIX: forwarded to MediaCard
  selectedIds?: Set<string>;
  disabled?:    boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ aspectRatio: '2/3' }} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-8 w-full mt-3" />
      </div>
    </div>
  );
}

export function MediaGrid({ media, onSelect, onPlay, selectedIds, disabled }: MediaGridProps) {
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 fade-in">
        <div className="text-6xl mb-4 opacity-40">🎬</div>
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--text2)' }}>فیلمی یافت نشد</p>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>جستجو یا فیلتر خود را تغییر دهید</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {media.map((item, i) => (
        <MediaCard
          key={item.id}
          media={item}
          onSelect={onSelect}
          onPlay={onPlay}
          isSelected={selectedIds?.has(item.id)}
          disabled={disabled}
          index={i}
        />
      ))}
    </div>
  );
}

export function MediaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
