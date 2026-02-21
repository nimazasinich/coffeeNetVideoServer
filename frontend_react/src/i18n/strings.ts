/**
 * SmartCopy Pro — User-Facing Strings
 * All UI text centralized here. No raw strings in JSX.
 * Eliminates technical jargon from operator-facing UI.
 */

export const strings = {
  // ── App / Global ────────────────────────────────────────────────────────────
  appName:          'SmartCopy Pro',
  loading:          'Loading...',
  retry:            'Retry',
  cancel:           'Cancel',
  close:            'Close',
  confirm:          'Confirm',
  save:             'Save',
  back:             'Back',
  refresh:          'Refresh',
  search:           'Search',
  noResults:        'No results found',
  error:            'Something went wrong',
  serverOffline:    'Server offline — please start the backend',
  connectionError:  'Connection error — retrying automatically',

  // ── Media ───────────────────────────────────────────────────────────────────
  media:            'Media Library',
  mediaEmpty:       'No media found',
  mediaLoading:     'Loading media...',
  mediaSearchEmpty: 'No results match your search',
  movie:            'Movie',
  series:           'Series',
  allCategories:    'All',
  
  // ── Delivery ────────────────────────────────────────────────────────────────
  deliveryMethod:   'Delivery Method',
  deliveryUsb:      'Copy to USB',
  deliveryMobile:   'Mobile Download',
  deliveryUsbShort: 'USB',
  deliveryMobileShort: 'Mobile',

  // ── Payment ─────────────────────────────────────────────────────────────────
  paymentMethod:    'Payment Method',
  paymentManual:    'Pay at Counter',
  paymentOnline:    'Online Payment',
  paymentManualShort: 'Manual',
  paymentOnlineShort: 'Online',
  
  // ── Jobs ────────────────────────────────────────────────────────────────────
  submitRequest:    'Submit Request',
  submitAndPay:     'Submit & Pay',
  requestSubmitted: 'Request Submitted',
  requestPending:   'Your request is pending admin approval.',
  keepDriveConnected: 'Keep your USB drive connected to the device.',
  downloadLinkPending: 'Download link will be sent after admin approval.',

  // ── Job Status Labels (replacing raw backend status codes) ──────────────────
  status: {
    pending:   'Awaiting Approval',
    queued:    'In Queue',
    active:    'Copying',
    completed: 'Completed',
    failed:    'Failed',
    cancelled: 'Cancelled',
  } as Record<string, string>,

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  dashboard:        'Dashboard',
  overview:         'Overview',
  jobQueue:         'Job Queue',
  agents:           'Agents',
  settings:         'Settings',
  activeJobs:       'Active Jobs',
  completedToday:   'Completed Today',
  bandwidthToday:   'Bandwidth Today',
  activeAgents:     'Active Agents',
  systemHealth:     'System Health',
  runningJobs:      'Running Jobs',
  agentStatus:      'Agent Status',
  liveBandwidth:    'Live Bandwidth — Last 30 Minutes',
  jobDistribution:  'Job Distribution',
  activeSessions:   'Active Download Sessions',
  noActiveSessions: 'No active sessions',
  noActiveJobs:     'No active jobs',
  noAgentsRegistered: 'No agents registered',

  // ── System metrics ───────────────────────────────────────────────────────────
  cpu:     'CPU',
  ram:     'RAM',
  disk:    'Disk',
  load:    'Load',
  uptime:  'Uptime',
  
  // ── Approve/Deny ─────────────────────────────────────────────────────────────
  approve:         'Approve',
  deny:            'Deny',
  confirmPayment:  'Confirm Payment',
  paymentReceived: 'Payment Received',
  
  // ── Drive / Agent ────────────────────────────────────────────────────────────
  drives:         'Drives',
  noDrives:       'No drives connected',
  driveConnected: 'Drive Connected',
  driveLocked:    'In Use',
  agentOnline:    'Online',
  agentOffline:   'Offline',
  
  // ── Settings ─────────────────────────────────────────────────────────────────
  shopName:        'Shop Name',
  currency:        'Currency',
  pricing:         'Pricing',
  
  // ── Error messages (replacing WS codes / technical jargon) ──────────────────
  wsDisconnected:  'Connection lost — reconnecting...',
  loadFailed:      'Could not load data. Check your connection.',
  jobCreateFailed: 'Failed to submit request. Please try again.',
  loginFailed:     'Incorrect username or password.',
  
  // ── Toast messages ───────────────────────────────────────────────────────────
  toast: {
    requestSubmitted: 'Request submitted successfully',
    paymentConfirmed: 'Payment confirmed',
    jobApproved:      'Job approved',
    jobCancelled:     'Job cancelled',
    settingsSaved:    'Settings saved',
    scanComplete:     'Library scan complete',
  },
} as const;

export type Strings = typeof strings;
