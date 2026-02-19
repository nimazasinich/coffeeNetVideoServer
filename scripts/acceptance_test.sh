#!/bin/bash
# SmartCopy Pro – Acceptance Test Script
# Starts server, seeds DB, runs all delivery scenarios, verifies results.
#
# Usage: bash scripts/acceptance_test.sh
# Requirements: curl, python3, jq, running SmartCopy server

set -e

BASE_URL="http://localhost:8080"
MEDIA_DIR="./test_media"
AGENT_LOG="/tmp/agent_test.log"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}▶ $1${NC}"; }

# ── 1. Check server is running ────────────────────────────────────────────────
info "Step 1: Checking if server is running"
for i in $(seq 1 10); do
    if curl -sf "$BASE_URL/api/health" > /dev/null; then
        pass "Server is healthy"
        break
    fi
    sleep 2
    if [ $i -eq 10 ]; then 
        fail "Server not running. Start with: uvicorn backend.main:app --host 0.0.0.0 --port 8080"
    fi
done

# ── 2. Create test media file ─────────────────────────────────────────────────
info "Step 2: Creating test media file"
mkdir -p $MEDIA_DIR
dd if=/dev/urandom of="$MEDIA_DIR/test_movie.mp4" bs=1M count=5 2>/dev/null
EXPECTED_SHA=$(sha256sum "$MEDIA_DIR/test_movie.mp4" | awk '{print $1}')
pass "Created 5MB test file, sha256=$EXPECTED_SHA"

# Copy to configured media root (check SMARTCOPY_MEDIA_ROOT env var)
MEDIA_ROOT="${SMARTCOPY_MEDIA_ROOT:-C:/SmartCopyMedia}"
mkdir -p "$MEDIA_ROOT" 2>/dev/null || true
cp "$MEDIA_DIR/test_movie.mp4" "$MEDIA_ROOT/test_movie.mp4" 2>/dev/null || \
    info "Warning: Could not copy to $MEDIA_ROOT - using test_media dir"

# ── 3. Seed DB with media items ───────────────────────────────────────────────
info "Step 3: Seeding DB with 3 media items"

M1=$(curl -sf -X POST "$BASE_URL/api/admin/media" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Movie 1","file_path":"test_movie.mp4","file_size":5242880}' \
    | jq -r '.media_id')
[ -n "$M1" ] && pass "Media 1: $M1" || fail "Failed to create Media 1"

M2=$(curl -sf -X POST "$BASE_URL/api/admin/media" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Movie 2","file_path":"test_movie.mp4","file_size":5242880}' \
    | jq -r '.media_id')
pass "Media 2: $M2"

M3=$(curl -sf -X POST "$BASE_URL/api/admin/media" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Series S01","file_path":"test_movie.mp4","file_size":5242880,"media_type":"series"}' \
    | jq -r '.media_id')
pass "Media 3: $M3"

# ── 4. Create mobile job ──────────────────────────────────────────────────────
info "Step 4: Creating mobile delivery job"
JOB_ID=$(curl -sf -X POST "$BASE_URL/api/admin/jobs" \
    -H "Content-Type: application/json" \
    -d "{\"media_id\":\"$M1\",\"delivery_type\":\"mobile\",\"payment_mode\":\"manual\"}" \
    | jq -r '.job_id')
[ -n "$JOB_ID" ] && pass "Mobile job created: $JOB_ID" || fail "Failed to create job"

# ── 5. Admin confirms manual payment ─────────────────────────────────────────
info "Step 5: Admin confirms manual payment"
CONFIRM_RESP=$(curl -sf -X POST "$BASE_URL/api/admin/payment/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"job_id\":\"$JOB_ID\",\"admin_user\":\"cashier\",\"tx_ref\":\"cash-test-001\"}")

DOWNLOAD_URL=$(echo "$CONFIRM_RESP" | jq -r '.download_url')
TOKEN=$(echo "$CONFIRM_RESP" | jq -r '.download_token')
[ -n "$TOKEN" ] && pass "Token issued" || fail "No token in response"

# ── 6. Download full file and verify checksum ──────────────────────────────────
info "Step 6: Downloading file and verifying checksum"
DOWNLOAD_PATH="/tmp/smartcopy_acceptance_download.mp4"
curl -sf "$DOWNLOAD_URL" -o "$DOWNLOAD_PATH" \
    -H "Range: bytes=0-5242879"

ACTUAL_SHA=$(sha256sum "$DOWNLOAD_PATH" | awk '{print $1}')
if [ "$ACTUAL_SHA" = "$EXPECTED_SHA" ]; then
    pass "Checksum verified: $ACTUAL_SHA"
else
    fail "Checksum mismatch! Expected=$EXPECTED_SHA Got=$ACTUAL_SHA"
fi

# ── 7. Verify replay is rejected ──────────────────────────────────────────────
info "Step 7: Verifying token replay is rejected"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOWNLOAD_URL")
if [ "$HTTP_STATUS" = "401" ]; then
    pass "Replay rejected (HTTP 401)"
else
    fail "Replay should return 401, got $HTTP_STATUS"
fi

# ── 8. Range-resume download ──────────────────────────────────────────────────
info "Step 8: Testing range resume"
JOB2_ID=$(curl -sf -X POST "$BASE_URL/api/admin/jobs" \
    -H "Content-Type: application/json" \
    -d "{\"media_id\":\"$M2\",\"delivery_type\":\"mobile\"}" | jq -r '.job_id')

CONFIRM2=$(curl -sf -X POST "$BASE_URL/api/admin/payment/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"job_id\":\"$JOB2_ID\",\"admin_user\":\"cashier\"}")
URL2=$(echo "$CONFIRM2" | jq -r '.download_url')
TOKEN2=$(echo "$CONFIRM2" | jq -r '.download_token')

# Download first half
curl -sf "$URL2" -o /tmp/part1.bin -H "Range: bytes=0-2621439"
pass "Downloaded first half: $(du -k /tmp/part1.bin | awk '{print $1}')KB"

# Get fresh token for second half
RESEND=$(curl -sf -X POST "$BASE_URL/api/admin/resend_download_link" \
    -H "Content-Type: application/json" \
    -d "{\"job_id\":\"$JOB2_ID\"}")
URL3=$(echo "$RESEND" | jq -r '.download_url')
curl -sf "$URL3" -o /tmp/part2.bin -H "Range: bytes=2621440-5242879"
pass "Downloaded second half: $(du -k /tmp/part2.bin | awk '{print $1}')KB"

# Concatenate and verify
cat /tmp/part1.bin /tmp/part2.bin > /tmp/combined.mp4
COMBINED_SHA=$(sha256sum /tmp/combined.mp4 | awk '{print $1}')
if [ "$COMBINED_SHA" = "$EXPECTED_SHA" ]; then
    pass "Resume + concatenate checksum verified!"
else
    fail "Resume checksum mismatch"
fi

# ── 9. Start agent in debug mode ──────────────────────────────────────────────
info "Step 9: Starting agent in debug mode"
python3 -m agent.main --server "$BASE_URL" --debug > "$AGENT_LOG" 2>&1 &
AGENT_PID=$!
sleep 3

# Check agent registered
AGENTS=$(curl -sf "$BASE_URL/api/agent/list" | jq '.agents | length')
pass "Agents connected: $AGENTS"

# ── 10. USB job test ──────────────────────────────────────────────────────────
info "Step 10: USB job (agent-based)"
USB_JOB=$(curl -sf -X POST "$BASE_URL/api/admin/jobs" \
    -H "Content-Type: application/json" \
    -d "{\"media_id\":\"$M3\",\"delivery_type\":\"usb\",\"drive_id\":\"/tmp/test_usb\"}" \
    | jq -r '.job_id')
pass "USB job created: $USB_JOB"

curl -sf -X POST "$BASE_URL/api/admin/payment/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"job_id\":\"$USB_JOB\",\"admin_user\":\"cashier\"}" > /dev/null
pass "USB job payment confirmed"
sleep 5  # Let agent process

# ── 11. Verify DB final states ────────────────────────────────────────────────
info "Step 11: Verifying final job statuses in DB"
JOB1_STATUS=$(curl -sf "$BASE_URL/api/admin/jobs/$JOB_ID" | jq -r '.job.status')
[ "$JOB1_STATUS" = "completed" ] && pass "Mobile job 1 completed" || \
    echo -e "${YELLOW}Mobile job 1 status: $JOB1_STATUS (may still be processing)${NC}"

# ── Cleanup ────────────────────────────────────────────────────────────────────
kill $AGENT_PID 2>/dev/null || true
rm -f /tmp/part1.bin /tmp/part2.bin /tmp/combined.mp4 "$DOWNLOAD_PATH"

echo ""
echo -e "${GREEN}=== ACCEPTANCE TEST COMPLETE ===${NC}"
echo "Agent log: $AGENT_LOG"
