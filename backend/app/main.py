from __future__ import annotations

import asyncio
import json
import multiprocessing as mp
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from solver.models import CaseConfig, DEFAULT_CASE
from solver.runner import run_case


ROOT = Path(__file__).resolve().parents[2]
PROJECTS = Path(os.environ.get("SIREN_DATA_DIR", ROOT / "projects")).expanduser()
PROJECTS.mkdir(exist_ok=True)
PROCESSES: dict[str, mp.Process] = {}

app = FastAPI(title="SIREN API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_case_payload() -> dict:
    return DEFAULT_CASE.model_dump()


def run_worker(config_dict: dict, run_dir_str: str) -> None:
    config = CaseConfig.model_validate(config_dict)
    run_case(config, Path(run_dir_str))


def ensure_case(case_id: str) -> Path:
    case_dir = PROJECTS / "default" / "cases" / case_id
    if not case_dir.exists():
        raise HTTPException(404, "case not found")
    return case_dir


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "riser-predict", "time": now()}


@app.get("/api/projects")
def list_projects() -> list[dict]:
    return [{"project_id": "default", "name": "本地立管项目", "path": str(PROJECTS / "default")}]


@app.post("/api/projects")
def create_project(payload: dict | None = None) -> dict:
    project_id = uuid.uuid4().hex[:8]
    project_dir = PROJECTS / project_id / "cases"
    project_dir.mkdir(parents=True)
    return {"project_id": project_id, "name": (payload or {}).get("name", project_id), "created_at": now()}


@app.post("/api/cases")
def create_case(config: CaseConfig = DEFAULT_CASE) -> dict:
    case_id = uuid.uuid4().hex[:8]
    case_dir = PROJECTS / "default" / "cases" / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    (case_dir / "input.json").write_text(config.model_dump_json(indent=2), encoding="utf-8")
    return {"case_id": case_id, "config": config.model_dump()}


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict:
    case_dir = ensure_case(case_id)
    return json.loads((case_dir / "input.json").read_text(encoding="utf-8"))


@app.post("/api/cases/{case_id}/validate")
def validate_case(config: CaseConfig, case_id: str) -> dict:
    ensure_case(case_id)
    return {"valid": True, "errors": [], "warnings": ["当前为 GUI 优先研究原型，计算结果不作为工程设计结论。"]}


@app.post("/api/runs")
def create_run(config: CaseConfig) -> dict:
    case_id = uuid.uuid4().hex[:8]
    case_dir = PROJECTS / "default" / "cases" / case_id
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    run_dir = case_dir / "runs" / run_id
    (run_dir / "exports").mkdir(parents=True)
    (run_dir / "logs").mkdir(exist_ok=True)
    (run_dir / "input.json").write_text(config.model_dump_json(indent=2), encoding="utf-8")
    process = mp.Process(target=run_worker, args=(config.model_dump(), str(run_dir)), daemon=True)
    process.start()
    PROCESSES[run_id] = process
    return {"run_id": run_id, "case_id": case_id, "status": "queued", "created_at": now()}


def find_run(run_id: str) -> Path:
    matches = list(PROJECTS.glob(f"*/cases/*/runs/{run_id}"))
    if not matches:
        raise HTTPException(404, "run not found")
    return matches[0]


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict:
    run_dir = find_run(run_id)
    progress_file = run_dir / "progress.json"
    progress = json.loads(progress_file.read_text(encoding="utf-8")) if progress_file.exists() else {"status": "queued", "progress": 0}
    return {"run_id": run_id, **progress}


@app.get("/api/runs/{run_id}/summary")
def get_summary(run_id: str) -> dict:
    run_dir = find_run(run_id)
    summary = run_dir / "summary.json"
    if not summary.exists():
        raise HTTPException(409, "results not ready")
    return json.loads(summary.read_text(encoding="utf-8"))


@app.get("/api/runs/{run_id}/results/{result_type}")
def get_result(run_id: str, result_type: str) -> dict:
    run_dir = find_run(run_id)
    if result_type == "summary":
        return get_summary(run_id)
    if result_type not in {"time_history", "rms_profile", "fft"}:
        raise HTTPException(404, "unsupported result type")
    file_name = {"time_history": "time_history.csv", "rms_profile": "rms_profile.csv", "fft": "fft.csv"}[result_type]
    result_file = run_dir / "exports" / file_name
    if not result_file.exists():
        raise HTTPException(409, "results not ready")
    return {"result_type": result_type, "csv": result_file.read_text(encoding="utf-8")}


@app.get("/api/runs/{run_id}/files/{file_name}")
def get_file(run_id: str, file_name: str):
    run_dir = find_run(run_id)
    target = (run_dir / "exports" / file_name).resolve()
    if target.parent != (run_dir / "exports").resolve() or not target.exists():
        raise HTTPException(404, "file not found")
    return FileResponse(target)


@app.post("/api/runs/{run_id}/cancel")
def cancel_run(run_id: str) -> dict:
    find_run(run_id)
    process = PROCESSES.get(run_id)
    if process and process.is_alive():
        process.terminate()
        process.join(timeout=2)
    return {"run_id": run_id, "status": "cancelled"}


@app.websocket("/api/runs/{run_id}/events")
async def run_events(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    run_dir = find_run(run_id)
    events_file = run_dir / "events.jsonl"
    cursor = 0
    try:
        while True:
            if events_file.exists():
                lines = events_file.read_text(encoding="utf-8").splitlines()
                for line in lines[cursor:]:
                    await websocket.send_text(line)
                cursor = len(lines)
            progress = run_dir / "progress.json"
            if progress.exists():
                state = json.loads(progress.read_text(encoding="utf-8"))
                if state.get("status") in {"completed", "failed", "cancelled"} and cursor >= len(lines if events_file.exists() else []):
                    await asyncio.sleep(0.2)
                    break
            await asyncio.sleep(0.15)
    except (WebSocketDisconnect, RuntimeError):
        return


# A packaged desktop build serves the compiled React app from the same local origin
# as the API. During development Vite serves the UI separately.
FRONTEND_DIR = os.environ.get("SIREN_FRONTEND_DIR")
if FRONTEND_DIR and (Path(FRONTEND_DIR) / "index.html").is_file():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
