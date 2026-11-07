import math
import tempfile
from pathlib import Path

import numpy as np

from solver.runner import run_case
from solver.source_cases import all_source_cases


def test_source_case_parameters_match_example_scripts():
    uniform, oscillating, vessel = all_source_cases()
    assert (uniform.solver.end_time, uniform.solver.time_step, uniform.solver.output_interval, uniform.structure.element_count) == (35, 1e-4, 0.01, 18)
    assert (uniform.structure.length, uniform.structure.outer_diameter, uniform.structure.inner_diameter, uniform.structure.top_tension) == (9.63, 0.02, 0.0191, 817)
    assert (oscillating.solver.end_time, oscillating.solver.time_step, oscillating.solver.output_interval, oscillating.structure.element_count) == (130, 1e-4, 0.05, 8)
    assert math.isclose(oscillating.environment.oscillation_frequency, 1 / 16.5)
    assert (vessel.solver.end_time, vessel.solver.time_step, vessel.solver.output_interval, vessel.structure.element_count) == (200, 1e-4, 0.05, 10)
    assert vessel.environment.oscillation_frequency == 0.646


def test_all_source_case_runs_produce_finite_complete_outputs():
    for config in all_source_cases():
        with tempfile.TemporaryDirectory() as temp_dir:
            summary = run_case(config, Path(temp_dir) / "run")
            result = np.load(Path(temp_dir) / "run" / "results.npz")
            assert summary["status"] == "completed"
            assert summary["node_count"] == config.structure.element_count + 1
            assert result["time"][0] == 0
            assert math.isclose(result["time"][-1], config.solver.end_time)
            for key in ("time", "x", "y", "vx", "vy", "rms_y", "frequencies", "spectrum"):
                assert np.isfinite(result[key]).all(), (config.name, key)
            assert (Path(temp_dir) / "run" / "exports" / "time_history.csv").exists()
            assert (Path(temp_dir) / "run" / "exports" / "rms_profile.csv").exists()
            assert (Path(temp_dir) / "run" / "exports" / "fft.csv").exists()
