# IMPLEMENTATION_TASKS.md
## SmartCopy Pro — Full Execution Task List
Generated from repo scan · February 2026

Legend: [P0]=Critical · [P1]=High · [P2]=Nice-to-have
Estimate: XS<30m · S<2h · M<4h · L<8h · XL>8h
Tags: `non-visual` (safe to change) · `visual` (layout must stay identical)

---

## PHASE B — MIGRATION

- [P0][XS] **B.1** `scripts/migrate.sql` + `db/migrations/002_poster_audit.sql`
  Title: Run DB migrations
  Steps: 1. `sqlite3 data/smartcopy.db < scripts/migrate.sql`; 2. `sqlite3 data/smartcopy.db < db/migrations/002_poster_audit.sql`
  Acceptance: No fatal SQL errors; DB contains poster_url column on media table.
  Tag: non-visual

- [P0][S] **B.2** `backend/main.py`
  Title: Register assets_router and mount /posters static dir
  Steps: 1. Add import `from backend.routers.assets_router import router as assets_router`; 2. `app.include_router(assets_router)`; 3. Mount StaticFiles for /posters
  Acceptance: `GET /api/assets/posters` returns 200; `/posters/thumb/` serves files.
  Tag: non-visual

- [P0][S] **B.3** `backend/main.py` — approve_job
  Title: Add ApproveJobRequest model to accept delivery_type/payment_mode override
  Steps: 1. Add Pydantic model; 2. Inject body into approve_job; 3. Apply optional overrides
  Acceptance: `POST /api/admin/jobs/:id/approve {"delivery_type":"mobile"}` updates DB.
  Tag: non-visual

- [P0][XS] **B.4** `frontend_react/src/lib/api.ts`
  Title: Fix mediaRescan path and approveJob signature
  Steps: 1. Change `/rescan` → `/scan`; 2. Add options param to approveJob
  Acceptance: TypeScript compiles; no 404 on media rescan.
  Tag: non-visual

- [P0][XS] **B.5** `frontend_react/src/context/SmartCopyContext.tsx`
  Title: Use dynamic window.location.host for WebSocket URL
  Steps: 1. Replace any hardcoded WS URL with `wss?://${window.location.host}/ws/jobs`
  Acceptance: WS connects correctly in any deployment.
  Tag: non-visual

- [P0][XS] **B.6** `requirements.txt`
  Title: Add Pillow dependency
  Steps: 1. Append `Pillow>=10.0.0`
  Acceptance: `pip install -r requirements.txt` succeeds.
  Tag: non-visual

- [P0][S] **B.7** Copy Phase-0 files into repo
  Title: Add assets_router, import-posters.py, migrations, config.example.json
  Steps: Copy deliverable files to correct paths.
  Tag: non-visual

---

## PHASE C — DESIGN SYSTEM & TOKENS

- [P1][S] **C.1** `frontend_react/src/design-system/tokens.ts`
  Title: Create design tokens module
  Steps: 1. Export colors, space, type, radius, shadow, motion objects mapped to CSS vars
  Acceptance: File compiles; CSS vars exist in index.css.
  Tag: non-visual

- [P1][S] **C.2** `frontend_react/src/design-system/variables.css`
  Title: Design system CSS variables file
  Steps: 1. Mirror all token values as CSS custom properties
  Acceptance: Visual parity maintained.
  Tag: non-visual (visual parity enforced)

- [P1][M] **C.3** `frontend_react/src/components/AdminDashboardModern.tsx` (lines 163,164,585-589)
  Title: Replace 7 hardcoded hex color literals with token vars
  Steps: 1. Replace `#2b7fff` with `var(--blue2)`; `#00e5ff` with `var(--cyan)`; `#4d9fff` with `var(--blue)`; `#ffcc44` with `var(--amber)`; `#00f5a0` with `var(--green)`; `#ff5577` with `var(--red)`
  Acceptance: grep for hardcoded colors in TSX returns 0 results.
  Tag: non-visual

- [P2][XS] **C.4** `scripts/check_no_hardcoded_colors.sh`
  Title: Lint script to fail if hardcoded colors found in TSX
  Acceptance: Script exits non-zero when hex/rgba found.
  Tag: non-visual

---

## PHASE D — OVERLAY UNIFICATION

- [P1][M] **D.1** `frontend_react/src/ui/Overlay/Overlay.tsx`
  Title: Create unified Overlay component (modal + drawer variants)
  Steps: 1. Props: variant/isOpen/onClose/backdropClose/trapFocus; 2. ARIA: role=dialog, aria-modal; 3. Focus trap; 4. Escape key handler; 5. Focus return on close
  Acceptance: Both CopyModal and ModalDrawer work identically; tab order preserved.
  Tag: non-visual (behavior only)

- [P1][S] **D.2** `frontend_react/src/components/CopyModal.tsx`
  Title: Refactor CopyModal to use ui/Overlay
  Steps: 1. Import Overlay; 2. Replace fixed-position overlay div with <Overlay variant="modal">
  Acceptance: Modal opens/closes; Escape works; backdrop click closes; focus trapped.
  Tag: non-visual

- [P1][S] **D.3** `frontend_react/src/components/ModalDrawer.tsx`
  Title: Refactor ModalDrawer to use ui/Overlay
  Acceptance: Drawer behavior identical; Escape closes.
  Tag: non-visual

---

## PHASE E — EMOJI REMOVAL & SVG ICONS

- [P0][S] **E.1** `frontend_react/src/ui/icons.tsx`
  Title: Centralize icon registry
  Steps: 1. Export Icons object mapping names to lucide-react components
  Tag: non-visual

- [P0][S] **E.2** `frontend_react/src/lib/utils.ts` — mediaEmoji
  Title: Replace emoji return values with icon component refs
  Steps: 1. Change mediaEmoji to return icon name string; 2. Add mediaIcon() returning JSX
  Acceptance: No emoji in bundle.
  Tag: visual (icon replaces emoji — visual parity required)

- [P0][XS] **E.3** `frontend_react/src/components/MediaGrid.tsx` line 46
  Title: Replace 🔍 emoji with Search SVG icon
  Steps: 1. Import Search from lucide-react; 2. Replace div with emoji
  Acceptance: No emoji in file.
  Tag: visual (icon same weight as emoji)

---

## PHASE F — ADMIN DASHBOARD DECOMPOSITION

- [P1][L] **F.1-F.8** `frontend_react/src/pages/AdminDashboardModern/`
  Title: Decompose 751-line AdminDashboardModern.tsx into sub-modules
  Steps: 1. Create index.tsx, AdminSidebar, MediaLibraryPanel, PricingPanel, SalesPanel, AgentsManagementPanel, QuickViews, ChangePasswordModal; 2. AdminDashboardContext + hooks/useDashboardData; 3. Keep exact markup
  Acceptance: Build passes; all panels render; no visual diff.
  Tag: non-visual

---

## PHASE G — UX STRINGS CENTRALIZATION

- [P1][M] **G.1** `frontend_react/src/i18n/strings.ts`
  Title: Centralize all user-facing strings
  Steps: 1. Extract strings from all components; 2. Replace with strings.KEY
  Acceptance: No raw user strings in JSX; TypeScript compiles.
  Tag: non-visual

---

## PHASE H — ANIMATIONS & SKELETONS

- [P1][S] **H.1** `frontend_react/src/ui/animations.ts`
  Title: Animation tokens and CSS-in-JS helpers
  Steps: 1. Export fadeIn, slideUp, scaleIn using motion tokens
  Tag: non-visual

- [P1][S] **H.2** `frontend_react/src/ui/skeletons/`
  Title: Skeleton components for MediaCard, JobRow, AgentRow
  Steps: 1. MediaCardSkeleton; 2. JobRowSkeleton; 3. Wire into loading states
  Tag: non-visual (purely additive)

---

## PHASE I — ACCESSIBILITY

- [P0][M] **I.1-I.4** All interactive components
  Title: Focus styles, aria-labels, role=dialog, focus trap, axe report
  Steps: 1. Add :focus-visible outline to CSS; 2. aria-label all icon buttons; 3. Ensure Overlay has role+aria-modal; 4. Run axe-core
  Acceptance: Zero major axe violations.
  Tag: non-visual

---

## PHASE J — CLEANUP

- [P0][S] **J.1-J.5** Codebase-wide
  Title: Remove dead imports, fix TS, ESLint, build
  Steps: 1. eslint --fix; 2. tsc --noEmit; 3. npm run build
  Acceptance: Build succeeds; 0 TS errors; 0 lint errors.
  Tag: non-visual

---

## PHASE K — VERIFICATION & PACKAGING

- [P0][M] **K.1** `scripts/verify_frontend.sh`
  Title: Verification script
  Tag: non-visual

- [P0][XS] **K.2-K.6** ZIP creation, git tag, reports
  Title: Package deliverables with commit history
  Tag: non-visual

---

Total tasks: 32 | P0: 14 | P1: 15 | P2: 3
Visual tasks: 2 (E.2, E.3 — icon replacements only, visual parity required)
