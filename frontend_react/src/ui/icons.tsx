/**
 * SmartCopy Pro — Icon Registry
 * Central mapping of semantic icon names to lucide-react components.
 * Use these instead of emoji or direct lucide imports scattered across files.
 */
import {
  Film,
  Tv2,
  Search,
  HardDrive,
  Smartphone,
  Wifi,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Ban,
  Zap,
  Upload,
  Download,
  RefreshCw,
  Settings,
  Shield,
  Server,
  Users,
  Activity,
  TrendingUp,
  CreditCard,
  Banknote,
  ShoppingCart,
  X,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Monitor,
  List,
  Sliders,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react';

export const Icons: Record<string, LucideIcon> = {
  // Media types
  movie:       Film,
  series:      Tv2,
  
  // Actions
  search:      Search,
  upload:      Upload,
  download:    Download,
  refresh:     RefreshCw,
  settings:    Settings,
  close:       X,
  
  // Delivery
  usb:         HardDrive,
  mobile:      Smartphone,
  wifi:        Wifi,
  
  // Status
  success:     CheckCircle,
  error:       XCircle,
  warning:     AlertCircle,
  pending:     Clock,
  loading:     Loader2,
  cancelled:   Ban,
  active:      Zap,
  
  // Payment
  creditCard:  CreditCard,
  cash:        Banknote,
  cart:        ShoppingCart,
  
  // System
  server:      Server,
  shield:      Shield,
  users:       Users,
  activity:    Activity,
  trending:    TrendingUp,
  monitor:     Monitor,
  list:        List,
  sliders:     Sliders,
  checkSquare: CheckSquare,
  
  // Navigation
  chevronUp:    ChevronUp,
  chevronDown:  ChevronDown,
  chevronRight: ChevronRight,
} as const;

/** Semantic icon name for a media type */
export function mediaIconName(type: 'movie' | 'series'): keyof typeof Icons {
  return type === 'movie' ? 'movie' : 'series';
}

/** Semantic icon name for a job status */
export function statusIconName(status: string): keyof typeof Icons {
  const map: Record<string, string> = {
    active:    'active',
    pending:   'pending',
    queued:    'pending',
    completed: 'success',
    failed:    'error',
    cancelled: 'cancelled',
  };
  return (map[status] ?? 'pending') as keyof typeof Icons;
}
