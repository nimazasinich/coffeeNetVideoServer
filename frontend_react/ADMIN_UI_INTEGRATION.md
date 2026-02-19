# Admin UI — Integration checklist & rollback

## Integration checklist (test in development)

1. **Start backend** (from project root):
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
   ```

2. **Start frontend dev server**:
   ```bash
   cd frontend_react
   npm run dev
   ```

3. **Open admin**  
   Go to `http://localhost:5173/#admin` (or the port Vite shows). Log in with admin credentials.

4. **Verify**
   - Sidebar: open/close via menu icon (mobile) or always visible (desktop). Keyboard: Tab through links, Enter to activate.
   - Metric cards: values from `GET /api/admin/dashboard` (or placeholders if API fails).
   - Consumption graph: data from `GET /api/admin/reports/daily?days=30`. Switch ۲۴س / ۷روز / ۳۰روز.
   - Job queue: list from `GET /api/admin/queue`. Live updates via WebSocket `/ws/jobs` or 10s polling fallback.
   - Cancel job: click Cancel → confirm modal → `POST /api/admin/jobs/{id}/cancel`. Success/error toast.
   - Prioritize: click arrow → `POST /api/admin/jobs/{id}/priority`. If API missing, button disabled with tooltip.
   - Drive/Agent panels: data from `/api/drives` and `/api/admin/agents`. Click row for detail drawer.
   - Load balancer: slider + Apply calls `PUT /api/admin/settings` with `max_copies_per_session`. If key not accepted, show “فقط پیشنهاد”.
   - Modals/drawers: Job detail, Drive detail, QR quick view, License quick view. Close with Escape or close button.
   - Health strip: WS status (متصل/قطع), last refresh time, refresh button.

5. **Simulate WS events** (optional)  
   Backend broadcasts on job/drive changes. Create a job from the customer UI or via API to see queue update in admin.

## Controls that require backend endpoints

| Control | Endpoint | If missing |
|--------|----------|------------|
| Cancel job | `POST /api/admin/jobs/{id}/cancel` | Disabled; tooltip: "Backend API not available. To enable: POST /api/admin/jobs/{id}/cancel" |
| Set priority | `POST /api/admin/jobs/{id}/priority` | Disabled; tooltip: "Backend API not available. To enable: POST /api/admin/jobs/{id}/priority" |
| Load balancer apply | `PUT /api/admin/settings` with key `max_copies_per_session` | Control shows "فقط پیشنهاد (API ندارد)" and does not persist |

## Rollback plan

To restore the previous admin frontend:

1. In `frontend_react/src/App.tsx`:
   - Change `import { AdminDashboardModern } from './components/AdminDashboardModern'` back to `import { AdminDashboard } from './components/AdminDashboard'`.
   - Change `<AdminDashboardModern addToast={addToast} />` back to `<AdminDashboard />`.

2. Optionally remove the new components (they are unused after rollback):
   - `frontend_react/src/components/AdminDashboardModern.tsx`
   - `frontend_react/src/components/MetricCard.tsx`
   - `frontend_react/src/components/ConsumptionChart.tsx`
   - `frontend_react/src/components/JobQueuePanel.tsx`
   - `frontend_react/src/components/DriveAgentPanel.tsx`
   - `frontend_react/src/components/LoadBalancerControl.tsx`
   - `frontend_react/src/components/ModalDrawer.tsx`

3. Revert API/type changes if you want the exact previous behavior:
   - `frontend_react/src/lib/api.ts`: remove `cancelJob`, `setJobPriority`, `agents`; revert `scan` to `/api/admin/scan` if it was different.
   - `frontend_react/src/lib/types.ts`: remove `Agent`, `agents_online`, and optional `Job` fields if desired.
   - `frontend_react/src/styles/design-system.css`: remove the drawer keyframes and `.drawer-panel-*` classes.

4. Keep `AdminDashboard.tsx` unchanged; it was not deleted and can be restored as the main admin view by the steps above.
