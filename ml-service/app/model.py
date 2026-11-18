import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

MODEL_DIR = Path(os.getenv("MODEL_DIR", "./models"))
MIN_ROWS = int(os.getenv("MIN_TRAINING_ROWS", "28"))
VERSION = "1.0.0"


def series_frame(readings: list[dict]) -> pd.DataFrame:
    frame = pd.DataFrame(readings)
    if frame.empty:
        raise ValueError("At least one reading is required")
    frame["reading_date"] = pd.to_datetime(frame["reading_date"], errors="raise")
    frame["energy_consumed_kwh"] = pd.to_numeric(frame["energy_consumed_kwh"], errors="raise")
    if frame["energy_consumed_kwh"].isna().any() or not np.isfinite(frame["energy_consumed_kwh"].to_numpy(dtype=float)).all() or (frame["energy_consumed_kwh"] < 0).any():
        raise ValueError("Energy readings must be finite non-negative numbers")
    frame = frame.sort_values("reading_date").drop_duplicates("reading_date", keep="last").reset_index(drop=True)
    return frame


def features(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    data = frame.copy().sort_values("reading_date").reset_index(drop=True)
    dates = data["reading_date"]
    data["dow"] = dates.dt.dayofweek
    data["day"] = dates.dt.day
    data["month"] = dates.dt.month
    data["week"] = dates.dt.isocalendar().week.astype(int)
    data["lag_1"] = data["energy_consumed_kwh"].shift(1)
    data["lag_7"] = data["energy_consumed_kwh"].shift(7)
    data["rolling_7"] = data["energy_consumed_kwh"].shift(1).rolling(7, min_periods=1).mean()
    data["lag_1"] = data["lag_1"].fillna(data["energy_consumed_kwh"].expanding().mean())
    data["lag_7"] = data["lag_7"].fillna(data["lag_1"])
    data["rolling_7"] = data["rolling_7"].fillna(data["lag_1"])
    X = data[["dow", "day", "month", "week", "lag_1", "lag_7", "rolling_7"]]
    return X, data["energy_consumed_kwh"]


def evaluate(readings: list[dict]) -> dict:
    frame = series_frame(readings)
    if len(frame) < MIN_ROWS:
        raise ValueError(f"At least {MIN_ROWS} distinct daily readings are required; received {len(frame)}")
    X, y = features(frame)
    split = max(int(len(frame) * 0.8), 1)
    if len(frame) - split < 2:
        split = len(frame) - 2
    results = {}
    for name, estimator in (("linear_regression", LinearRegression()), ("random_forest", RandomForestRegressor(n_estimators=160, min_samples_leaf=2, random_state=42, n_jobs=-1))):
        estimator.fit(X.iloc[:split], y.iloc[:split])
        actual = y.iloc[split:]
        predicted = estimator.predict(X.iloc[split:])
        results[name] = {"mae": float(mean_absolute_error(actual, predicted)), "rmse": float(np.sqrt(mean_squared_error(actual, predicted))), "r2": float(r2_score(actual, predicted)) if len(actual) > 1 else None}
    return {"rows": len(frame), "train_rows": split, "test_rows": len(frame) - split, "metrics": results}


def train(readings: list[dict], building_id: int) -> dict:
    result = evaluate(readings)
    frame = series_frame(readings)
    X, y = features(frame)
    model = RandomForestRegressor(n_estimators=160, min_samples_leaf=2, random_state=42, n_jobs=-1)
    model.fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "last_date": frame["reading_date"].max(), "history": frame.tail(35)["energy_consumed_kwh"].tolist()}, MODEL_DIR / f"building-{building_id}.joblib")
    return {"building_id": building_id, "model_name": "random_forest", "model_version": VERSION, **result}


def forecast(readings: list[dict], horizon_days: int, model_name: str) -> dict:
    frame = series_frame(readings)
    if len(frame) < MIN_ROWS:
        raise ValueError(f"At least {MIN_ROWS} distinct daily readings are required; received {len(frame)}")
    X, y = features(frame)
    estimator = RandomForestRegressor(n_estimators=160, min_samples_leaf=2, random_state=42, n_jobs=-1) if model_name == "random_forest" else LinearRegression()
    estimator.fit(X, y)
    history = frame["energy_consumed_kwh"].tolist()
    last_date = frame["reading_date"].max()
    output = []
    for step in range(1, horizon_days + 1):
        dt = last_date + pd.Timedelta(days=step)
        lag1 = history[-1]
        row = pd.DataFrame([{"dow": dt.dayofweek, "day": dt.day, "month": dt.month, "week": int(dt.isocalendar().week), "lag_1": lag1, "lag_7": history[-7] if len(history) >= 7 else float(np.mean(history)), "rolling_7": float(np.mean(history[-7:]))}])
        prediction = max(float(estimator.predict(row)[0]), 0.0)
        output.append({"prediction_date": dt.date().isoformat(), "predicted_kwh": round(prediction, 3)})
        history.append(prediction)
    return {"predictions": output, "model_name": model_name, "model_version": VERSION, "evaluation": evaluate(readings)["metrics"][model_name]}


def detect(readings: list[dict], contamination: float | None = None) -> list[dict]:
    frame = series_frame(readings)
    if len(frame) < 10:
        raise ValueError(f"At least 10 readings are required for anomaly detection; received {len(frame)}")
    values = frame["energy_consumed_kwh"].to_numpy()
    rolling = pd.Series(values).shift(1).rolling(7, min_periods=3).mean()
    baseline = rolling.fillna(pd.Series(values).expanding().mean()).to_numpy()
    deviation = np.divide(values - baseline, np.maximum(np.abs(baseline), 1e-6))
    X = np.column_stack([values, baseline, deviation, frame["reading_date"].dt.dayofweek.to_numpy()])
    contamination = contamination or float(os.getenv("ANOMALY_CONTAMINATION", "0.05"))
    model = IsolationForest(contamination=contamination, random_state=42)
    labels = model.fit_predict(X)
    scores = -model.score_samples(X)
    q75, q90, q97 = np.quantile(scores, [0.75, 0.90, 0.97])
    output = []
    for i, row in frame.iterrows():
        if labels[i] != -1:
            continue
        normalized = float((scores[i] - scores.min()) / max(scores.max() - scores.min(), 1e-9))
        severity = "CRITICAL" if scores[i] >= q97 else "HIGH" if scores[i] >= q90 else "MEDIUM" if scores[i] >= q75 else "LOW"
        output.append({"reading_date": row["reading_date"].date().isoformat(), "energy_consumed_kwh": float(values[i]), "is_anomaly": True, "anomaly_score": round(normalized, 4), "severity": severity, "explanation": f"Observed {values[i]:.2f} kWh versus recent baseline {baseline[i]:.2f} kWh. Statistical alert only; investigate before attributing a cause."})
    return output
