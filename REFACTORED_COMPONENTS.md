# REFACTORED_COMPONENTS.md

| File | Change | Type |
|---|---|---|
| `backend/main.py` | Added assets_router, ApproveJobRequest body | Backend wiring |
| `frontend_react/src/lib/api.ts` | Fixed approveJob sig + mediaRescan path | API fix |
| `frontend_react/src/context/SmartCopyContext.tsx` | Added real WS connection | Non-visual |
| `frontend_react/src/lib/utils.ts` | Replaced emoji with SVG icon helpers | Non-visual |
| `frontend_react/src/components/CopyModal.tsx` | Uses ui/Overlay; emoji → SVG | Non-visual |
| `frontend_react/src/components/ModalDrawer.tsx` | Full rewrite to ui/Overlay | Non-visual |
| `frontend_react/src/components/MediaGrid.tsx` | Uses MediaGridSkeleton; emoji → Search icon | Non-visual |
| `frontend_react/src/components/AdminDashboardModern.tsx` | 7 hex colors → token vars | Non-visual |
| `frontend_react/src/components/DriveAgentPanel.tsx` | aria-label added | Non-visual |
| `frontend_react/src/main.tsx` | Added variables.css import | Non-visual |

## New Files Added

| File | Purpose |
|---|---|
| `frontend_react/src/design-system/tokens.ts` | Design token exports |
| `frontend_react/src/design-system/variables.css` | CSS custom properties |
| `frontend_react/src/design-system/README.md` | Token usage guide |
| `frontend_react/src/ui/Overlay/Overlay.tsx` | Unified modal/drawer component |
| `frontend_react/src/ui/icons.tsx` | Centralized icon registry |
| `frontend_react/src/ui/animations.ts` | Animation token helpers |
| `frontend_react/src/ui/skeletons/index.tsx` | Skeleton loading components |
| `frontend_react/src/i18n/strings.ts` | User-facing string constants |
| `frontend_react/src/pages/AdminDashboardModern/index.tsx` | Decomposed admin page |
| `frontend_react/src/pages/AdminDashboardModern/AdminDashboardContext.tsx` | Admin context/hooks |
| `frontend_react/src/pages/AdminDashboardModern/QuickViews.tsx` | Chart/overview sub-components |
| `backend/routers/assets_router.py` | Poster upload endpoint |
| `scripts/import-posters.py` | Bulk poster CLI |
| `scripts/verify_frontend.sh` | Verification script |
| `scripts/check_no_hardcoded_colors.sh` | Color lint script |
| `scripts/run_a11y.sh` | Accessibility audit script |
| `db/migrations/002_poster_audit.sql` | poster_url + audit_logs migration |
| `tasks/IMPLEMENTATION_TASKS.md` | Full task list |
| `INTEGRATION_CHECKLIST.md` | Backend/frontend wiring guide |
| `reports/a11y/axe_report.json` | A11y audit results |
| `config.example.json` | Operator configuration template |
