# AU Wallet Provider-Connection API Contract: August 10

This contract supersedes the August 7 assumption that AU verification opens or
activates a wallet. A confirmed student logs in to an active, usable empty
wallet first. Provider verification changes only that provider connection.

All browser/mobile clients call NestJS. They never query Supabase application
tables directly. Protected wallet routes require a student Bearer access token
and use the shared `data/message/meta` success envelope and `error` envelope.

## Health

### `GET /health`

Public service-liveness response:

```json
{
  "data": {
    "status": "ok"
  },
  "message": "Service is healthy.",
  "meta": {}
}
```

No environment, database, Supabase, credential, or secret details are exposed.

## Temporary issuer dashboard connection summary

### `GET /issuer/dashboard/connection-summary`

This endpoint is temporarily available without issuer login only when
`NODE_ENV` is `development` or `test`. Production hides it with HTTP 404. CORS
is not its authentication boundary.

```json
{
  "data": {
    "verifiedConnectionCount": 1,
    "recentVerifications": [
      {
        "eventType": "au_connection_verified",
        "programCode": "SYN-VMES-CS",
        "major": "Computer Science",
        "verifiedAt": "2026-08-09T09:00:00.000Z"
      }
    ]
  },
  "message": "Issuer connection summary loaded.",
  "meta": {}
}
```

`verifiedConnectionCount` counts only Assumption University connections whose
connection state is `verified` and whose protected verified enrollment link is
present. Demo/placeholder providers and pending, rejected, or disconnected
connections are excluded. `recentVerifications` contains at most 10 items,
newest `verifiedAt` first. Program code and major are resolved in fixed batched
queries through verified connection → academic enrollment → program.

This response never identifies a student. It does not return a student name,
admission number, date of birth, email, passport/HMAC value, holder/Auth/
provider/connection/enrollment ID, or transcript data. Wallet-account creation
is not an issuer activity because a personal-email account has no verified
academic identity before AU verification.

Transcript counts, transcript retrieval/issuance/analytics, batch issuance,
credential generation, signing, DID operations, and wallet delivery are outside
this Member 1/Member 2 endpoint.

## Development CORS and same-Wi-Fi testing

Use the exact development origin:

```dotenv
ISSUER_UI_ORIGIN=http://localhost:5173
```

The issuer frontend uses:

```dotenv
VITE_API_BASE_URL=http://<current-backend-LAN-IP>:3000
```

Determine the backend machine's current LAN address immediately before each
test; do not assume a previously observed address. Run the issuer Vite server
with `npm run dev -- --port 5173 --strictPort`. Origins remain an exact allow
list; wildcard CORS is not enabled. See `issuer-dashboard-lan-testing.md` for
the controlled runbook.

## Wallet order

1. `POST /auth/register`
2. Student clicks the standard Supabase confirmation link.
3. Student returns to the wallet.
4. `POST /auth/login` — first confirmed login activates the holder once.
5. `GET /issuer-providers`
6. `POST /issuer-connections/assumption-university/verification-requests`
7. `GET /issuer-connections/assumption-university` or
   `GET /issuer-connections/me`

AU verification is optional for entering and using the empty wallet.

## GET /issuer-providers

Returns exactly the current backend-managed prototype catalog. Example item:

```json
{
  "issuerCode": "assumption-university",
  "displayName": "Assumption University",
  "description": "Prototype provider description",
  "availability": "available",
  "connectionEnabled": true,
  "isMock": true,
  "connectionStatus": null
}
```

`demo-issuer-alpha` and `demo-issuer-beta` are synthetic placeholders with
`availability: "coming_soon"` and `connectionEnabled: false`.

## GET /issuer-connections/me

Returns the current holder's connections. An empty array is a valid usable
wallet. Safe connection fields are:

```json
{
  "issuerCode": "assumption-university",
  "displayName": "Assumption University",
  "connectionStatus": "verified",
  "latestVerificationStatus": "matched",
  "rejectionReason": null,
  "submittedAt": "2026-08-10T01:00:00.000Z",
  "reviewedAt": null,
  "verifiedAt": "2026-08-10T01:00:00.000Z"
}
```

Stored connection states are `pending_verification`, `verified`, `rejected`,
and `disconnected`. No row means not connected.

## GET /issuer-connections/:issuerCode

Returns one safe connection record. When no connection exists:

- HTTP 404, `ISSUER_VERIFICATION_NOT_FOUND`.

Unknown provider codes return HTTP 404, `ISSUER_NOT_FOUND`.

## POST /issuer-connections/:issuerCode/verification-requests

Request body for `assumption-university`:

```json
{
  "admissionNo": "<holder-input>",
  "dateOfBirth": "YYYY-MM-DD",
  "passportNumber": "<holder-input>"
}
```

The frontend never sends a holder ID, provider ID, connection ID, applicant
type, university email, graduation date, or document. The backend resolves
ownership from the authenticated user and protects the passport in trusted
memory.

The database atomically revalidates the three factors and requires exactly one
eligible enrollment. An exact studying, graduated, or alumni match returns
request status `matched` and connection status `verified` immediately. A
missing, ambiguous, withdrawn, or otherwise ineligible match returns the same
generic `rejected`/unverified result and does not identify which factor failed.
A rejected attempt may be corrected and resubmitted. A connection already
verified cannot be submitted again.

At most one wallet may verify the same AU academic enrollment. Competing or
later claims by another holder return the same generic `rejected` response;
the API never reveals that an identity is already connected, who owns it, or
any protected database identifier. This expected outcome is a normal 201
verification result, not an HTTP 500.

Submitting to either demo provider returns HTTP 409,
`ISSUER_CONNECTION_NOT_AVAILABLE`.

## Stable issuer-connection errors

| HTTP | Code                                  | Meaning                                               |
| ---- | ------------------------------------- | ----------------------------------------------------- |
| 404  | `ISSUER_NOT_FOUND`                    | Provider code is unknown.                             |
| 409  | `ISSUER_CONNECTION_NOT_AVAILABLE`     | Provider is disabled or coming soon.                  |
| 409  | `ISSUER_CONNECTION_ALREADY_VERIFIED`  | Connection is already verified.                       |
| 409  | `ISSUER_VERIFICATION_ACTIVE`          | An active attempt already exists for this connection. |
| 404  | `ISSUER_VERIFICATION_NOT_FOUND`       | The holder has no matching connection/request.        |
| 409  | `ISSUER_VERIFICATION_NOT_APPROVABLE`  | Candidate is absent, stale, ambiguous, or ineligible. |
| 409  | `ISSUER_VERIFICATION_ALREADY_DECIDED` | Review is no longer pending.                          |

## Verification boundary

Submission performs definitive three-factor and sole-eligible-enrollment
revalidation inside one backend-only database transaction. That transaction
creates or resolves the AU connection, records the terminal attempt, and
changes only:

- the request to `matched` or generic `rejected`;
- the AU connection to `verified` or `rejected`;
- protected enrollment and verification timestamps only for an exact match.

Verification never changes holder-account status or confirmation.
Internal provider/connection IDs, academic IDs, passport input, normalized
passport, passport HMAC, and factor-level mismatch diagnostics are never
returned.

## Superseded routes

- `POST /onboarding-verification/requests`
- `GET /onboarding-verification/requests/me`

These historical wallet-onboarding routes are not wired into the August 10
application module. Wallet frontend code must use the issuer-provider and
issuer-connection routes. The protected issuer-review routes are deprecated
compatibility code, are excluded from this active contract, and are not needed
for automatic AU verification.

This implementation stops at a verified connection. It does not retrieve a
transcript, construct/sign/issue a credential, store a credential, upload a
passport document, discover external issuers, or implement a trusted list.
