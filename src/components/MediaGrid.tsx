import { MediaCard } from './MediaCard';
import type { Database } from '../lib/database.types';

type Media = Database['public']['Tables']['media']['Row'];

interface MediaGridProps {
  media: Media[];
  onCopy: (mediaId: string) => void;
  disabled?: boolean;
}

export function MediaGrid({ media, onCopy, disabled }: MediaGridProps) {
  if (media.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No media found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {media.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          onCopy={onCopy}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
