import { useState, useEffect } from 'react';
import { BarChart3, DollarSign, HardDrive, Film, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatBytes } from '../lib/utils';

interface Stats {
  totalMedia: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalRevenue: number;
  connectedDrives: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalMedia: 0,
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    totalRevenue: 0,
    connectedDrives: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [mediaRes, jobsRes, salesRes, drivesRes] = await Promise.all([
        supabase.from('media').select('*', { count: 'exact', head: true }),
        supabase.from('jobs').select('status'),
        supabase.from('sales').select('price_charged, payment_confirmed'),
        supabase.from('drives').select('*', { count: 'exact', head: true }).eq('is_connected', true),
      ]);

      const completedJobs = jobsRes.data?.filter((j) => j.status === 'completed').length || 0;
      const failedJobs = jobsRes.data?.filter((j) => j.status === 'failed').length || 0;
      const totalRevenue = salesRes.data
        ?.filter((s) => s.payment_confirmed)
        .reduce((sum, s) => sum + Number(s.price_charged), 0) || 0;

      setStats({
        totalMedia: mediaRes.count || 0,
        totalJobs: jobsRes.data?.length || 0,
        completedJobs,
        failedJobs,
        totalRevenue,
        connectedDrives: drivesRes.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const successRate = stats.totalJobs > 0
    ? Math.round((stats.completedJobs / stats.totalJobs) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor system performance and statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Media</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalMedia}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Film className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalJobs}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-green-600">{stats.completedJobs} completed</span>
            <span className="text-gray-400">|</span>
            <span className="text-red-600">{stats.failedJobs} failed</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900">{successRate}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Connected Drives</p>
              <p className="text-3xl font-bold text-gray-900">{stats.connectedDrives}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Failed Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{stats.failedJobs}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">System Status</h3>
        <p className="text-blue-700 text-sm">
          All systems operational. {stats.connectedDrives} USB drive{stats.connectedDrives !== 1 ? 's' : ''} ready for copying.
        </p>
      </div>
    </div>
  );
}
