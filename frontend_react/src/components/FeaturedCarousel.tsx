import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Zap, WifiOff } from 'lucide-react';
import { useSmartCopy } from '../context/SmartCopyContext';
import type { Media } from '../lib/types';
import { formatBytes, mediaEmoji, typeLabel } from '../lib/utils';

const GENRE_GRADIENTS: Record<string, string> = {
  'Science Fiction': 'linear-gradient(135deg, rgba(0,100,200,0.6), rgba(0,229,255,0.4))',
  'Action':          'linear-gradient(135deg, rgba(77,159,255,0.6), rgba(0,229,255,0.4))',
  'Drama':           'linear-gradient(135deg, rgba(130,80,220,0.6), rgba(192,132,252,0.4))',
  'Comedy':          'linear-gradient(135deg, rgba(200,160,0,0.5), rgba(255,204,68,0.4))',
  'Horror':          'linear-gradient(135deg, rgba(180,30,60,0.6), rgba(255,85,119,0.4))',
  'Fantasy':         'linear-gradient(135deg, rgba(100,50,200,0.6), rgba(192,132,252,0.4))',
};

interface Props { onSelect: (m: Media) => void; }

export function FeaturedCarousel({ onSelect }: Props) {
  const { media, serverOnline } = useSmartCopy();
  const featured = media.slice(0, 6);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!featured.length) return;
    const t = setInterval(() => setIdx(i => (i + 1) % featured.length), 5000);
    return () => clearInterval(t);
  }, [featured.length]);

  if (!serverOnline || !featured.length) {
    return (
      <div style={{
        borderRadius: 'var(--r-lg)',
        height: 200,
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: 'var(--text3)',
      }}>
        <WifiOff size={28} style={{ opacity: 0.3 }} />
        <p style={{ fontSize: 12 }}>Connect to server to see featured content</p>
      </div>
    );
  }

  const m = featured[idx];
  const gradient = GENRE_GRADIENTS[m.category] ?? 'linear-gradient(135deg, rgba(30,60,140,0.7), rgba(0,100,200,0.5))';

  return (
    <div style={{
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      position: 'relative',
      height: 200,
      background: 'var(--bg3)',
      border: '1px solid var(--border2)',
      boxShadow: 'var(--shadow-2)',
      cursor: 'pointer',
      flexShrink: 0,
    }}
      onClick={() => onSelect(m)}
    >
      {/* Gradient background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: gradient,
        transition: 'background 0.8s ease',
      }} />

      {/* Pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Content */}
      <div style={{
        position: 'absolute', inset: 0,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ fontSize: '4rem', flexShrink: 0 }}>{mediaEmoji(m.type)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="chip chip-live" style={{ fontSize: 9 }}>
              <span className="pulse-dot" style={{ width: 5, height: 5 }} />
              Trending
            </span>
            <span className={`chip chip-${m.type}`} style={{ fontSize: 9 }}>{typeLabel(m.type)}</span>
          </div>
          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text1)',
            marginBottom: 6,
            lineHeight: 1.2,
          }}>
            {m.name}
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            {m.category} · {formatBytes(m.size_bytes)}
          </p>
          <button
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: 12 }}
            onClick={e => { e.stopPropagation(); onSelect(m); }}
          >
            <Zap size={13} />
            Quick Copy
          </button>
        </div>
        {m.price_usd !== undefined && (
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'DM Mono, monospace',
            flexShrink: 0,
          }}>
            ${m.price_usd.toFixed(2)}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      {featured.length > 1 && (
        <>
          <button
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border2)',
              borderRadius: 8, color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, backdropFilter: 'blur(8px)',
              zIndex: 2,
            }}
            onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + featured.length) % featured.length); }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border2)',
              borderRadius: 8, color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, backdropFilter: 'blur(8px)',
              zIndex: 2,
            }}
            onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % featured.length); }}
          >
            <ChevronLeft size={16} />
          </button>
        </>
      )}

      {/* Dots */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5,
      }}>
        {featured.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 18 : 5,
            height: 5,
            borderRadius: 99,
            background: i === idx ? 'var(--blue)' : 'rgba(255,255,255,0.25)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
          }}
            onClick={e => { e.stopPropagation(); setIdx(i); }}
          />
        ))}
      </div>
    </div>
  );
}
