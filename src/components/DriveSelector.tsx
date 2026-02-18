import { HardDrive, AlertCircle } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import type { Database } from '../lib/database.types';

type Drive = Database['public']['Tables']['drives']['Row'];

interface DriveSelectorProps {
  drives: Drive[];
  selectedDrive: Drive | null;
  onSelect: (drive: Drive) => void;
}

export function DriveSelector({ drives, selectedDrive, onSelect }: DriveSelectorProps) {
  if (drives.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-900 mb-1">No USB Drive Detected</h3>
          <p className="text-sm text-yellow-700">
            Please insert a USB drive to begin copying media files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Select USB Drive</h3>
      <div className="grid gap-3">
        {drives.map((drive) => (
          <button
            key={drive.id}
            onClick={() => onSelect(drive)}
            disabled={!!drive.locked_by_job_id}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedDrive?.id === drive.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } ${drive.locked_by_job_id ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start gap-3">
              <HardDrive className="w-6 h-6 text-gray-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {drive.label}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatBytes(drive.available_bytes)} free of {formatBytes(drive.capacity_bytes)}
                </div>
                {drive.locked_by_job_id && (
                  <div className="text-xs text-red-600 mt-1">
                    Currently in use
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
