# SmartCopy Pro — Design System

## Usage

```tsx
import { colors, space, type as typeTokens, radius, shadow, motion, statusColors } from '../design-system/tokens';

// In JSX style props:
<div style={{ color: colors.primary, padding: space.s4, borderRadius: radius.md }}>

// Status color by job status:
<div style={{ color: statusColors['active'] }}>
```

## Tokens Reference

| Category | Export | Example |
|---|---|---|
| Colors | `colors.primary` | `var(--blue)` |
| Spacing | `space.s4` | `16px` |
| Typography | `type.body` | `14px` |
| Radius | `radius.md` | `var(--r)` |
| Shadow | `shadow.sm` | `var(--shadow-1)` |
| Motion | `motion.fast` | `120ms` |
| Status | `statusColors['active']` | `var(--blue)` |

## Rules

1. **No hardcoded hex/rgb** in TSX files — always use tokens.
2. **No hardcoded px spacing** — use `space.*` tokens.
3. **All CSS custom properties** defined in `index.css` (primitives) and `variables.css` (semantic aliases).
4. Run `bash scripts/check_no_hardcoded_colors.sh` to verify compliance.
