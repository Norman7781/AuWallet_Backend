# Issuer Dashboard Private-Network Testing

This runbook covers health, verified AU wallet count, recent automatic
verification activity, and the read-only academic work needed before an issuer
starts credential issuance. It does not cover credential generation, signing,
issuance, DID operations, or wallet delivery.

## Required local configuration

In the backend's ignored `.env`, set the issuer origin without a path or
trailing wildcard:

```dotenv
ISSUER_UI_ORIGIN=http://localhost:5173
```

Do not copy secret values from `.env` into logs, documentation, frontend
configuration, or shell history.

Connect both laptops to the same private Tailscale network. Immediately before
testing, confirm the backend Mac is connected and determine its current
Tailscale IPv4 address:

```bash
tailscale status
tailscale ip -4
```

The backend API destination uses the backend Mac's Tailscale address. It does
not use the issuer laptop's or wallet phone's own Tailscale address.

Set the issuer frontend's ignored local environment to the backend address
found in that test session:

```dotenv
VITE_API_BASE_URL=http://<backend-tailscale-ip>:3000
```

Do not put the backend service-role key, publishable key, passport HMAC secret,
or any other backend secret in a `VITE_` variable.

## Start the two local services

Start the Nest backend on `0.0.0.0:3000`, not only localhost. Then start the
read-only issuer project using its actual Vite port and fail if that port is
occupied:

```bash
npm run dev -- --port 5173 --strictPort
```

The API destination and browser origin are different values:

- API destination: `http://<backend-tailscale-ip>:3000`
- issuer browser origin: `http://localhost:5173`

The browser origin must exactly match `http://localhost:5173`. Do not add a
teammate laptop's Tailscale address to CORS. CORS uses exact configured origins
and never `*`. CORS is a browser policy, not authentication; the temporary
issuer endpoints are instead hidden whenever `NODE_ENV=production`.

## Safe checks

Expected endpoints:

- `GET /health` — public safe liveness envelope.
- `GET /issuer/dashboard/connection-summary` — development/test-only AU
  connection summary; temporarily no issuer login.
- `GET /issuer/programs?facultyCode=VMES` — active program options for issuer
  filters; keep `programCode` internal and display the human-readable fields.
- `GET /issuer/students` — development/test-only paginated student search.
- `GET /issuer/students/:studentNumber/academic-review` — safe enrollment and
  graduation review.
- `GET /issuer/students/:studentNumber/academic-preview` — read-only terms,
  courses, grades, GPA, and credits; no transcript document or credential.
- `GET /issuer/graduating-students` — exact graduation/faculty/program filter.
- `POST /issuer/students/wallet-eligibility:resolve` — verified/not-verified AU
  connection status only.

The temporary issuer read endpoints require no login in development/test and
are hidden with HTTP 404 in production. Do not add a frontend sign-in gate for
this controlled test. They still call NestJS only; never add Supabase keys or
direct table access to the frontend.

Student provider APIs remain protected by a Bearer token:

- `GET /issuer-providers`
- `GET /issuer-connections/me`
- `GET /issuer-connections/:issuerCode`
- `POST /issuer-connections/:issuerCode/verification-requests`
- `GET /onboarding-verification/requests/me` — current-wallet compatibility
  view over the AU connection.
- `POST /onboarding-verification/requests` — current-wallet compatibility
  submission through the same automatic AU verification transaction.

Dashboard activity represents only a verified AU academic connection. Never
display personal-email wallet creation as identified student activity, and do
not add student names, admission numbers, dates of birth, emails, passport
information, internal IDs, or transcript fields to this dashboard response.

The dedicated pre-issuance endpoints may return the documented student number,
name, program, academic status, graduation summary, course results, GPA, and
credits needed for issuer review. They still never return date of birth, email,
passport/HMAC values, internal IDs, DIDs, document verification values,
credentials, or database secrets.
