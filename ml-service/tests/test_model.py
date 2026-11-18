from datetime import date, timedelta

import pytest

from app.model import detect, evaluate, features, forecast, series_frame


def readings(count=42):
    start = date(2025, 1, 1)
    return [{"reading_date": start + timedelta(days=i), "energy_consumed_kwh": 100 + (i % 7) * 4 + i * 0.2} for i in range(count)]


def test_series_sorts_and_deduplicates():
    values = readings(10)
    frame = series_frame([values[2], values[0], values[2]])
    assert len(frame) == 2
    assert frame.iloc[0].reading_date < frame.iloc[1].reading_date


def test_forecast_and_metrics_have_actual_values():
    result = forecast(readings(), 4, "random_forest")
    assert len(result["predictions"]) == 4
    assert result["evaluation"]["mae"] >= 0
    assert result["model_version"] == "1.0.0"


def test_evaluate_rejects_insufficient_data():
    with pytest.raises(ValueError, match="At least 28"):
        evaluate(readings(12))


def test_anomaly_detection_returns_schema():
    values = readings(40)
    values[-1]["energy_consumed_kwh"] = 800
    found = detect(values)
    assert found
    assert all(x["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"} for x in found)


def test_feature_matrix_uses_previous_values():
    X, y = features(series_frame(readings(10)))
    assert len(X) == len(y) == 10
    assert {"lag_1", "lag_7", "rolling_7"}.issubset(X.columns)
