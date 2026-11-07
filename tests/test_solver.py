import json

from solver.models import DEFAULT_CASE
from solver.runner import run_case


def test_uniform_flow_run(tmp_path):
    config = DEFAULT_CASE.model_copy(update={"solver": DEFAULT_CASE.solver.model_copy(update={"end_time": 0.2, "output_interval": 0.05})})
    summary = run_case(config, tmp_path / "run")
    assert summary["status"] == "completed"
    assert summary["node_count"] == config.structure.element_count + 1
    assert (tmp_path / "run" / "results.npz").exists()
    assert json.loads((tmp_path / "run" / "summary.json").read_text())["peak_frequency"] >= 0
