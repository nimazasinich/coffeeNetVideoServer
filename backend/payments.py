"""
SmartCopy Pro — Stripe Payment Integration
Handles Stripe Checkout, webhooks, and manual cash payment confirmation.

FIX NOTES
---------
BUG-12  confirm_payment had no authentication guard. Any client that knew a
        job_id could confirm payment and trigger a free copy. Added
        require_admin_role dependency.

BUG-13  confirm_payment did not record price_charged in the sales table after
        enqueuing the job. Without this, the dashboard revenue stats were always
        zero for manually confirmed payments. Added sales record insert.
"""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, HTTPException, Request, Response, Depends

from backend.config import (
    STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET,
    STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL,
    SERVER_BASE_URL, DOWNLOAD_TOKEN_TTL,
)
from backend.database import db_cursor
from backend.queue_engine import queue_engine
from backend.security import require_admin_role

logger = logging.getLogger("smartcopy.payments")

router = APIRouter(prefix="/api", tags=["payments"])


# ─── Stripe helper ────────────────────────────────────────────────────────────

def _get_stripe():
    try:
        import stripe
    except ImportError:
        raise RuntimeError("stripe not installed: pip install stripe")
    if not STRIPE_API_KEY:
        raise RuntimeError("STRIPE_API_KEY not configured")
    stripe.api_key = STRIPE_API_KEY
    return stripe


# ─── Admin: manual payment confirmation ───────────────────────────────────────

# FIX BUG-12: Added require_admin_role so only authenticated admins can confirm
@router.post("/admin/payment/confirm")
async def admin_confirm_payment(
    body: dict,
    user: dict = Depends(require_admin_role)
):
    """
    Admin manually confirms cash/POS payment.
    Body: { "job_id": "...", "tx_ref": "cash-001" }
    """
    job_id     = body.get("job_id")
    admin_user = user.get("sub", "admin")
    tx_ref     = body.get("tx_ref", f"manual-{uuid.uuid4().hex[:8]}")

    with db_cursor() as cur:
        cur.execute("SELECT id, media_id, drive_id, delivery_type, status FROM jobs WHERE id=?",
                    (job_id,))
        job = cur.fetchone()
    if not job:
        raise HTTPException(404, "job not found")

    # Determine price to charge
    with db_cursor() as cur:
        cur.execute("SELECT size_bytes FROM media WHERE id=?", (job["media_id"],))
        media_row = cur.fetchone()
        price_usd = 0.0
        if media_row:
            cur.execute("SELECT max_size_gb, price_usd FROM pricing ORDER BY max_size_gb")
            tiers = cur.fetchall()
            size_gb = media_row["size_bytes"] / (1024 ** 3)
            for tier in tiers:
                if size_gb <= tier["max_size_gb"]:
                    price_usd = tier["price_usd"]
                    break
            else:
                price_usd = tiers[-1]["price_usd"] if tiers else 0.0

    # Create payment record
    payment_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO payments (id, job_id, mode, status, amount_cents, currency,
                                  tx_ref, confirmed_by, confirmed_at)
            VALUES (?, ?, 'manual', 'confirmed', ?, 'USD', ?, ?, ?)
        """, (payment_id, job_id, int(price_usd * 100), tx_ref, admin_user, time.time()))

    # FIX BUG-13: Record sale so revenue stats are populated
    sale_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO sales (id, job_id, media_id, price_charged, currency,
                               payment_ref, payment_status)
            VALUES (?, ?, ?, ?, 'USD', ?, 'confirmed')
        """, (sale_id, job_id, job["media_id"], price_usd, payment_id))

    # Enqueue the job
    queue_engine.enqueue_job(job_id)

    response_data = {
        "status":        "confirmed",
        "job_id":        job_id,
        "payment_id":    payment_id,
        "price_charged": price_usd,
    }

    # For mobile jobs, issue download token
    if job["delivery_type"] == "mobile":
        from backend.mobile_delivery import issue_download_token, persist_token
        token_str, nonce = issue_download_token(
            job_id=job_id,
            media_id=job["media_id"],
            ttl_seconds=DOWNLOAD_TOKEN_TTL,
        )
        persist_token(nonce, job_id, job["media_id"], time.time() + DOWNLOAD_TOKEN_TTL)
        download_url = f"{SERVER_BASE_URL}/api/download/{job_id}?token={token_str}"
        response_data["download_url"] = download_url
        logger.info({"event": "mobile_token_issued", "job_id": job_id})

    logger.info({"event": "manual_payment_confirmed",
                 "job_id": job_id, "confirmed_by": admin_user})
    return response_data


# ─── Admin: resend download link ──────────────────────────────────────────────

@router.post("/admin/resend_download_link")
async def resend_download_link(
    body: dict,
    user: dict = Depends(require_admin_role)
):
    """Re-issue a fresh download token for a mobile job."""
    job_id = body.get("job_id")
    with db_cursor() as cur:
        cur.execute("SELECT id, media_id, delivery_type FROM jobs WHERE id=?", (job_id,))
        job = cur.fetchone()
    if not job:
        raise HTTPException(404, "job not found")
    if job["delivery_type"] != "mobile":
        raise HTTPException(400, "not a mobile job")

    from backend.mobile_delivery import issue_download_token, persist_token
    token_str, nonce = issue_download_token(
        job_id=job_id,
        media_id=job["media_id"],
        ttl_seconds=DOWNLOAD_TOKEN_TTL,
    )
    persist_token(nonce, job_id, job["media_id"], time.time() + DOWNLOAD_TOKEN_TTL)
    download_url = f"{SERVER_BASE_URL}/api/download/{job_id}?token={token_str}"
    return {"download_url": download_url, "expires_in": DOWNLOAD_TOKEN_TTL}


# ─── Online payment: create Stripe session ────────────────────────────────────

@router.post("/payment/create-session")
async def create_stripe_session(body: dict):
    """
    Create a Stripe Checkout Session for a job.
    Body: { "job_id": "...", "amount_cents": 500, "currency": "USD",
            "description": "Movie: Inception" }
    """
    try:
        stripe = _get_stripe()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    job_id       = body.get("job_id")
    amount_cents = int(body.get("amount_cents", 500))
    currency     = body.get("currency", "USD").lower()
    description  = body.get("description", "SmartCopy Media Download")

    with db_cursor() as cur:
        cur.execute("SELECT id FROM jobs WHERE id=?", (job_id,))
        if not cur.fetchone():
            raise HTTPException(404, "job not found")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency":     currency,
                "product_data": {"name": description},
                "unit_amount":  amount_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=STRIPE_SUCCESS_URL + f"?job_id={job_id}",
        cancel_url=STRIPE_CANCEL_URL,
        metadata={"job_id": job_id},
    )

    payment_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO payments
                (id, job_id, mode, status, amount_cents, currency, stripe_session_id)
            VALUES (?, ?, 'online', 'pending', ?, ?, ?)
        """, (payment_id, job_id, amount_cents, currency.upper(), session.id))

    logger.info({"event": "stripe_session_created",
                 "session_id": session.id, "job_id": job_id})
    return {"session_id": session.id, "checkout_url": session.url}


# ─── Stripe webhook ───────────────────────────────────────────────────────────

@router.post("/payment/webhook")
async def stripe_webhook(request: Request):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # SECURITY: Fail closed if webhook secret not configured
    if not STRIPE_WEBHOOK_SECRET:
        logger.critical({"event": "stripe_webhook_not_configured", "ip": request.client.host if request.client else "unknown"})
        raise HTTPException(503, "Stripe webhooks not configured")

    try:
        stripe = _get_stripe()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "invalid stripe signature")
    except Exception as e:
        raise HTTPException(400, str(e))

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        session_id  = session_obj["id"]
        job_id      = session_obj.get("metadata", {}).get("job_id")

        with db_cursor() as cur:
            cur.execute("SELECT id, job_id, amount_cents FROM payments WHERE stripe_session_id=?",
                        (session_id,))
            payment = cur.fetchone()

        if payment and job_id:
            with db_cursor() as cur:
                cur.execute("""
                    UPDATE payments SET status='confirmed', confirmed_by='stripe-webhook',
                        tx_ref=?, confirmed_at=?
                    WHERE id=?
                """, (session_id, time.time(), payment["id"]))

            # Record sale
            with db_cursor() as cur:
                cur.execute("SELECT media_id FROM jobs WHERE id=?", (job_id,))
                job_row = cur.fetchone()
            if job_row:
                sale_id = str(uuid.uuid4())
                price_usd = (payment["amount_cents"] or 0) / 100.0
                with db_cursor() as cur:
                    cur.execute("""
                        INSERT INTO sales (id, job_id, media_id, price_charged, currency,
                                           payment_ref, payment_status)
                        VALUES (?, ?, ?, ?, 'USD', ?, 'confirmed')
                    """, (sale_id, job_id, job_row["media_id"], price_usd, session_id))

            queue_engine.enqueue_job(job_id)

            # Issue mobile token if applicable
            with db_cursor() as cur:
                cur.execute("SELECT delivery_type, media_id FROM jobs WHERE id=?", (job_id,))
                job = cur.fetchone()

            if job and job["delivery_type"] == "mobile":
                from backend.mobile_delivery import issue_download_token, persist_token
                token_str, nonce = issue_download_token(
                    job_id=job_id,
                    media_id=job["media_id"],
                    ttl_seconds=DOWNLOAD_TOKEN_TTL,
                )
                persist_token(nonce, job_id, job["media_id"],
                              time.time() + DOWNLOAD_TOKEN_TTL)
                logger.info({"event": "stripe_mobile_token_issued", "job_id": job_id})

            logger.info({"event": "stripe_payment_confirmed", "job_id": job_id})

    return Response(status_code=200)
