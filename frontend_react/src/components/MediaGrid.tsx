import { useSmartCopy } from '../context/SmartCopyContext';
import { MediaGridSkeleton } from '../ui/skeletons';
import { MediaCard } from './MediaCard';
import { WifiOff, Search } from 'lucide-react';
import type { Media } from '../lib/types';

interface MediaGridProps {
  onSelect:     (m: Media) => void;
  selectedIds?: Set<string>;
  onPlay?:      (m: Media) => void;
}

export function MediaGrid({ onSelect, selectedIds, onPlay }: MediaGridProps) {
  const { media, mediaLoading, serverOnline, searchQuery, selectedCategory } = useSmartCopy();

  // Apply client-side filter if context hasn't already
  const filtered = media.filter(item => {
    const byCategory = !selectedCategory || item.type === selectedCategory;
    const bySearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return byCategory && bySearch;
  });

  if (mediaLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}
           aria-busy="true" aria-label="Loading media library">
        <MediaGridSkeleton count={12} />
      </div>
    );
  }

  if (!serverOnline) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
        <WifiOff size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>Server Offline</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>Start the backend server to load media</p>
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
        <Search size={40} style={{ marginBottom: 16, color: 'var(--text3)', opacity: 0.6 }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>No content found</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>Try changing your filters or search</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {filtered.map(m => (
        <MediaCard
          key={m.id}
          media={m}
          onClick={onSelect}
          onPlay={onPlay}
          selected={selectedIds?.has(m.id)}
        />
      ))}
    </div>
  );
}
