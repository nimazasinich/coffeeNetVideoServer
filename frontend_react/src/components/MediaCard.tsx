import { HardDrive, Play, CheckCircle } from 'lucide-react';
import type { Media } from '../lib/types';
import { formatBytes, typeLabel } from '../lib/utils';

interface MediaCardProps {
  media:     Media;
  onClick:   (m: Media) => void;
  onPlay?:   (m: Media) => void;
  selected?: boolean;
}

const GENRE_COLORS: Record<string, string> = {
  '4K':   'var(--violet)',
  'HD':   'var(--blue)',
  'SD':   'var(--cyan)',
};

export function MediaCard({ media, onClick, onPlay, selected }: MediaCardProps) {
  const accentColor = GENRE_COLORS[media.category] ?? 'var(--blue)';

  return (
    <div
      className="media-card"
      onClick={() => onClick(media)}
      style={{
        cursor: 'pointer',
        outline: selected ? `2px solid var(--blue)` : 'none',
        outlineOffset: 2,
        position: 'relative',
      }}
    >
      {/* Selected indicator */}
      {selected && (
        <div style={{
          position: 'absolute', top: 6, right: 6, zIndex: 10,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={13} color="white" />
        </div>
      )}

      {/* Cover */}
      <div className="cover-placeholder" style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }} />
        {/* Play overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s', background: 'rgba(0,0,0,0.35)',
          }}
          className="card-play-overlay"
        >
          <button
            onClick={e => { e.stopPropagation(); (onPlay ?? onClick)(media); }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(77,159,255,0.9)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Play size={16} color="white" fill="white" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 10px 8px' }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text1)',
          lineHeight: 1.35, marginBottom: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{media.name}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
            background: `${accentColor}18`, color: accentColor, letterSpacing: '0.06em',
          }}>
            {media.category} · {typeLabel(media.type)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text3)' }}>
            <HardDrive size={9} />
            {formatBytes(media.size_bytes)}
          </span>
        </div>

        {media.price_usd !== undefined && media.price_usd > 0 && (
          <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
            ${media.price_usd.toFixed(2)}
          </div>
        )}
      </div>

      <style>{`.media-card:hover .card-play-overlay { opacity: 1 !important; }`}</style>
    </div>
  );
}
