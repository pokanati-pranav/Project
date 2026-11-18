from datetime import date
from pydantic import BaseModel, Field, ConfigDict


class Reading(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reading_date: date
    energy_consumed_kwh: float = Field(ge=0, le=1_000_000_000)


class SeriesRequest(BaseModel):
    readings: list[Reading] = Field(min_length=1, max_length=50000)


class TrainRequest(SeriesRequest):
    building_id: int = Field(gt=0)


class PredictRequest(SeriesRequest):
    horizon_days: int = Field(default=7, ge=1, le=90)
    model_name: str = Field(default="random_forest", pattern="^(random_forest|linear_regression)$")


class AnomalyRequest(SeriesRequest):
    contamination: float | None = Field(default=None, gt=0, le=0.5)
