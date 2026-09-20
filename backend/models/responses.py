from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ToolCallRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str = Field(
        description="Name of the tool to call",
        examples=["compare_profiles"],
    )
    arguments: dict[str, Any] = Field(
        default_factory=dict,
        description="Arguments for the tool",
    )


class ToolCallResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str
    status: Literal["success", "error", "clarification"]
    result: dict[str, Any] | None = None
    error: str | None = None
    evidence: dict[str, Any] | None = None


class ObservationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row: int
    pressure_dbar: float
    depth_m: float
    temperature_c: float
    salinity_psu: float


class FloatSearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    profile_count: int
    cycles: list[int]
    cycle_range: list[int]
    time_start_utc: str
    time_end_utc: str
    accepted_observations: int


class FloatMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    cycle: int
    time_utc: str
    latitude: float
    longitude: float
    data_mode: str
    total_levels: int
    accepted_levels: int
    excluded_levels: int
    evidence: dict[str, Any]


class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    cycle: int
    time_utc: str
    latitude: float
    longitude: float
    data_mode: str
    total_levels: int
    accepted_levels: int
    excluded_levels: int
    evidence: dict[str, Any]
    observations: list[ObservationRecord]


class ProfileHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    profiles: list[ProfileResponse]
    excluded_profiles: list[dict[str, Any]]
    available_profiles: int
    discovered_files: int


class ComparisonResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    variable: str
    cycle_a: dict[str, Any]
    cycle_b: dict[str, Any]
    delta: dict[str, Any]
    statistics: dict[str, Any]
    evidence: dict[str, Any]


class DepthSliceResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    depth_m: float
    tolerance_m: float
    observations: list[dict[str, Any]]
    statistics: dict[str, Any]
    evidence: dict[str, Any]


class StatisticsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variable: str
    unit: str
    count: int
    mean: float
    std: float
    min: float
    max: float
    median: float
    q25: float
    q75: float
    range: float
    evidence: dict[str, Any]


class QCExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    flag_value: str
    meaning: str
    description: str
    action: str


class AnomalyPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row: int
    depth_m: float
    pressure_dbar: float
    value: float
    z_score: float
    is_anomaly: bool
    anomaly_type: str


class AnomalyDetectionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    cycle: int
    variable: str
    unit: str
    method: str
    threshold: float
    total_levels: int
    anomalies_detected: int
    anomalies: list[AnomalyPoint]
    summary: str
    evidence: dict[str, Any]


class EvidencePackage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    cycle: int
    timestamp: str
    latitude: float
    longitude: float
    pressure_dbar: float
    depth_m: float
    temperature_c: float
    salinity_psu: float
    qc_flags: dict[str, str]
    source_file: str
    source_row: int
    data_mode: str
    notes: str


class ForecastPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days_ahead: int
    predicted_value: float
    confidence_lower: float
    confidence_upper: float
    method: str


class ForecastResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    float_id: int
    variable: str
    unit: str
    forecast_horizon_days: int
    historical_points_used: int
    forecasts: list[ForecastPoint]
    disclaimer: str
    evidence: dict[str, Any]


class AssistantResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["completed", "clarification", "unsupported", "error"]
    message: str
    tool_calls: list[ToolCallRequest] | None = None
    results: list[ToolCallResponse] | None = None
    evidence: list[EvidencePackage] | None = None
    assumptions: list[str] = Field(default_factory=list)
