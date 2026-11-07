from __future__ import annotations

import asyncio
import json
import sys
import urllib.request
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from solver.source_cases import all_source_cases

BASE = "http://127.0.0.1:8001"


def post_json(url: str, payload: dict) -> dict:
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)


async def wait_for_run(run_id: str) -> dict:
    seen_progress = False
    seen_frame = False
    async with websockets.connect(f"ws://127.0.0.1:8001/api/runs/{run_id}/events", max_size=8 * 1024 * 1024) as socket:
        async for raw in socket:
            event = json.loads(raw)
            seen_progress |= event.get("type") == "progress"
            seen_frame |= event.get("type") == "frame"
            if event.get("type") == "progress" and event.get("status") == "completed":
                break
    return {"seen_progress": seen_progress, "seen_frame": seen_frame}


async def main() -> None:
    rows = []
    for config in all_source_cases():
        created = post_json(f"{BASE}/api/runs", config.model_dump())
        stream = await wait_for_run(created["run_id"])
        summary = get_json(f"{BASE}/api/runs/{created['run_id']}/summary")
        with urllib.request.urlopen(f"{BASE}/api/runs/{created['run_id']}/results/rms_profile", timeout=10) as response:
            rms_csv = json.load(response)["csv"]
        assert summary["status"] == "completed"
        assert stream["seen_progress"] and stream["seen_frame"]
        assert len(rms_csv.splitlines()) == config.structure.element_count + 2
        rows.append({"name": config.name, "run_id": created["run_id"], "status": summary["status"], "progress_events": stream["seen_progress"], "animation_frames": stream["seen_frame"], "rms_rows": len(rms_csv.splitlines()) - 1, "summary": summary})
    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
