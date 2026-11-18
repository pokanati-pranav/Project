from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_invalid_prediction_payload_is_rejected():
    response = client.post("/predict", json={"readings": [], "horizon_days": 7})
    assert response.status_code == 422


def test_model_info_lists_algorithms():
    response = client.get("/model-info")
    assert response.status_code == 200
    assert "random_forest" in response.json()["available_models"]
