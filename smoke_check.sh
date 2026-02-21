#!/usr/bin/env bash
# SmartCopy Pro — Smoke Check Script
# Non-assertive: exercises endpoints and prints responses.
# Does NOT assert anything — just shows server is responding.
#
# Usage: bash smoke_check.sh [BASE_URL] [ADMIN_USER] [ADMIN_PASS]
#   bash smoke_check.sh https://localhost:8000 admin admin123
#
# Requires: curl, python3

BASE="${1:-https://localhost:8000}"
ADMIN_USER="${2:-admin}"
ADMIN_PASS="${3:-admin123}"
CURL="curl -sk"   # -s silent, -k ignore self-signed TLS

echo "======================================================="
echo " SmartCopy Pro — Smoke Check"
echo " Target: $BASE"
echo "======================================================="
echo ""

# ── 1. Health ──────────────────────────────────────────────
echo "[1/8] GET /api/health"
$CURL "$BASE/api/health" | python3 -m json.tool 2>/dev/null || echo "(raw) $($CURL $BASE/api/health)"
echo ""

# ── 2. Admin login ─────────────────────────────────────────
echo "[2/8] POST /api/admin/login"
LOGIN_RESP=$($CURL -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "(raw) $LOGIN_RESP"
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "  ⚠ Could not extract token — admin endpoints will be skipped"
fi
echo ""

# ── 3. Media list ──────────────────────────────────────────
echo "[3/8] GET /api/media"
$CURL "$BASE/api/media" | python3 -m json.tool 2>/dev/null | head -30
echo ""

# ── 4. Drives list ─────────────────────────────────────────
echo "[4/8] GET /api/drives"
$CURL "$BASE/api/drives" | python3 -m json.tool 2>/dev/null | head -20
echo ""

# ── 5. Pricing ─────────────────────────────────────────────
echo "[5/8] GET /api/pricing"
$CURL "$BASE/api/pricing" | python3 -m json.tool 2>/dev/null
echo ""

# ── 6. Dashboard overview (admin) ──────────────────────────
if [ -n "$TOKEN" ]; then
  echo "[6/8] GET /api/dashboard/overview (admin)"
  $CURL -H "Authorization: Bearer $TOKEN" "$BASE/api/dashboard/overview" \
    | python3 -m json.tool 2>/dev/null | head -40
else
  echo "[6/8] SKIPPED — no token"
fi
echo ""

# ── 7. Admin jobs ──────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  echo "[7/8] GET /api/admin/jobs"
  $CURL -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/jobs" \
    | python3 -m json.tool 2>/dev/null | head -20
else
  echo "[7/8] SKIPPED — no token"
fi
echo ""

# ── 8. Posters list ────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  echo "[8/8] GET /api/assets/posters"
  $CURL -H "Authorization: Bearer $TOKEN" "$BASE/api/assets/posters" \
    | python3 -m json.tool 2>/dev/null | head -20
else
  echo "[8/8] SKIPPED — no token"
fi
echo ""

echo "======================================================="
echo " Smoke check complete. Review output above."
echo " No assertions were made — this is not a test suite."
echo "======================================================="
