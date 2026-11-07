"""Parameter sets transcribed from the three bundled MATLAB example scripts.

These are input presets for exercising the Python GUI pipeline. The Python
solver remains a simplified visualisation prototype, not a numerical port of
the MATLAB equations.
"""

from __future__ import annotations

import math

from .models import CaseConfig, EnvironmentConfig, SolverConfig, StructureConfig, BoundaryConfig


def _solid_or_tube_second_moment(outer_diameter: float, inner_diameter: float) -> float:
    return math.pi * outer_diameter**4 * (1 - (inner_diameter / outer_diameter) ** 4) / 64


def uniform_flow_case() -> CaseConfig:
    return CaseConfig(
        case_type="uniform_flow",
        name="Case1103-VIV · 均匀流",
        structure=StructureConfig(
            length=9.63, outer_diameter=0.02, inner_diameter=0.0191,
            top_tension=817, mass_per_length=0.699, youngs_modulus=1.025e11,
            poisson_ratio=0.3, damping_ratio=0.0, element_count=18,
        ),
        environment=EnvironmentConfig(
            fluid_density=1025, velocity=0.2, strouhal_number=0.14,
            cd_average=1.2, oscillation_amplitude=0, oscillation_frequency=0,
        ),
        solver=SolverConfig(end_time=35, time_step=1e-4, output_interval=0.01, animation_stride=5),
        boundary=BoundaryConfig(top="tensioned", bottom="fixed"),
    )


def oscillating_flow_case() -> CaseConfig:
    diameter, inner = 0.024, 0.0
    inertia = _solid_or_tube_second_moment(diameter, inner)
    return CaseConfig(
        case_type="oscillating_flow",
        name="Case1 · 振荡流",
        structure=StructureConfig(
            length=4.0, outer_diameter=diameter, inner_diameter=inner,
            top_tension=500, mass_per_length=0.69, youngs_modulus=10.5 / inertia,
            poisson_ratio=0.3, damping_ratio=0.015, element_count=8,
        ),
        environment=EnvironmentConfig(
            fluid_density=1000, velocity=0, strouhal_number=0.17,
            cd_average=1.2, oscillation_amplitude=0.68,
            oscillation_frequency=1 / 16.5,
        ),
        solver=SolverConfig(end_time=130, time_step=1e-4, output_interval=0.05, animation_stride=2),
        boundary=BoundaryConfig(top="motion_input", bottom="motion_input"),
    )


def vessel_induced_flow_case() -> CaseConfig:
    diameter, inner = 0.028, 0.017
    inertia = _solid_or_tube_second_moment(diameter, inner)
    return CaseConfig(
        case_type="vessel_induced_flow",
        name="Test_1025 · 船舶运动诱导振荡流",
        structure=StructureConfig(
            length=8.996, outer_diameter=diameter, inner_diameter=inner,
            top_tension=212, mass_per_length=0.668, youngs_modulus=120 / inertia,
            poisson_ratio=0.3, damping_ratio=0.01, element_count=10,
        ),
        environment=EnvironmentConfig(
            fluid_density=1000, velocity=0, strouhal_number=0.2,
            cd_average=2.0, oscillation_amplitude=0.078,
            oscillation_frequency=0.646,
        ),
        solver=SolverConfig(end_time=200, time_step=1e-4, output_interval=0.05, animation_stride=2),
        boundary=BoundaryConfig(top="tensioned", bottom="motion_input"),
    )


def all_source_cases() -> list[CaseConfig]:
    return [uniform_flow_case(), oscillating_flow_case(), vessel_induced_flow_case()]
