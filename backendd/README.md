# GreenPulse Node.js backend

This Express API is a separate replacement for the Java service. It uses the same `/api/v1` routes and MySQL tables, so the existing frontend can point to it without changing its API base URL.

## Requirements

- Node.js 20+
- MySQL 8 with the GreenPulse schema
- The GreenPulse ML service for prediction and anomaly endpoints

## Configure and run

The server loads `backendd/.env` first. If that file does not exist, it uses the existing `backend/.env`. Create `backendd/.env` from `.env.example` if it does not already exist; do not overwrite an existing env file. Set `JWT_SECRET` to a unique random value of at least 32 bytes and set the MySQL credentials. Never commit either `.env` file.

From PowerShell:

```powershell
Set-Location D:\imp\pranav\Project\backendd
# If .env does not already exist:
Copy-Item .env.example .env
npm install
npm run db:init
npm run dev
```

Before starting, generate a JWT secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and place it in `JWT_SECRET` in `backendd/.env`. `npm run db:init` creates any missing tables and leaves existing tables/data intact. The API defaults to `http://localhost:8087`; health is available at `/health` and `/actuator/health`. Set `VITE_API_BASE_URL=http://localhost:8087/api/v1` in `frontend/.env` to match, then start the frontend from its folder with `npm run dev`.

Public organization signup is disabled unless `ALLOW_REGISTRATION=true`. When enabled, `POST /api/v1/auth/register-organization` transactionally creates an organization and its first `ORG_ADMIN`; users cannot choose their role. All roles use the same `POST /api/v1/auth/login` endpoint.

An authenticated `ORG_ADMIN` can add users to their own organization from the frontend's **Users** page or `POST /api/v1/auth/register`. A `SUPER_ADMIN` can add users to a selected organization. Both can assign `ORG_ADMIN`, `BUILDING_MANAGER`, or `ANALYST`; `SUPER_ADMIN` accounts are never self-registered. User creation takes an initial password; email invitations and password reset are not configured.

## Initial administrator

Optional: after initializing the schema, run `npm run bootstrap:admin` from this folder to create a global `SUPER_ADMIN` with no organization. It only works while the users table is empty. The password is entered privately in the terminal. This account can create organizations with `POST /api/v1/organizations` and add users to them. Alternatively, enable public organization signup and its first account is an `ORG_ADMIN`.
