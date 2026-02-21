/**
 * SmartCopy Pro — Design Tokens
 * All values map to CSS custom properties defined in variables.css / index.css
 * Use these in TSX files instead of hardcoded hex/rgb values.
 */

// ── Color tokens (map to CSS vars) ──────────────────────────────────────────
export const colors = {
  // Primary palette
  primary:    'var(--blue)',
  primaryAlt: 'var(--blue2)',
  secondary:  'var(--cyan)',

  // Status
  success:    'var(--green)',
  warning:    'var(--amber)',
  danger:     'var(--red)',
  info:       'var(--violet)',

  // Surfaces
  surface:    'var(--glass)',
  surface0:   'var(--bg0)',
  surface1:   'var(--bg1)',
  surface2:   'var(--bg2)',
  surface3:   'var(--bg3)',
  surface4:   'var(--bg4)',
  backdrop:   'rgba(0,0,0,0.8)',

  // Borders
  border:     'var(--border)',
  border2:    'var(--border2)',
  border3:    'var(--border3)',

  // Text
  text:       'var(--text1)',
  textMuted:  'var(--text2)',
  textFaint:  'var(--text3)',
  textGhost:  'var(--text4)',

  // Accent
  accent:     'var(--accent)',

  // Dim variants (for backgrounds/halos)
  primaryDim:  'var(--blue-dim)',
  secondaryDim:'var(--cyan-dim)',
  successDim:  'var(--green-dim)',
  warningDim:  'var(--amber-dim)',
  dangerDim:   'var(--red-dim)',
  infosDim:    'var(--violet-dim)',

  // Glow variants
  primaryGlow:  'var(--blue-glow)',
  secondaryGlow:'var(--cyan-glow)',
  successGlow:  'var(--green-glow)',
} as const;

// ── Spacing tokens ───────────────────────────────────────────────────────────
export const space = {
  s0: '2px',
  s1: '4px',
  s2: '8px',
  s3: '12px',
  s4: '16px',
  s5: '24px',
  s6: '32px',
  s7: '48px',
  s8: '64px',
} as const;

// ── Typography tokens ────────────────────────────────────────────────────────
export const type = {
  h1:      '32px',
  h2:      '24px',
  h3:      '18px',
  h4:      '15px',
  body:    '14px',
  small:   '12px',
  caption: '11px',
  micro:   '10px',
  mono:    'DM Mono, monospace',
  sans:    'Inter, Syne, sans-serif',
} as const;

// ── Border radius tokens ─────────────────────────────────────────────────────
export const radius = {
  sm:   'var(--r-sm)',
  md:   'var(--r)',
  lg:   'var(--r-lg)',
  xl:   'var(--r-xl)',
  full: '9999px',
} as const;

// ── Shadow tokens ────────────────────────────────────────────────────────────
export const shadow = {
  sm:   'var(--shadow-1)',
  md:   'var(--shadow-2)',
  glow: 'var(--shadow-glow)',
} as const;

// ── Motion tokens ────────────────────────────────────────────────────────────
export const motion = {
  fast:   '120ms',
  medium: '240ms',
  slow:   '400ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
} as const;

// ── Icon size token ──────────────────────────────────────────────────────────
export const iconSize = {
  xs:  12,
  sm:  14,
  md:  16,
  lg:  20,
  xl:  24,
  xxl: 30,
} as const;

// ── Status color map (for charts and status indicators) ──────────────────────
export const statusColors: Record<string, string> = {
  active:    'var(--blue)',
  queued:    'var(--cyan)',
  pending:   'var(--amber)',
  completed: 'var(--green)',
  failed:    'var(--red)',
  cancelled: 'var(--text3)',
} as const;
