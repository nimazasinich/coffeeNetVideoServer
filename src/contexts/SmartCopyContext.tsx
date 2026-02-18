import { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Media = Database['public']['Tables']['media']['Row'];
type Drive = Database['public']['Tables']['drives']['Row'];
type Job = Database['public']['Tables']['jobs']['Row'];
type PricingTier = Database['public']['Tables']['pricing_tiers']['Row'];

interface State {
  media: Media[];
  drives: Drive[];
  jobs: Job[];
  pricingTiers: PricingTier[];
  selectedCategory: 'all' | 'movie' | 'series';
  searchQuery: string;
  selectedDrive: Drive | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_MEDIA'; payload: Media[] }
  | { type: 'SET_DRIVES'; payload: Drive[] }
  | { type: 'SET_JOBS'; payload: Job[] }
  | { type: 'SET_PRICING_TIERS'; payload: PricingTier[] }
  | { type: 'SET_CATEGORY'; payload: 'all' | 'movie' | 'series' }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SELECTED_DRIVE'; payload: Drive | null }
  | { type: 'ADD_JOB'; payload: Job }
  | { type: 'UPDATE_JOB'; payload: Job }
  | { type: 'UPDATE_DRIVE'; payload: Drive }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: State = {
  media: [],
  drives: [],
  jobs: [],
  pricingTiers: [],
  selectedCategory: 'all',
  searchQuery: '',
  selectedDrive: null,
  loading: true,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MEDIA':
      return { ...state, media: action.payload };
    case 'SET_DRIVES':
      return { ...state, drives: action.payload };
    case 'SET_JOBS':
      return { ...state, jobs: action.payload };
    case 'SET_PRICING_TIERS':
      return { ...state, pricingTiers: action.payload };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_SELECTED_DRIVE':
      return { ...state, selectedDrive: action.payload };
    case 'ADD_JOB':
      return { ...state, jobs: [...state.jobs, action.payload] };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === action.payload.id ? action.payload : job
        ),
      };
    case 'UPDATE_DRIVE':
      return {
        ...state,
        drives: state.drives.map((drive) =>
          drive.id === action.payload.id ? action.payload : drive
        ),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface SmartCopyContextValue extends State {
  setCategory: (category: 'all' | 'movie' | 'series') => void;
  setSearchQuery: (query: string) => void;
  setSelectedDrive: (drive: Drive | null) => void;
  createJob: (mediaId: string, driveId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const SmartCopyContext = createContext<SmartCopyContextValue | undefined>(undefined);

export function SmartCopyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const [mediaRes, drivesRes, jobsRes, pricingRes] = await Promise.all([
        supabase.from('media').select('*').order('name'),
        supabase.from('drives').select('*').eq('is_connected', true),
        supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('pricing_tiers').select('*').eq('active', true),
      ]);

      if (mediaRes.error) throw mediaRes.error;
      if (drivesRes.error) throw drivesRes.error;
      if (jobsRes.error) throw jobsRes.error;
      if (pricingRes.error) throw pricingRes.error;

      dispatch({ type: 'SET_MEDIA', payload: mediaRes.data });
      dispatch({ type: 'SET_DRIVES', payload: drivesRes.data });
      dispatch({ type: 'SET_JOBS', payload: jobsRes.data });
      dispatch({ type: 'SET_PRICING_TIERS', payload: pricingRes.data });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  useEffect(() => {
    loadData();

    const jobsChannel = supabase
      .channel('jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            dispatch({ type: 'ADD_JOB', payload: payload.new as Job });
          } else if (payload.eventType === 'UPDATE') {
            dispatch({ type: 'UPDATE_JOB', payload: payload.new as Job });
          }
        }
      )
      .subscribe();

    const drivesChannel = supabase
      .channel('drives_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drives' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            dispatch({ type: 'UPDATE_DRIVE', payload: payload.new as Drive });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(drivesChannel);
    };
  }, []);

  const createJob = async (mediaId: string, driveId: string) => {
    const media = state.media.find((m) => m.id === mediaId);
    if (!media) throw new Error('Media not found');

    const { error } = await supabase.from('jobs').insert({
      media_id: mediaId,
      drive_id: driveId,
      total_bytes: media.size_bytes,
    });

    if (error) throw error;
  };

  const cancelJob = async (jobId: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId);

    if (error) throw error;
  };

  const value: SmartCopyContextValue = {
    ...state,
    setCategory: (category) => dispatch({ type: 'SET_CATEGORY', payload: category }),
    setSearchQuery: (query) => dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),
    setSelectedDrive: (drive) => dispatch({ type: 'SET_SELECTED_DRIVE', payload: drive }),
    createJob,
    cancelJob,
    refreshData: loadData,
  };

  return (
    <SmartCopyContext.Provider value={value}>
      {children}
    </SmartCopyContext.Provider>
  );
}

export function useSmartCopy() {
  const context = useContext(SmartCopyContext);
  if (context === undefined) {
    throw new Error('useSmartCopy must be used within a SmartCopyProvider');
  }
  return context;
}
