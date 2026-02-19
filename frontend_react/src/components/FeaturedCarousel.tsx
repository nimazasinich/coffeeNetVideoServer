import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Flame, Sparkles, Play } from 'lucide-react';
import { formatBytes, formatPrice, mediaEmoji } from '../lib/utils';
import type { Media } from '../lib/types';

import { mediaApi } from '../lib/api';

interface FeaturedItem extends Media {
  featured_tag?: 'NEW' | 'TRENDING' | null;
}

interface FeaturedCarouselProps {
  onCopy: (mediaId: string) => void;
}

export function FeaturedCarousel({ onCopy }: FeaturedCarouselProps) {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mediaApi.featured()
      .then(data => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (loading) {
    return (
      <div className="featured-section">
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton h-6 w-40" />
        </div>
        <div className="featured-scroll">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="featured-card" style={{ flex: '0 0 280px' }}>
              <div className="skeleton" style={{ aspectRatio: '16/9' }} />
              <div className="p-4 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="featured-section">
      {/* Hero Banner */}
      <div className="hero-banner fade-up">
        <div className="hero-content">
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            <span className="brand-text">پیشنهاد ویژه</span> امروز
          </h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text2)' }}>
            جدیدترین و پرطرفدارترین فیلم‌ها برای شما
          </p>
          <div className="flex items-center gap-3">
            <span className="chip chip-completed">
              <Sparkles className="w-3 h-3" />
              {items.filter(i => i.featured_tag === 'NEW').length} جدید
            </span>
            <span className="chip chip-failed" style={{ background: 'rgba(255,124,77,.12)', color: '#ff7c4d', borderColor: 'rgba(255,124,77,.2)' }}>
              <Flame className="w-3 h-3" />
              {items.filter(i => i.featured_tag === 'TRENDING').length} پرطرفدار
            </span>
          </div>
        </div>
        <span className="hero-emoji">🎬</span>
      </div>

      {/* Carousel header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
          ✨ ویترین
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8"
            style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8"
            style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div ref={scrollRef} className="featured-scroll">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="featured-card fade-up"
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => item.is_copyable && onCopy(item.id)}
          >
            {/* Ribbon */}
            {item.featured_tag && (
              <div className={`ribbon ${item.featured_tag === 'NEW' ? 'ribbon-new' : 'ribbon-trending'}`}>
                {item.featured_tag === 'NEW' ? (
                  <><Sparkles className="w-3 h-3 inline-block mr-1" />جدید</>
                ) : (
                  <><Flame className="w-3 h-3 inline-block mr-1" />پرطرفدار</>
                )}
              </div>
            )}

            {/* Quality ribbon */}
            {item.category === '4K' && (
              <div className="ribbon ribbon-4k" style={{ left: 'var(--space-2)', right: 'auto' }}>
                4K UHD
              </div>
            )}

            {/* Poster */}
            <div className="featured-card-poster group">
              <span className="text-5xl select-none opacity-70 group-hover:scale-110 transition-transform" style={{ transitionDuration: '400ms' }}>
                {mediaEmoji(item.type)}
              </span>
              {/* Dot pattern overlay */}
              <div className="absolute inset-0 opacity-5"
                   style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.4) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ transitionDuration: '200ms' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                     style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}>
                  <Play className="w-4 h-4 fill-current" style={{ color: '#07070d', marginRight: '-2px' }} />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="featured-card-body">
              <h4 className="font-bold text-sm leading-snug mb-1 line-clamp-2" style={{ color: 'var(--text)' }}>
                {item.name}
              </h4>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text3)' }}>
                <span className={`chip ${item.category === '4K' ? 'chip-4k' : item.category === 'HD' ? 'chip-hd' : 'chip-sd'}`}
                      style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                  {item.category}
                </span>
                <span className="mono">{formatBytes(item.size_bytes)}</span>
                {item.price_usd !== undefined && item.price_usd > 0 && (
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>{formatPrice(item.price_usd)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
