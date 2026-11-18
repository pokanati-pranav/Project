from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from app.model import VERSION, evaluate, train, forecast, detect, MODEL_DIR
from app.schemas import AnomalyRequest, PredictRequest, SeriesRequest, TrainRequest

app = FastAPI(title="GreenPulse ML Service", version=VERSION, description="Energy forecasting and anomaly detection APIs")


@app.exception_handler(ValueError)
async def value_error_handler(_, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok", "model_version": VERSION, "model_storage": str(MODEL_DIR), "storage_persistence": "depends on deployment volume"}


@app.post("/train")
def train_model(payload: TrainRequest):
    return train([x.model_dump() for x in payload.readings], payload.building_id)


@app.post("/evaluate")
def evaluate_model(payload: SeriesRequest):
    return evaluate([x.model_dump() for x in payload.readings])


@app.post("/predict")
def predict(payload: PredictRequest):
    return forecast([x.model_dump() for x in payload.readings], payload.horizon_days, payload.model_name)


@app.post("/detect-anomalies")
def anomalies(payload: AnomalyRequest):
    return {"anomalies": detect([x.model_dump() for x in payload.readings], payload.contamination)}


@app.get("/model-info")
def model_info():
    models = sorted(p.name for p in MODEL_DIR.glob("*.joblib")) if MODEL_DIR.exists() else []
    return {"version": VERSION, "available_models": ["linear_regression", "random_forest", "isolation_forest"], "trained_buildings": models, "minimum_training_rows": 28}
