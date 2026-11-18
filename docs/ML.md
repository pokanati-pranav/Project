# Machine learning service

## Endpoints

- `GET /health`: runtime and storage status.
- `POST /train`: building ID plus daily readings; evaluates a chronological 80/20 split and persists the full-data Random Forest with Joblib.
- `POST /evaluate`: trains Linear Regression and Random Forest and returns measured MAE, RMSE, and R² on the final chronological holdout.
- `POST /predict`: recursive 1–90 day forecast. Requires at least 28 distinct dates.
- `POST /detect-anomalies`: Isolation Forest with configurable contamination. Requires at least 10 readings.
- `GET /model-info`: model names, version, and persisted building artifacts.

The predictors include calendar features, previous-day and previous-week lags, and a trailing mean. Forecast features use only historical or previously predicted values. A chronological split avoids shuffling future information into training. Anomaly scores are normalized within the submitted series and severity reflects score quantiles in that series; labels are investigation signals, not equipment diagnoses.

The service uses no fabricated measurements. Supply authorized readings via CSV upload. There is no dataset bundled; the UCI Individual Household Electric Power Consumption archive is a possible research source after checking current usage/license terms. Document source, license, sampling conversion, missing-value policy and timezone when importing an external dataset. Render local filesystem storage may be ephemeral. Mount durable storage or retrain after deploy.
