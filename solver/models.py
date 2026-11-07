from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


CaseType = Literal["uniform_flow", "oscillating_flow", "vessel_induced_flow"]


class StructureConfig(BaseModel):
    length: float = Field(gt=0)
    outer_diameter: float = Field(gt=0)
    inner_diameter: float = Field(ge=0)
    top_tension: float = Field(ge=0)
    mass_per_length: float = Field(gt=0)
    youngs_modulus: float = Field(gt=0)
    poisson_ratio: float = Field(ge=0, lt=0.5)
    damping_ratio: float = Field(ge=0, le=1)
    element_count: int = Field(ge=2, le=5000)

    @model_validator(mode="after")
    def check_diameter(self) -> "StructureConfig":
        if self.inner_diameter >= self.outer_diameter:
            raise ValueError("inner_diameter must be smaller than outer_diameter")
        return self


class EnvironmentConfig(BaseModel):
    fluid_density: float = Field(gt=0)
    velocity: float = Field(ge=0)
    strouhal_number: float = Field(gt=0, le=1)
    cd_average: float = Field(ge=0)
    oscillation_amplitude: float = Field(ge=0)
    oscillation_frequency: float = Field(ge=0)


class SolverConfig(BaseModel):
    end_time: float = Field(gt=0, le=3600)
    time_step: float = Field(gt=0, le=1)
    output_interval: float = Field(gt=0)
    animation_stride: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def check_interval(self) -> "SolverConfig":
        if self.output_interval < self.time_step:
            raise ValueError("output_interval must be >= time_step")
        return self


class BoundaryConfig(BaseModel):
    top: Literal["fixed", "tensioned", "motion_input"] = "tensioned"
    bottom: Literal["fixed", "pinned", "motion_input"] = "fixed"


class CaseConfig(BaseModel):
    case_type: CaseType = "uniform_flow"
    name: str = "Case1103-VIV"
    structure: StructureConfig
    environment: EnvironmentConfig
    solver: SolverConfig
    boundary: BoundaryConfig = BoundaryConfig()


DEFAULT_CASE = CaseConfig(
    case_type="uniform_flow",
    name="Case1103-VIV",
    structure=StructureConfig(
        length=9.63,
        outer_diameter=0.02,
        inner_diameter=0.0191,
        top_tension=817,
        mass_per_length=0.699,
        youngs_modulus=1.025e11,
        poisson_ratio=0.3,
        damping_ratio=0.0,
        element_count=18,
    ),
    environment=EnvironmentConfig(
        fluid_density=1025,
        velocity=0.2,
        strouhal_number=0.14,
        cd_average=1.2,
        oscillation_amplitude=0.0,
        oscillation_frequency=0.0,
    ),
    solver=SolverConfig(
        end_time=35,
        time_step=0.01,
        output_interval=0.05,
        animation_stride=1,
    ),
)
