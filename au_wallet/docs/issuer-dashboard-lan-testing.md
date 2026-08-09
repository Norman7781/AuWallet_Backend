# Issuer Dashboard Same-Wi-Fi Testing

This runbook covers only Member 1/Member 2 health, verified AU wallet count,
and recent automatic-verification activity. It does not cover transcript or
credential functionality.

## Required local configuration

In the backend's ignored `.env`, set the issuer origin without a path or
trailing wildcard:

```dotenv
ISSUER_UI_ORIGIN=http://localhost:5173
```

Do not copy secret values from `.env` into logs, documentation, frontend
configuration, or shell history.

Immediately before testing, determine the backend machine's current Wi-Fi/LAN
address. On macOS, try the active interfaces without assuming which one Wi-Fi
uses:

```bash
ipconfig getifaddr en0
ipconfig getifaddr en1
```

Use the address that belongs to the shared LAN. Do not assume the former
`192.168.1.7` address is still valid.

Set the issuer frontend's local environment to the address found in that same
test session:

```dotenv
VITE_API_BASE_URL=http://<current-backend-LAN-IP>:3000
```

Do not put the backend service-role key, publishable key, passport HMAC secret,
or any other backend secret in a `VITE_` variable.

## Start the two local services

Start the Nest backend on port 3000. Then start the read-only issuer project
using its actual Vite port and fail if that port is occupied:

```bash
npm run dev -- --port 5173 --strictPort
```

The browser page origin must exactly match `http://localhost:5173`. CORS uses
exact configured origins and never `*`. CORS is a browser policy, not
authentication; the temporary dashboard endpoint is instead hidden whenever
`NODE_ENV=production`.

## Safe checks

Expected endpoints:

- `GET /health` — public safe liveness envelope.
- `GET /issuer/dashboard/connection-summary` — development/test-only AU
  connection summary; temporarily no issuer login.

Student provider APIs remain protected by a Bearer token:

- `GET /issuer-providers`
- `GET /issuer-connections/me`
- `GET /issuer-connections/:issuerCode`
- `POST /issuer-connections/:issuerCode/verification-requests`

Dashboard activity represents only a verified AU academic connection. Never
display personal-email wallet creation as identified student activity, and do
not add student names, admission numbers, dates of birth, emails, passport
information, internal IDs, or transcript fields to this dashboard response.
