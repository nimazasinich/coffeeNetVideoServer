import { X } from 'lucide-react';
import { useState } from 'react';
import { DriveSelector } from './DriveSelector';
import { formatBytes } from '../lib/utils';
import type { Database } from '../lib/database.types';

type Media = Database['public']['Tables']['media']['Row'];
type Drive = Database['public']['Tables']['drives']['Row'];
type PricingTier = Database['public']['Tables']['pricing_tiers']['Row'];

interface CopyModalProps {
  media: Media;
  drives: Drive[];
  pricingTiers: PricingTier[];
  onConfirm: (driveId: string) => void;
  onClose: () => void;
}

export function CopyModal({ media, drives, pricingTiers, onConfirm, onClose }: CopyModalProps) {
  const [selectedDrive, setSelectedDrive] = useState<Drive | null>(null);

  const pricing = pricingTiers.find(
    (tier) => tier.category.toLowerCase() === media.category.toLowerCase()
  );

  const handleConfirm = () => {
    if (selectedDrive) {
      onConfirm(selectedDrive.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Copy to USB Drive</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{media.name}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Size: {formatBytes(media.size_bytes)}</span>
              <span>Type: {media.type}</span>
              <span>Quality: {media.category}</span>
            </div>
            {pricing && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Price:</span> {pricing.currency} {pricing.price.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <DriveSelector
            drives={drives}
            selectedDrive={selectedDrive}
            onSelect={setSelectedDrive}
          />

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDrive}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Start Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
