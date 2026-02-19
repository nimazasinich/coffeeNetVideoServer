/**
 * Modern Media Card Component
 * FIX: Play button now triggers onPlay callback (CopyModal for single-item copy).
 *      Selection + single-item copy modes both work.
 */
import { Play, Plus, Check } from 'lucide-react';
import { formatBytes, formatPrice, mediaEmoji, typeLabel } from '../lib/utils';
import type { Media } from '../lib/types';

interface MediaCardProps {
  media:     Media;
  onSelect:  (media: Media) => void;
  onPlay?:   (media: Media) => void;  // FIX: wired for single-item CopyModal
  isSelected?: boolean;
  disabled?: boolean;
  index?:    number;
}

export function MediaCard({ media, onSelect, onPlay, isSelected, disabled, index = 0 }: MediaCardProps) {
  const canSelect = media.is_copyable && !disabled;

  return (
    <div
      className={`group relative flex flex-col premium-glass rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-2xl ${
        isSelected ? 'border-accent shadow-[0_0_20px_rgba(232,197,71,0.2)]' : 'border-border hover:border-accent/30'
      } hover:-translate-y-1.5`}
      style={{
        animation: `fadeInUp 0.6s ease-out forwards ${index * 0.05}s`,
        opacity: 0,
      }}
      onClick={() => canSelect && onSelect(media)}
    >
      {/* Visual Header / Poster Area */}
      <div className="relative aspect-[2/3] overflow-hidden bg-bg3">
        <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-500 ${isSelected ? 'from-accent/20 opacity-100' : 'from-accent/5 opacity-50'} to-transparent z-0`} />

        {/* Animated Background Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 group-hover:scale-110 group-hover:opacity-60 transition-all duration-700">
          <span className="text-[120px] select-none filter blur-[2px] contrast-125">
            {mediaEmoji(media.type)}
          </span>
        </div>

        {/* Floating Badges */}
        <div className="absolute top-3 inset-x-3 flex justify-between items-start z-10">
          <Badge category={media.category} />
          {media.price_usd !== undefined && (
            <div className={`glass px-3 py-1 rounded-full text-xs font-black tracking-tighter ${isSelected ? 'bg-accent text-black' : 'text-accent'}`}>
              {media.price_usd === 0 ? 'FREE' : formatPrice(media.price_usd)}
            </div>
          )}
        </div>

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 scale-in">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shadow-[0_0_30px_rgba(232,197,71,0.5)]">
              <Check className="w-8 h-8 text-black stroke-[4px]" />
            </div>
          </div>
        )}

        {/* Category Ribbon for 4K */}
        {media.category === '4K' && (
          <div className="absolute top-1/2 -right-8 rotate-45 bg-accent text-black text-[10px] font-black px-10 py-1 shadow-lg pointer-events-none">
            ULTRA HD
          </div>
        )}

        {/* Hover Actions Overlay — FIX: Play now calls onPlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex gap-3 scale-90 group-hover:scale-100 transition-transform duration-500">
            <button
              className="w-12 h-12 rounded-full bg-accent text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                if (canSelect && onPlay) onPlay(media);
                else if (canSelect) onSelect(media);
              }}
              title="کپی این فیلم"
            >
              <Play className="w-5 h-5 fill-current" />
            </button>
            <button
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-xl hover:bg-white/20 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                canSelect && onSelect(media);
              }}
              title="افزودن به لیست"
            >
              {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Unavailable State */}
        {!media.is_copyable && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] flex flex-col items-center justify-center z-20">
            <span className="px-4 py-1.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold uppercase tracking-widest">
              ناموجود
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col flex-1 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-text3 opacity-60">
            {typeLabel(media.type)}
          </span>
          <div className="h-1 w-1 rounded-full bg-border" />
          <span className="text-[10px] font-bold text-text3 opacity-60">
            {formatBytes(media.size_bytes)}
          </span>
        </div>

        <h3 className="text-sm font-bold text-text leading-tight mb-4 group-hover:text-accent transition-colors line-clamp-2" title={media.name}>
          {media.name}
        </h3>

        <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
          <button
            onClick={e => { e.stopPropagation(); canSelect && onSelect(media); }}
            disabled={!canSelect}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
              canSelect
                ? isSelected
                  ? 'bg-accent text-black border border-accent shadow-[0_0_15px_rgba(232,197,71,0.3)]'
                  : 'bg-white/5 hover:bg-accent/20 border border-white/10 hover:border-accent/40'
                : 'opacity-20 cursor-not-allowed'
            }`}
          >
            {isSelected ? (
              <><Check className="w-3.5 h-3.5" />در لیست انتخاب شده</>
            ) : (
              <><Plus className="w-3.5 h-3.5" />افزودن به لیست کپی</>
            )}
          </button>
        </div>
      </div>

      {/* Glow Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-[radial-gradient(circle_at_50%_0%,rgba(232,197,71,0.08)_0%,transparent_70%)]" />
    </div>
  );
}

function Badge({ category }: { category: string }) {
  const styles = {
    '4K':     'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'HD':     'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'SD':     'bg-gray-500/10 text-gray-400 border-gray-500/30',
    'SERIES': 'bg-green-500/10 text-green-400 border-green-500/30',
  }[category.toUpperCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';

  return (
    <span className={`px-2 py-0.5 text-[9px] font-black tracking-widest border rounded -skew-x-12 ${styles}`}>
      {category}
    </span>
  );
}
