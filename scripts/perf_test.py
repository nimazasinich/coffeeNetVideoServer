#!/usr/bin/env python3
"""
SmartCopy Pro – Performance / Stress Test
==========================================
Simulates N concurrent mobile downloads and measures:
  - Requests/second
  - P50 / P95 / P99 latency
  - Bytes/s throughput
  - Error rate

Usage
-----
    python scripts/perf_test.py --server http://192.168.1.100:8000 \
                                  --concurrency 5 \
                                  --file-size-mb 10 \
                                  --duration 60

Requirements: pip install httpx rich
"""

import argparse
import asyncio
import hashlib
import os
import statistics
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

import httpx

try:
    from rich.console import Console
    from rich.table import Table
    console = Console()
except ImportError:
    class Console:
        def print(self, *a, **kw): print(*a)
    console = Console()


@dataclass
class Result:
    job_id: str = ""
    latency: float = 0.0
    bytes_received: int = 0
    success: bool = True
    error: str = ""


async def run_single_download(
    client: httpx.AsyncClient,
    server: str,
    media_id: str,
    file_size: int,
) -> Result:
    r = Result()
    t0 = time.monotonic()
    try:
        # Create job
        resp = await client.post(f"{server}/api/admin/jobs", json={
            "media_id": media_id,
            "delivery_type": "mobile",
            "payment_mode": "manual",
        })
        resp.raise_for_status()
        job_id = resp.json()["job_id"]
        r.job_id = job_id

        # Confirm payment → get token
        conf = await client.post(f"{server}/api/admin/payment/confirm", json={
            "job_id": job_id,
            "admin_user": "perf_test",
        })
        conf.raise_for_status()
        token = conf.json()["download_token"]

        # Download
        received = 0
        async with client.stream(
            "GET", f"{server}/api/download/{job_id}",
            params={"token": token},
        ) as stream:
            stream.raise_for_status()
            async for chunk in stream.aiter_bytes(chunk_size=65536):
                received += len(chunk)

        r.bytes_received = received
        r.success = True

    except Exception as e:
        r.success = False
        r.error = str(e)

    r.latency = time.monotonic() - t0
    return r


async def setup_media(server: str, file_size_mb: int, media_root: str) -> str:
    """Create test media file on server side and register it."""
    # Create file
    path = Path(media_root) / "perf_test.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    data = os.urandom(file_size_mb * 1024 * 1024)
    path.write_bytes(data)

    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{server}/api/admin/media", json={
            "title": "PerfTest",
            "file_path": "perf_test.bin",
            "file_size": len(data),
            "checksum_sha256": hashlib.sha256(data).hexdigest(),
        })
        resp.raise_for_status()
        return resp.json()["media_id"]


async def run_stress(server: str, concurrency: int, duration: int,
                     file_size_mb: int, media_root: str):
    console.print(f"\n[bold cyan]SmartCopy Pro – Stress Test[/bold cyan]")
    console.print(f"Server: {server} | Concurrency: {concurrency} | Duration: {duration}s | File: {file_size_mb}MB\n")

    media_id = await setup_media(server, file_size_mb, media_root)
    console.print(f"Media created: {media_id}")

    results: List[Result] = []
    semaphore = asyncio.Semaphore(concurrency)
    stop_at = time.monotonic() + duration

    async def worker():
        async with httpx.AsyncClient(timeout=120) as client:
            while time.monotonic() < stop_at:
                async with semaphore:
                    r = await run_single_download(client, server, media_id, file_size_mb * 1024 * 1024)
                    results.append(r)
                    status = "[green]OK[/green]" if r.success else f"[red]FAIL: {r.error[:40]}[/red]"
                    console.print(f"  {r.job_id[:8]}… {r.latency:.2f}s {r.bytes_received//1024}KB {status}")

    tasks = [asyncio.create_task(worker()) for _ in range(concurrency)]
    await asyncio.gather(*tasks)

    # ── Report ────────────────────────────────────────────────────────────────
    successes = [r for r in results if r.success]
    failures = [r for r in results if not r.success]
    latencies = [r.latency for r in successes]
    total_bytes = sum(r.bytes_received for r in successes)

    table = Table(title="Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total requests", str(len(results)))
    table.add_row("Successful", str(len(successes)))
    table.add_row("Failed", str(len(failures)))
    table.add_row("Error rate", f"{len(failures)/len(results)*100:.1f}%")

    if latencies:
        latencies.sort()
        table.add_row("P50 latency", f"{statistics.median(latencies):.2f}s")
        table.add_row("P95 latency", f"{latencies[int(len(latencies)*0.95)]:.2f}s")
        table.add_row("P99 latency", f"{latencies[int(len(latencies)*0.99)]:.2f}s")
        table.add_row("Max latency", f"{max(latencies):.2f}s")
        table.add_row("Avg throughput", f"{total_bytes / duration / 1024:.0f} KB/s")
        table.add_row("Req/s", f"{len(successes)/duration:.1f}")

    console.print(table)

    if failures:
        console.print("\n[red]Failures:[/red]")
        for r in failures[:5]:
            console.print(f"  {r.job_id}: {r.error}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default="http://localhost:8000")
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--file-size-mb", type=int, default=5)
    parser.add_argument("--media-root", default="./media")
    args = parser.parse_args()

    asyncio.run(run_stress(
        server=args.server,
        concurrency=args.concurrency,
        duration=args.duration,
        file_size_mb=args.file_size_mb,
        media_root=args.media_root,
    ))


if __name__ == "__main__":
    main()
