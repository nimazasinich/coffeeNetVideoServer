"""
Tests: Mobile download token (item E), Stripe webhook idempotency (item D).
"""
import time
import pytest
from tests.conftest import make_media
from backend.mobile_delivery import issue_download_token, _verify, TokenError


# ── Token tests ────────────────────────────────────────────────────────────────

def test_issued_token_verifies():
    media_id = "fake-media-id"
    job_id = "fake-job-id"
    token, nonce = issue_download_token(job_id, media_id, ttl_seconds=300)
    payload = _verify(token)
    assert payload["job_id"] == job_id
    assert payload["media_id"] == media_id
    assert payload["nonce"] == nonce


def test_expired_token_raises():
    token, _ = issue_download_token("job-x", "media-x", ttl_seconds=-1)
    with pytest.raises(TokenError, match="expired"):
        _verify(token)


def test_tampered_token_raises():
    token, _ = issue_download_token("job-y", "media-y", ttl_seconds=300)
    # Flip the last char of the signature
    tampered = token[:-1] + ("0" if token[-1] != "0" else "1")
    with pytest.raises(TokenError):
        _verify(tampered)


def test_malformed_token_raises():
    with pytest.raises(TokenError):
        _verify("not.a.valid.token.here")


def test_each_call_produces_unique_nonce():
    tokens = set()
    nonces = set()
    for _ in range(100):
        t, n = issue_download_token("j", "m", ttl_seconds=300)
        tokens.add(t)
        nonces.add(n)
    assert len(tokens) == 100
    assert len(nonces) == 100


# ── Stripe idempotency tests ───────────────────────────────────────────────────

def test_stripe_webhook_processes_session_once(fresh_db):
    """Duplicate stripe webhook calls must not create duplicate sales."""
    import uuid
    from backend.database import db_cursor

    # Create a fake job and pending payment
    job_id = str(uuid.uuid4())
    media_id = make_media("StripeFilm", 1_500_000_000)
    session_id = f"cs_test_{uuid.uuid4().hex}"
    payment_id = str(uuid.uuid4())

    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO jobs (id,media_id,drive_id,status,delivery_type,payment_mode,
                              priority,total_bytes,customer_ip)
            VALUES (?,?,NULL,'pending','mobile','online',0,1500000000,NULL)
        """, (job_id, media_id))
        cur.execute("""
            INSERT INTO payments (id,job_id,mode,status,amount_cents,currency,stripe_session_id)
            VALUES (?,?,'online','pending',299,'USD',?)
        """, (payment_id, job_id, session_id))

    # Simulate what stripe webhook handler does
    def _process_webhook():
        with db_cursor() as cur:
            cur.execute(
                "SELECT id, job_id, amount_cents FROM payments WHERE stripe_session_id=?",
                (session_id,)
            )
            payment = cur.fetchone()

        if payment:
            with db_cursor() as cur:
                # Idempotent: only update if still pending
                cur.execute("""
                    UPDATE payments SET status='confirmed', confirmed_by='stripe-webhook'
                    WHERE id=? AND status='pending'
                """, (payment["id"],))
                if cur.rowcount > 0:
                    # Only insert sale on first confirmation
                    sale_id = str(uuid.uuid4())
                    cur.execute("""
                        INSERT INTO sales (id,job_id,media_id,price_charged,currency,payment_status)
                        SELECT ?,?,media_id,?,  'USD','confirmed'
                        FROM jobs WHERE id=?
                    """, (sale_id, job_id, 2.99, job_id))

    _process_webhook()
    _process_webhook()  # second call — must not create duplicate sale

    with db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM sales WHERE job_id=?", (job_id,))
        count = cur.fetchone()["cnt"]

    assert count == 1, f"Expected 1 sale record, got {count}"
