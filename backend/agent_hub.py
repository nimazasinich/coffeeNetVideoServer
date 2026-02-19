"""
SmartCopy Pro — Agent WebSocket Hub
Manages persistent WebSocket connections from Windows USB-delivery agents.

Protocol (JSON messages)
------------------------
Server → Agent:
  {"action": "run_job", "job_id": "...", "media_id": "...", "drive_id": "..."}
  {"action": "cancel_job", "job_id": "..."}
  {"action": "ping"}

Agent → Server:
  {"action": "register", "agent_id": "...", "hostname": "...", "version": "...",
   "drives": ["D:", "E:"]}
  {"action": "progress", "job_id": "...", "bytes_written": 1234, "total_bytes": 9999}
  {"action": "complete", "job_id": "...", "drive_id": "...", "checksum": "...", "success": true}
  {"action": "error",    "job_id": "...", "drive_id": "...", "message": "..."}
  {"action": "pong"}
  {"action": "drive_inserted", "drive_id": "D:", "label": "MyUSB", "free_bytes": 9999}
  {"action": "drive_removed",  "drive_id": "D:"}
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
import hmac
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from backend.database import db_cursor
from backend.config import SECRET_KEY

logger = logging.getLogger("smartcopy.agent_hub")

router       = APIRouter(prefix="/ws",       tags=["agent-ws"])
agent_router = APIRouter(prefix="/api/agent", tags=["agent"])

PING_INTERVAL = 30  # seconds


@dataclass
class AgentConnection:
    agent_id:      str
    ws:            WebSocket
    hostname:      str = ""
    version:       str = ""
    drives:        Set[str] = field(default_factory=set)
    connected_at:  float = field(default_factory=time.time)
    last_seen:     float = field(default_factory=time.time)
    active_job_id: Optional[str] = None
    status:        str = "pending"
    is_master:     bool = False


class AgentHub:
    """Tracks all connected agents and routes messages."""

    def __init__(self):
        self._agents: Dict[str, AgentConnection] = {}
        self._lock = asyncio.Lock()

    # ── Connection management ─────────────────────────────────────────────────

    async def connect(self, agent_id: str, ws: WebSocket) -> AgentConnection:
        await ws.accept()
        
        # Load status from DB
        status = "pending"
        with db_cursor() as cur:
            cur.execute("SELECT status FROM agents WHERE agent_id=?", (agent_id,))
            row = cur.fetchone()
            if row: status = row["status"]

        conn = AgentConnection(agent_id=agent_id, ws=ws, status=status)
        async with self._lock:
            self._agents[agent_id] = conn
        self._db_set_online(agent_id, online=True)
        logger.info({"event": "agent_connected", "agent_id": agent_id, "status": status})
        return conn

    async def disconnect(self, agent_id: str):
        async with self._lock:
            self._agents.pop(agent_id, None)
        self._db_set_online(agent_id, online=False)
        logger.info({"event": "agent_disconnected", "agent_id": agent_id})
        from backend.queue_engine import queue_engine
        await queue_engine.on_agent_disconnect(agent_id)

    async def send_job(self, agent_id: str, payload: dict):
        conn = self._agents.get(agent_id)
        if conn is None:
            raise RuntimeError(f"Agent {agent_id} not connected")
        if conn.status != "approved":
            raise RuntimeError(f"Agent {agent_id} is not authorized. Please approve it in the admin panel.")
        await conn.ws.send_json(payload)

    # ── Query helpers ─────────────────────────────────────────────────────────

    def find_agent_for_drive(self, drive_id: str) -> Optional[dict]:
        for conn in self._agents.values():
            if drive_id in conn.drives:
                return {
                    "agent_id": conn.agent_id,
                    "hostname":  conn.hostname,
                    "version":   conn.version,
                }
        return None

    def list_agents(self) -> List[dict]:
        return [
            {
                "agent_id":    a.agent_id,
                "hostname":    a.hostname,
                "version":     a.version,
                "drives":      list(a.drives),
                "connected_at": a.connected_at,
                "last_seen":   a.last_seen,
                "active_job":  a.active_job_id,
                "online":      True,
            }
            for a in self._agents.values()
        ]

    def get_all_agent_drives(self) -> List[dict]:
        """Combine all drives from all approved agents."""
        result = []
        for conn in self._agents.values():
            if conn.status != "approved":
                continue
            for drive_id in conn.drives:
                result.append({
                    "id":       f"{conn.agent_id}:{drive_id}", # Unique ID
                    "path":     drive_id,
                    "label":    f"{conn.hostname} ({drive_id})",
                    "agent_id": conn.agent_id,
                    "is_agent": True,
                    "free_bytes": 0, # Agent will report this later if needed
                })
        return result

    # ── DB helpers (sync) ─────────────────────────────────────────────────────

    def _db_set_online(self, agent_id: str, online: bool):
        try:
            with db_cursor() as cur:
                cur.execute(
                    "UPDATE agents SET online=?, last_seen=? WHERE agent_id=?",
                    (int(online), time.time(), agent_id)
                )
        except Exception as e:
            logger.error({"event": "db_agent_status_error", "error": str(e)})

    def _db_upsert_agent(self, agent_id: str, hostname: str, version: str, drives: list):
        import json as _json
        try:
            with db_cursor() as cur:
                cur.execute("""
                    INSERT INTO agents (id, agent_id, hostname, version, drives, online, last_seen, status)
                    VALUES (?, ?, ?, ?, ?, 1, ?, 'pending')
                    ON CONFLICT(agent_id) DO UPDATE SET
                        hostname  = excluded.hostname,
                        version   = excluded.version,
                        drives    = excluded.drives,
                        online    = 1,
                        last_seen = excluded.last_seen
                """, (str(uuid.uuid4()), agent_id, hostname, version,
                      _json.dumps(drives), time.time()))
        except Exception as e:
            logger.error({"event": "db_upsert_agent_error", "error": str(e)})

    def _db_update_job_progress(self, job_id: str, bytes_written: int, total_bytes: int):
        try:
            with db_cursor() as cur:
                progress = round(bytes_written / total_bytes * 100, 2) if total_bytes else 0
                cur.execute(
                    "UPDATE jobs SET progress=?, bytes_written=?, total_bytes=? WHERE id=?",
                    (progress, bytes_written, total_bytes, job_id)
                )
        except Exception as e:
            logger.error({"event": "db_progress_error", "error": str(e)})

    # ── Message handling ──────────────────────────────────────────────────────

    async def _handle_message(self, conn: AgentConnection, msg: dict):
        action = msg.get("action")
        conn.last_seen = time.time()

        if action == "register":
            conn.hostname = msg.get("hostname", "")
            conn.version  = msg.get("version", "")
            conn.drives   = set(msg.get("drives", []))
            self._db_upsert_agent(
                conn.agent_id, conn.hostname, conn.version, list(conn.drives)
            )
            
            # Re-check status from DB (might have been updated by admin)
            with db_cursor() as cur:
                cur.execute("SELECT status FROM agents WHERE agent_id=?", (conn.agent_id,))
                row = cur.fetchone()
                if row: conn.status = row["status"]

            logger.info({"event": "agent_registered",
                         "agent_id": conn.agent_id,
                         "status":   conn.status,
                         "drives":   list(conn.drives)})

        elif action == "progress":
            job_id       = msg["job_id"]
            bytes_written = msg.get("bytes_written", 0)
            total_bytes   = msg.get("total_bytes", 0)
            conn.active_job_id = job_id
            self._db_update_job_progress(job_id, bytes_written, total_bytes)
            from backend.websocket_hub import hub as ws_hub
            await ws_hub.broadcast("job.progress", {
                "job_id":        job_id,
                "bytes_written": bytes_written,
                "total_bytes":   total_bytes,
                "progress": round(bytes_written / total_bytes * 100, 2) if total_bytes else 0,
            })

        elif action == "complete":
            job_id   = msg["job_id"]
            drive_id = msg.get("drive_id", "")
            success  = bool(msg.get("success", False))
            error    = msg.get("message", "")
            conn.active_job_id = None
            from backend.queue_engine import queue_engine
            await queue_engine.complete_usb_job(job_id, drive_id, success, error)

        elif action == "error":
            job_id   = msg["job_id"]
            drive_id = msg.get("drive_id", "")
            error    = msg.get("message", "unknown error")
            conn.active_job_id = None
            from backend.queue_engine import queue_engine
            await queue_engine.complete_usb_job(job_id, drive_id, False, error)

        elif action == "drive_inserted":
            conn.drives.add(msg["drive_id"])
            logger.info({"event": "agent_drive_inserted",
                         "agent_id": conn.agent_id, "drive_id": msg["drive_id"]})

        elif action == "drive_removed":
            conn.drives.discard(msg["drive_id"])
            logger.info({"event": "agent_drive_removed",
                         "agent_id": conn.agent_id, "drive_id": msg["drive_id"]})

        elif action == "pong":
            pass

        else:
            logger.warning({"event": "unknown_agent_action",
                            "agent_id": conn.agent_id, "action": action})


# Singleton
hub = AgentHub()


# ─── REST: Agent registration ─────────────────────────────────────────────────

@agent_router.post("/register")
async def register_agent(body: dict):
    """Called by agent on startup. Returns a short-lived WS token."""
    agent_id = body.get("agent_id") or uuid.uuid4().hex
    hostname  = body.get("hostname", "unknown")[:255]
    version   = body.get("version", "0.0.0")[:32]

    # Upsert into DB
    import json as _json
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO agents (id, agent_id, hostname, version, drives, online, last_seen, status)
            VALUES (?, ?, ?, ?, ?, 0, ?, 'pending')
            ON CONFLICT(agent_id) DO UPDATE SET
                hostname  = excluded.hostname,
                version   = excluded.version,
                last_seen = excluded.last_seen
        """, (str(uuid.uuid4()), agent_id, hostname, version, "[]", time.time()))

    # Issue HMAC WS token
    ts      = int(time.time())
    payload = f"{agent_id}:{ts}"
    sig     = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    ws_token = f"{payload}:{sig}"

    from backend.config import SERVER_WS_URL
    return {
        "agent_id": agent_id,
        "ws_token": ws_token,
        "ws_url":   f"{SERVER_WS_URL}/ws/agent/{agent_id}",
    }


@agent_router.get("/list")
async def list_agents():
    from backend.agent_hub import hub as agent_hub
    online_map = {a["agent_id"]: a for a in agent_hub.list_agents()}
    
    with db_cursor() as cur:
        cur.execute("SELECT * FROM agents ORDER BY registered_at DESC")
        db_agents = [dict(r) for r in cur.fetchall()]
        
    for a in db_agents:
        a["online"] = a["agent_id"] in online_map
        if a["agent_id"] in online_map:
            a["active_job"] = online_map[a["agent_id"]].get("active_job")
            
    return {"agents": db_agents}

@agent_router.post("/approve")
async def approve_agents(body: dict):
    agent_ids = body.get("agent_ids", [])
    status = body.get("status", "approved")
    if not agent_ids: return {"status": "ok", "updated": 0}
    
    placeholders = ",".join(["?"] * len(agent_ids))
    with db_cursor() as cur:
        cur.execute(f"UPDATE agents SET status=? WHERE agent_id IN ({placeholders})", [status] + agent_ids)
        count = cur.rowcount
    
    # Update running connections
    from backend.agent_hub import hub as agent_hub
    async with agent_hub._lock:
        for aid in agent_ids:
            if aid in agent_hub._agents:
                agent_hub._agents[aid].status = status
                
    return {"status": "ok", "updated": count}

@agent_router.post("/set-master")
async def set_master_agent(body: dict):
    agent_id = body.get("agent_id")
    with db_cursor() as cur:
        cur.execute("UPDATE agents SET is_master_agent=0")
        if agent_id:
            cur.execute("UPDATE agents SET is_master_agent=1 WHERE agent_id=?", (agent_id,))
    return {"status": "ok"}


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/agent/{agent_id}")
async def agent_ws(agent_id: str, ws: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for agent connections with token validation."""
    # SECURITY: Validate token expiry
    try:
        parts = token.split(":")
        if len(parts) != 3:
            await ws.close(code=1008, reason="Invalid token format")
            return
        
        token_agent_id, ts, sig = parts
        
        # Verify agent_id matches
        if token_agent_id != agent_id:
            await ws.close(code=1008, reason="Token agent_id mismatch")
            return
        
        # Check expiry (1 hour)
        if int(time.time()) - int(ts) > 3600:
            await ws.close(code=1008, reason="Token expired")
            return
        
        # Verify HMAC signature
        expected_payload = f"{token_agent_id}:{ts}"
        expected_sig = hmac.new(SECRET_KEY.encode(), expected_payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, sig):
            await ws.close(code=1008, reason="Invalid signature")
            return
            
    except Exception as e:
        logger.error({"event": "agent_token_validation_failed", "error": str(e)})
        await ws.close(code=1008, reason="Token validation failed")
        return
    
    conn = await hub.connect(agent_id, ws)

    async def _ping():
        while True:
            await asyncio.sleep(PING_INTERVAL)
            try:
                await ws.send_json({"action": "ping"})
            except Exception:
                break

    ping_task = asyncio.create_task(_ping())
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await hub._handle_message(conn, msg)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error({"event": "agent_ws_error", "agent_id": agent_id, "error": str(e)})
    finally:
        ping_task.cancel()
        await hub.disconnect(agent_id)
