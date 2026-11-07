from __future__ import annotations

import csv
import json
import math
import time
from pathlib import Path
from typing import Callable

import numpy as np

from .models import CaseConfig


ProgressCallback = Callable[[dict], None]


def _write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def run_case(config: CaseConfig, run_dir: Path, emit: ProgressCallback | None = None) -> dict:
    """Run a GUI-first dynamic response prototype and persist streamable results.

    The formulation is intentionally lightweight for the first GUI milestone:
    a spatial mode shape, relative-flow frequency and damped forced response are
    integrated in time. The file/API contracts are production-shaped so the
    numerical kernel can be replaced by a higher-fidelity implementation later.
    """
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "exports").mkdir(parents=True, exist_ok=True)
    events_path = run_dir / "events.jsonl"
    progress_path = run_dir / "progress.json"
    log_path = run_dir / "logs" / "solver.log"
    log_path.parent.mkdir(exist_ok=True)

    def emit_event(event: dict) -> None:
        event_line = {"timestamp": time.time(), **event}
        with events_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(event_line, ensure_ascii=False) + "\n")
        if emit:
            emit(event_line)

    def write_progress(event: dict) -> None:
        _write_json(progress_path, event)
        emit_event(event)

    s, e, q = config.structure, config.environment, config.solver
    n_nodes = s.element_count + 1
    n_steps = max(2, int(math.ceil(q.end_time / q.output_interval)) + 1)
    z = np.linspace(0.0, s.length, n_nodes)
    times = np.linspace(0.0, q.end_time, n_steps)
    x = np.zeros((n_steps, n_nodes), dtype=np.float64)
    y = np.zeros_like(x)
    vx = np.zeros_like(x)
    vy = np.zeros_like(x)

    natural_frequency = max(0.08, math.sqrt(max(s.top_tension, 1e-6) / max(s.mass_per_length, 1e-6)) / (2 * math.pi * s.length))
    vortex_frequency = e.strouhal_number * e.velocity / max(s.outer_diameter, 1e-9)
    forcing_frequency = e.oscillation_frequency or vortex_frequency
    amplitude = min(0.35 * s.outer_diameter + 0.02, 0.16 * max(s.length, 1.0))
    if config.case_type == "oscillating_flow":
        amplitude += e.oscillation_amplitude
    if config.case_type == "vessel_induced_flow":
        amplitude += 0.5 * e.oscillation_amplitude
    damping = max(0.01, s.damping_ratio + 0.02)

    started = time.perf_counter()
    for index, t in enumerate(times):
        phase = 2 * math.pi * forcing_frequency * t
        mode = np.sin(math.pi * z / s.length)
        envelope = 0.65 + 0.35 * z / max(s.length, 1e-9)
        y[index] = amplitude * mode * envelope * math.sin(phase) * math.exp(-damping * t / max(q.end_time, 1e-9))
        x[index] = 0.16 * amplitude * mode * math.sin(phase * 0.5 + 0.4)
        if index:
            dt = times[index] - times[index - 1]
            vx[index] = (x[index] - x[index - 1]) / dt
            vy[index] = (y[index] - y[index - 1]) / dt

        progress = index / max(n_steps - 1, 1)
        if index % max(1, q.animation_stride) == 0 or index == n_steps - 1:
            write_progress({
                "type": "progress",
                "status": "running",
                "progress": progress,
                "simulation_time": float(t),
                "total_time": q.end_time,
                "speed": (t / max(time.perf_counter() - started, 1e-6)),
            })
            emit_event({
                "type": "frame",
                "time": float(t),
                "positions": np.column_stack((x[index], y[index], z)).round(8).tolist(),
            })

    rms_y = np.sqrt(np.mean(y * y, axis=0))
    spectrum = np.abs(np.fft.rfft(y[:, n_nodes // 2] - np.mean(y[:, n_nodes // 2])))
    frequencies = np.fft.rfftfreq(n_steps, d=max(times[1] - times[0], 1e-9))
    peak_index = int(np.argmax(spectrum[1:]) + 1) if len(spectrum) > 1 else 0
    peak_frequency = float(frequencies[peak_index])
    max_displacement = float(np.max(np.abs(y)))
    rms_displacement = float(np.sqrt(np.mean(y * y)))
    max_force = float(0.5 * e.fluid_density * e.cd_average * s.outer_diameter * e.velocity**2)

    np.savez_compressed(run_dir / "results.npz", time=times, z=z, x=x, y=y, vx=vx, vy=vy, rms_y=rms_y, frequencies=frequencies, spectrum=spectrum)
    with (run_dir / "exports" / "time_history.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["time_s", "node", "z_m", "x_m", "y_m", "vx_m_s", "vy_m_s"])
        for i, t in enumerate(times):
            for node in range(n_nodes):
                writer.writerow([float(t), node, float(z[node]), float(x[i, node]), float(y[i, node]), float(vx[i, node]), float(vy[i, node])])
    with (run_dir / "exports" / "rms_profile.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["z_m", "z_over_L", "rms_y_m"])
        writer.writerows([[float(zz), float(zz / s.length), float(rr)] for zz, rr in zip(z, rms_y)])
    with (run_dir / "exports" / "fft.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["frequency_hz", "amplitude"])
        writer.writerows([[float(freq), float(value)] for freq, value in zip(frequencies, spectrum)])

    summary = {
        "status": "completed",
        "case_type": config.case_type,
        "max_displacement": max_displacement,
        "rms_displacement": rms_displacement,
        "peak_frequency": peak_frequency,
        "max_fluid_force": max_force,
        "node_count": n_nodes,
        "element_count": s.element_count,
        "warnings": ["GUI 优先原型：当前响应模型用于流程和可视化验证，不作为工程精度结论。"],
    }
    _write_json(run_dir / "summary.json", summary)
    write_progress({"type": "progress", "status": "completed", "progress": 1.0, "simulation_time": q.end_time, "total_time": q.end_time, "speed": q.end_time / max(time.perf_counter() - started, 1e-6)})
    log_path.write_text("RiserPredict solver completed successfully.\n", encoding="utf-8")
    return summary
