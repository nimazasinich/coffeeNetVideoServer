import { useState, useMemo } from 'react';
import { Download, Menu } from 'lucide-react';
import { useSmartCopy } from './contexts/SmartCopyContext';
import { SearchBar } from './components/SearchBar';
import { CategoryFilter } from './components/CategoryFilter';
import { MediaGrid } from './components/MediaGrid';
import { JobQueue } from './components/JobQueue';
import { CopyModal } from './components/CopyModal';

function App() {
  const {
    media,
    drives,
    jobs,
    pricingTiers,
    selectedCategory,
    searchQuery,
    loading,
    error,
    setCategory,
    setSearchQuery,
    createJob,
    cancelJob,
  } = useSmartCopy();

  const [showQueue, setShowQueue] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.type === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [media, selectedCategory, searchQuery]);

  const mediaMap = useMemo(() => {
    const map = new Map<string, string>();
    media.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [media]);

  const activeJobs = useMemo(() => {
    return jobs.filter((job) =>
      job.status === 'pending' || job.status === 'active'
    );
  }, [jobs]);

  const handleCopyClick = (mediaId: string) => {
    setSelectedMedia(mediaId);
  };

  const handleConfirmCopy = async (driveId: string) => {
    if (selectedMedia) {
      try {
        await createJob(selectedMedia, driveId);
        setShowQueue(true);
      } catch (err) {
        alert('Failed to create copy job: ' + (err as Error).message);
      }
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
    } catch (err) {
      alert('Failed to cancel job: ' + (err as Error).message);
    }
  };

  const selectedMediaItem = media.find((m) => m.id === selectedMedia);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SmartCopy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-900 font-bold mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">SmartCopy</h1>
            </div>
            <button
              onClick={() => setShowQueue(!showQueue)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-700" />
              {activeJobs.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {activeJobs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className={`${showQueue ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>
                <CategoryFilter selected={selectedCategory} onChange={setCategory} />
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCategory === 'all' ? 'All Media' : selectedCategory === 'movie' ? 'Movies' : 'Series'}
                    <span className="ml-2 text-gray-500 font-normal text-base">
                      ({filteredMedia.length})
                    </span>
                  </h2>
                </div>
                <MediaGrid
                  media={filteredMedia}
                  onCopy={handleCopyClick}
                  disabled={drives.length === 0}
                />
              </div>
            </div>
          </div>

          {showQueue && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg p-6 border border-gray-200 lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Copy Queue
                  {activeJobs.length > 0 && (
                    <span className="ml-2 text-blue-600 text-base font-normal">
                      ({activeJobs.length} active)
                    </span>
                  )}
                </h2>
                <JobQueue
                  jobs={jobs}
                  mediaMap={mediaMap}
                  onCancel={handleCancelJob}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedMediaItem && (
        <CopyModal
          media={selectedMediaItem}
          drives={drives}
          pricingTiers={pricingTiers}
          onConfirm={handleConfirmCopy}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
}

export default App;
