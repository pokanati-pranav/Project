# Deployment checklist

## Netlify frontend

Use `frontend` as base directory, `npm run build` as build command, and `dist` as publish directory. Set `VITE_API_BASE_URL` to the deployed backend base ending in `/api/v1`. `netlify.toml` installs the SPA route fallback.

## Render backend

Create a Docker Web Service rooted at `backend`, using its Dockerfile. Set `SPRING_PROFILES_ACTIVE=prod`, DB credentials, `JWT_SECRET`, `CORS_ALLOWED_ORIGIN` (the exact Netlify origin), `ML_SERVICE_URL`, and `ALLOW_REGISTRATION=false`. Health check `/actuator/health`. Render injects `PORT`.

## Render ML service

Create a native Python service rooted at `ml-service`. Build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `MODEL_DIR` and `MIN_TRAINING_ROWS`. Use durable mounted model storage if available.

## MySQL provider

Create a managed MySQL 8 database and application user. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`; set `DB_SSL=true` where provider TLS is available. Flyway runs migrations at backend startup. Keep credentials in Render's environment settings only.
