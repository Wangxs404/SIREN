from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from solver.runner import run_case
from solver.source_cases import all_source_cases


OUTPUT = ROOT / "projects" / "source-case-validation"


def main() -> None:
    report = {"validation_scope": "full source-example durations, GUI prototype solver", "cases": []}
    for index, config in enumerate(all_source_cases(), start=1):
        slug = ["uniform-flow", "oscillating-flow", "vessel-induced-flow"][index - 1]
        run_dir = OUTPUT / slug
        started = time.perf_counter()
        summary = run_case(config, run_dir)
        elapsed = time.perf_counter() - started
        report["cases"].append({
            "name": config.name,
            "case_type": config.case_type,
            "input": config.model_dump(),
            "summary": summary,
            "elapsed_seconds": round(elapsed, 3),
            "run_directory": str(run_dir.relative_to(ROOT)),
            "files": sorted(str(path.relative_to(run_dir)) for path in run_dir.rglob("*") if path.is_file()),
        })
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT / "validation-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"report": str(report_path), "cases": [{"name": row["name"], "status": row["summary"]["status"], "max_displacement_m": row["summary"]["max_displacement"], "rms_displacement_m": row["summary"]["rms_displacement"], "peak_frequency_hz": row["summary"]["peak_frequency"], "elapsed_seconds": row["elapsed_seconds"], "files": len(row["files"])} for row in report["cases"]]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
