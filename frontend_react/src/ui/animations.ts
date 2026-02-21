/**
 * SmartCopy Pro — Animation Tokens
 * CSS-in-JS animation helpers using motion tokens.
 * Use these instead of inline animation strings.
 */
import { motion } from '../design-system/tokens';

// ── Animation style objects ──────────────────────────────────────────────────

/** Fade in from transparent */
export const fadeIn: React.CSSProperties = {
  animation: `overlay-fade-in ${motion.medium} ${motion.easing} both`,
};

/** Slide up + scale in (for modals) */
export const slideUp: React.CSSProperties = {
  animation: `modal-slide-up ${motion.slow} ${motion.spring} both`,
};

/** Scale in (for cards, badges) */
export const scaleIn: React.CSSProperties = {
  animation: `scale-in ${motion.fast} ${motion.easing} both`,
};

/** Slide in from right (for drawers) */
export const slideInRight: React.CSSProperties = {
  animation: `drawer-slide-in ${motion.medium} ${motion.easing} both`,
};

// ── Transition helpers ───────────────────────────────────────────────────────

/** Standard UI transition — color, border, background */
export const transition: React.CSSProperties = {
  transition: `background ${motion.fast} ${motion.easing}, color ${motion.fast} ${motion.easing}, border-color ${motion.fast} ${motion.easing}, box-shadow ${motion.fast} ${motion.easing}`,
};

/** Smooth layout transition */
export const layoutTransition: React.CSSProperties = {
  transition: `all ${motion.medium} ${motion.easing}`,
};

// ── Hover state helpers (use with onMouseEnter/Leave) ───────────────────────

export const hoverCard = {
  base: {
    transition: `transform ${motion.fast} ${motion.easing}, box-shadow ${motion.fast} ${motion.easing}`,
  } as React.CSSProperties,
  active: {
    transform: 'translateY(-2px)',
    boxShadow: 'var(--shadow-2)',
  } as React.CSSProperties,
};

// ── Spin animation for loading states ───────────────────────────────────────
export const spinStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
};
