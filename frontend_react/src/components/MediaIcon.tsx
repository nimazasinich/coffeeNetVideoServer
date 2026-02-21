import { Tv, Film, Sparkles } from 'lucide-react';

type MediaType = 'series' | 'movie';
type FeaturedTag = 'hero' | 'sparkles' | null;

export function MediaIcon({
  type,
  featuredTag,
  size = 24,
  className = '',
}: {
  type: MediaType;
  featuredTag?: FeaturedTag;
  size?: number;
  className?: string;
}) {
  if (featuredTag === 'hero') return <Film className={className} style={{ width: size, height: size }} />;
  if (featuredTag === 'sparkles') return <Sparkles className={className} style={{ width: size, height: size }} />;
  return type === 'series' ? (
    <Tv className={className} style={{ width: size, height: size }} />
  ) : (
    <Film className={className} style={{ width: size, height: size }} />
  );
}
