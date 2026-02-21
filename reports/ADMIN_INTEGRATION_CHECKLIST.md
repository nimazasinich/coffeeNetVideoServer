# Admin UI Integration Checklist

**Project:** SmartCopy Pro v4_fixed  
**Generated:** 2026-02-19  
**Status:** ✅ Verified

---

## Quick Start Commands

### 1. Start Backend (No Docker)
```bash
cd C:\project\videoo cofeeenet\SmartCopy_Pro_v4_fixed\SmartCopy_Pro_v4_fixed
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

### 2. Start Frontend Dev Server
```bash
cd frontend_react
npm install
npm run dev
```

### 3. Open Admin Dashboard
- **URL:** http://localhost:5173/#admin (or port shown by Vite)
- **Credentials:** admin / admin1234
- **Change password immediately** via Key icon → POST /api/admin/change-password

---

## Smoke Test Checklist

| # | Test | Endpoint/Component | Expected Result |
|---|------|-------------------|-----------------|
| 1 | Dashboard loads | GET /api/admin/dashboard | Metric cards populate (active workers, queue, revenue, etc.) |
| 2 | Chart displays | GET /api/admin/reports/daily?days=7 | Consumption chart shows data or empty state |
| 3 | Job queue loads | GET /api/admin/queue | Job list appears (or empty state) |
| 4 | WebSocket connects | WS /ws/jobs | Status shows "آنلاین" (online) in header |
| 5 | Cancel job | POST /api/admin/jobs/{id}/cancel | Confirmation modal → Toast on success |
| 6 | Set priority | POST /api/admin/jobs/{id}/priority | Toast on success |
| 7 | Confirm payment | POST /api/admin/payment/confirm | Toast on success |
| 8 | QR modal | GET /api/admin/qr | QR code and URL display |
| 9 | License modal | GET /api/admin/license | License status displays |
| 10 | Settings save | PUT /api/admin/settings | Toast on success |
| 11 | Media scan | POST /api/admin/media/scan | Toast with files_found count |
| 12 | Pricing update | PUT /api/admin/pricing | Toast on success |

---

## Rollback Plan

If issues occur after any future changes:

```bash
# Restore wiring/mismatch docs (if needed)
git checkout frontend_react/.admin-wiring-map.json
git checkout reports/admin-mismatch-report.json
git checkout frontend_react/.admin-ui-change-log.txt

# Full rollback (if component changes cause issues)
git status
git diff frontend_react/src/
git checkout frontend_react/src/  # Only if needed
```

**Note:** No component files were modified in this session. Only documentation files were added.

---

## Deliverables Summary

| File | Purpose |
|------|---------|
| `frontend_react/.admin-wiring-map.json` | Complete wiring map: components → endpoints → WebSocket events |
| `reports/admin-mismatch-report.json` | Mismatch analysis: 0 critical issues found |
| `frontend_react/.admin-ui-change-log.txt` | Full change log with component status |
| `reports/ADMIN_INTEGRATION_CHECKLIST.md` | This file — integration and test guide |

---

## Build Verification

```bash
cd frontend_react
npm run build
```

**Expected:** Build succeeds (✓ built in ~3s)  
**Verified:** 2026-02-19 — Build successful
