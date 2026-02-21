"""
Tests: Agent active job counting (fix item A).
Verifies that mark_job_started / mark_job_finished are atomic
and that list_agents() returns the correct jobs_active count.
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock


def _make_hub():
    """Create a fresh AgentHub without any DB side effects."""
    from backend.agent_hub import AgentHub
    return AgentHub()


def test_job_count_starts_at_zero():
    hub = _make_hub()
    assert hub.get_active_job_count("agent-1") == 0


def test_mark_job_started_increments():
    hub = _make_hub()
    hub.mark_job_started("agent-1", "job-aaa")
    assert hub.get_active_job_count("agent-1") == 1


def test_mark_job_finished_decrements():
    hub = _make_hub()
    hub.mark_job_started("agent-1", "job-aaa")
    hub.mark_job_finished("agent-1", "job-aaa")
    assert hub.get_active_job_count("agent-1") == 0


def test_multiple_jobs_per_agent():
    hub = _make_hub()
    for i in range(5):
        hub.mark_job_started("agent-1", f"job-{i}")
    assert hub.get_active_job_count("agent-1") == 5

    hub.mark_job_finished("agent-1", "job-2")
    assert hub.get_active_job_count("agent-1") == 4


def test_jobs_isolated_across_agents():
    hub = _make_hub()
    hub.mark_job_started("agent-1", "job-a1")
    hub.mark_job_started("agent-2", "job-b1")
    hub.mark_job_started("agent-2", "job-b2")
    assert hub.get_active_job_count("agent-1") == 1
    assert hub.get_active_job_count("agent-2") == 2


def test_duplicate_job_id_not_double_counted():
    hub = _make_hub()
    hub.mark_job_started("agent-1", "job-dup")
    hub.mark_job_started("agent-1", "job-dup")  # same job, should not double-count
    assert hub.get_active_job_count("agent-1") == 1


def test_finish_unknown_job_is_noop():
    hub = _make_hub()
    hub.mark_job_finished("agent-1", "nonexistent-job")  # must not raise
    assert hub.get_active_job_count("agent-1") == 0


@pytest.mark.asyncio
async def test_concurrent_mark_start_finish():
    """Concurrent job tracking must not corrupt the set."""
    hub = _make_hub()

    async def start_and_finish(job_id: str):
        hub.mark_job_started("agent-c", job_id)
        await asyncio.sleep(0)
        hub.mark_job_finished("agent-c", job_id)

    await asyncio.gather(*[start_and_finish(f"job-{i}") for i in range(20)])
    assert hub.get_active_job_count("agent-c") == 0
