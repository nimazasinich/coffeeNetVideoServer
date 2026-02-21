"""
Tests: Agent reconnect stability (item I).
Simulates repeated disconnect/reconnect cycles.
"""
import asyncio
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _make_mock_ws(agent_id="agent-test"):
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.close = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_stale_agent_replaced_on_reconnect(fresh_db):
    """When an agent reconnects, the old connection is replaced without error."""
    with patch("backend.agent_hub.AgentHub._db_set_online"), \
         patch("backend.queue_engine.queue_engine.on_agent_disconnect", new_callable=AsyncMock):
        from backend.agent_hub import AgentHub
        hub = AgentHub()

        ws1 = _make_mock_ws()
        ws2 = _make_mock_ws()

        # First connection
        conn1 = await hub.connect("agent-A", ws1)
        assert "agent-A" in hub._agents

        # Reconnect with new ws (simulates dropped + reconnect)
        conn2 = await hub.connect("agent-A", ws2)
        assert hub._agents["agent-A"] is conn2
        assert hub._agents["agent-A"].ws is ws2


@pytest.mark.asyncio
async def test_disconnect_cleans_all_state(fresh_db):
    """Disconnect removes agent from both _agents and _agent_active_jobs."""
    with patch("backend.agent_hub.AgentHub._db_set_online"), \
         patch("backend.queue_engine.queue_engine.on_agent_disconnect", new_callable=AsyncMock):
        from backend.agent_hub import AgentHub
        hub = AgentHub()

        ws = _make_mock_ws()
        await hub.connect("agent-B", ws)
        hub.mark_job_started("agent-B", "job-xyz")

        await hub.disconnect("agent-B")

        assert "agent-B" not in hub._agents
        assert hub.get_active_job_count("agent-B") == 0


@pytest.mark.asyncio
async def test_five_reconnect_cycles_stable(fresh_db):
    """Simulate 5 disconnect/reconnect cycles without state leaks."""
    with patch("backend.agent_hub.AgentHub._db_set_online"), \
         patch("backend.queue_engine.queue_engine.on_agent_disconnect", new_callable=AsyncMock):
        from backend.agent_hub import AgentHub
        hub = AgentHub()

        for cycle in range(5):
            ws = _make_mock_ws()
            conn = await hub.connect("agent-cycle", ws)
            hub.mark_job_started("agent-cycle", f"job-{cycle}")
            await hub.disconnect("agent-cycle")

        # After all cycles, no state should remain
        assert "agent-cycle" not in hub._agents
        assert hub.get_active_job_count("agent-cycle") == 0


@pytest.mark.asyncio
async def test_stale_agent_detection(fresh_db):
    """Agents that haven't pinged recently should be detected."""
    with patch("backend.agent_hub.AgentHub._db_set_online"):
        from backend.agent_hub import AgentHub, STALE_AGENT_TTL, AgentConnection
        hub = AgentHub()

        # Manually add a stale connection
        stale = AgentConnection(agent_id="stale-agent", ws=_make_mock_ws())
        stale.last_seen = time.time() - (STALE_AGENT_TTL + 60)
        hub._agents["stale-agent"] = stale

        # Add a fresh connection
        fresh_conn = AgentConnection(agent_id="fresh-agent", ws=_make_mock_ws())
        fresh_conn.last_seen = time.time()
        hub._agents["fresh-agent"] = fresh_conn

        stale_ids = hub.get_stale_agents()
        assert "stale-agent" in stale_ids
        assert "fresh-agent" not in stale_ids
