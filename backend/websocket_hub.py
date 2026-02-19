"""
SmartCopy — WebSocket Hub
Manages all active WebSocket connections and broadcasts events.
"""
import asyncio
import json
import logging
from typing import Set, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("smartcopy.websocket")


class WebSocketHub:
    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        logger.info({"event": "ws_connected", "total": len(self._connections)})

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections.discard(ws)
        logger.info({"event": "ws_disconnected", "total": len(self._connections)})

    async def broadcast(self, event: str, payload: Dict[str, Any]):
        """Send an event to all connected clients."""
        message = json.dumps({"event": event, "payload": payload})
        dead: Set[WebSocket] = set()

        async with self._lock:
            targets = set(self._connections)

        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)

        if dead:
            async with self._lock:
                self._connections -= dead

    async def send_to(self, ws: WebSocket, event: str, payload: Dict[str, Any]):
        """Send an event to a single client."""
        try:
            await ws.send_text(json.dumps({"event": event, "payload": payload}))
        except Exception:
            await self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Singleton instance
hub = WebSocketHub()
