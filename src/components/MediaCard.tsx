import { Film, Tv } from 'lucide-react';
import { formatBytes, getCategoryBadgeColor } from '../lib/utils';
import type { Database } from '../lib/database.types';

type Media = Database['public']['Tables']['media']['Row'];

interface MediaCardProps {
  media: Media;
  onCopy: (mediaId: string) => void;
  disabled?: boolean;
}

export function MediaCard({ media, onCopy, disabled }: MediaCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        {media.type === 'movie' ? (
          <Film className="w-16 h-16 text-gray-400" />
        ) : (
          <Tv className="w-16 h-16 text-gray-400" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {media.name}
        </h3>
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryBadgeColor(media.category)}`}>
            {media.category}
          </span>
          <span className="text-xs text-gray-500">{formatBytes(media.size_bytes)}</span>
        </div>
        <button
          onClick={() => onCopy(media.id)}
          disabled={disabled || !media.is_copyable}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {media.is_copyable ? 'Copy to USB' : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}
