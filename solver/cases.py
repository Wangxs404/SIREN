from __future__ import annotations

from pathlib import Path

from .models import CaseConfig
from .runner import run_case


def run_uniform_flow(config: CaseConfig, run_dir: Path):
    return run_case(config.model_copy(update={"case_type": "uniform_flow"}), run_dir)


def run_oscillating_flow(config: CaseConfig, run_dir: Path):
    return run_case(config.model_copy(update={"case_type": "oscillating_flow"}), run_dir)


def run_vessel_induced_flow(config: CaseConfig, run_dir: Path):
    return run_case(config.model_copy(update={"case_type": "vessel_induced_flow"}), run_dir)
