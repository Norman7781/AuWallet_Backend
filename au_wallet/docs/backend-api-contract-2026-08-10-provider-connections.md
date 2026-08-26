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

## Temporary issuer pre-issuance academic reads

The following read-only endpoints support student lookup, academic review, and
selection before Member 3 credential work begins. Like the temporary dashboard
summary, they are available without issuer login only when `NODE_ENV` is
`development` or `test`; production hides them with HTTP 404. They must never
be made public in production, and CORS is not an authentication boundary.

All queries are executed by NestJS with the server-side Supabase service. The
browser receives no database key and has no direct table grant. Responses omit
date of birth, email, passport/HMAC values, internal database/Auth/holder/
provider/connection/enrollment IDs, DIDs, document verification values, and
credential material.

### `GET /issuer/programs?facultyCode=VMES`

Returns active program options for the exact requested faculty, ordered by
major. The frontend keeps `programCode` as the dropdown value and displays
`degreeName — major`, followed by the concentration when it is non-null.

```json
{
  "data": {
    "programs": [
      {
        "facultyCode": "VMES",
        "facultyName": "Vincent Mary School of Engineering, Science and Technology",
        "programCode": "SYN-VMES-CS",
        "degreeName": "Bachelor of Science",
        "major": "Computer Science",
        "majorConcentration": null
      }
    ]
  },
  "message": "Issuer program options loaded.",
  "meta": {}
}
```

### `GET /issuer/students?q=&page=1&pageSize=25`

`q` searches the student number, first name, or last name. `pageSize` is 1–100.

```json
{
  "data": {
    "students": [
      {
        "studentNumber": "<student-number>",
        "fullName": "Synthetic Student",
        "facultyCode": "VMES",
        "facultyName": "Vincent Mary School of Engineering, Science and Technology",
        "programCode": "SYN-VMES-CS",
        "degreeName": "Bachelor of Science",
        "major": "Computer Science",
        "majorConcentration": null,
        "academicStatus": "graduated",
        "graduationDate": "2025-05-24",
        "graduationClass": 52,
        "walletEligibility": "not_verified"
      }
    ]
  },
  "message": "Issuer students loaded.",
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /issuer/students/:studentNumber/academic-review`

Returns the selected student's safe identity label, latest enrollment/program,
graduation summary when present, and verified-AU wallet eligibility. Active
students without a graduation record have null graduation/GPA summary fields.

```json
{
  "data": {
    "studentNumber": "<student-number>",
    "fullName": "Synthetic Student",
    "facultyCode": "VMES",
    "facultyName": "Vincent Mary School of Engineering, Science and Technology",
    "programCode": "SYN-VMES-CS",
    "degreeName": "Bachelor of Science",
    "major": "Computer Science",
    "majorConcentration": null,
    "academicStatus": "graduated",
    "graduationDate": "2025-05-24",
    "graduationClass": 52,
    "walletEligibility": "not_verified",
    "admissionDate": "2021-06-07",
    "requiredCredits": 132,
    "creditSummary": {
      "completed": 132,
      "transferred": 0,
      "earned": 132
    },
    "cumulativeGpa": 3.59,
    "graduationStatus": "completed",
    "requirementsFulfilled": true,
    "award": null
  },
  "message": "Student academic review loaded.",
  "meta": {}
}
```

### `GET /issuer/students/:studentNumber/academic-preview`

Returns read-only course results grouped by academic term. It does not return a
transcript document, document/verification number, credential payload, or
signature. Transfer results without an academic term appear in
`unassignedResults`.

```json
{
  "data": {
    "studentNumber": "<student-number>",
    "cumulativeGpa": 3.59,
    "totalEarnedCredits": 132,
    "transferCredits": 0,
    "terms": [
      {
        "termCode": "2025/02",
        "termLabel": "Academic Year 2025 Semester 2",
        "academicYear": 2025,
        "semesterNo": 2,
        "gpa": 3.5,
        "earnedCredits": 6,
        "courses": [
          {
            "courseCode": "CSX0001",
            "courseTitle": "Synthetic Course",
            "credits": 3,
            "grade": "A",
            "resultType": "normal"
          }
        ]
      }
    ],
    "unassignedResults": []
  },
  "message": "Student academic preview loaded.",
  "meta": {}
}
```

### `GET /issuer/graduating-students`

Required query fields are `facultyCode`, `programCode`, and a
graduation-period filter:

- `graduationYear=YYYY&graduationMonth=MM` loads one month-year period in one
  request. This is the preferred batch-selection contract.
- `graduationYear=YYYY` remains a temporary compatibility path for a whole-year
  search.
- `graduationDate=YYYY-MM-DD` remains available for an exact-date search.

Do not combine `graduationDate` with `graduationYear` or `graduationMonth`.
`programCode` is used instead of a separate `majorCode`. The response uses the
same safe student-summary fields as the student list, including the full
`graduationDate`, `graduationClass`, and each student's `walletEligibility`; it
is limited to 100 matches.

Example batch request:

```http
GET /issuer/graduating-students?graduationYear=2025&graduationMonth=5&facultyCode=VMES&programCode=SYN-VMES-CS
```

```json
{
  "data": {
    "students": []
  },
  "message": "Graduating students loaded.",
  "meta": {
    "total": 0
  }
}
```

### `POST /issuer/students/wallet-eligibility:resolve`

The request accepts 1–100 student numbers. Unknown student numbers deliberately
return `not_verified`, the same as a known student without a verified AU
connection, so the endpoint cannot be used to discover identities.

```json
{
  "studentNumbers": ["<student-number>", "<unknown-number>"]
}
```

```json
{
  "data": {
    "results": [
      {
        "studentNumber": "<student-number>",
        "status": "verified"
      },
      {
        "studentNumber": "<unknown-number>",
        "status": "not_verified"
      }
    ]
  },
  "message": "Wallet eligibility resolved.",
  "meta": {}
}
```

Stable errors are HTTP 400 `VALIDATION_ERROR`, HTTP 404
`ISSUER_STUDENT_NOT_FOUND`, and HTTP 503
`ISSUER_ACADEMIC_DATA_UNAVAILABLE`. Production returns the generic HTTP 404
`NOT_FOUND` before any repository read.

These endpoints stop before the final issue action. They do not create a
transcript document or credential, sign anything, perform DID operations, or
deliver anything to a wallet.

## Development CORS and private-network testing

Use the exact development origin:

```dotenv
ISSUER_UI_ORIGIN=http://localhost:5173
```

The issuer frontend uses:

```dotenv
VITE_API_BASE_URL=http://<backend-tailscale-ip>:3000
```

Use the backend Mac's current private Tailscale IPv4 address in place of the
placeholder; do not use the issuer laptop's or wallet phone's own address and
do not commit a currently observed address. Run the issuer Vite server with
`npm run dev -- --port 5173 --strictPort`. Origins remain an exact allow list;
wildcard CORS is not enabled. See
`issuer-dashboard-private-network-testing.md` for the controlled runbook.

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

### Authentication email rate limit

`POST /auth/register` and `POST /auth/resend-confirmation` translate the
Supabase email-delivery limit into the same safe wallet contract. The backend
does not return the upstream provider message:

```json
{
  "error": {
    "code": "AUTH_EMAIL_RATE_LIMITED",
    "message": "Too many confirmation emails were requested. Please wait before trying again.",
    "details": []
  }
}
```

The status is HTTP 429. The wallet must not retry automatically or invent a
countdown when the response does not provide `Retry-After`.

## GET /issuer-providers

Returns exactly the current backend-managed prototype catalogue for the
wallet's Trusted Services UI. This is database-backed issuer discovery, not an
external trust registry. The authenticated wallet calls NestJS; it never reads
the provider table directly. Example item:

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

The wallet should use `issuerCode` as the stable selection value and may keep
local artwork keyed by that code. Provider `availability` and the holder's
`connectionStatus` are separate fields so a coming-soon provider is never
mistaken for a disconnected provider.

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

## Current-wallet compatibility routes

- `POST /onboarding-verification/requests`
- `GET /onboarding-verification/requests/me`

These authenticated student routes temporarily preserve the current wallet's
old response vocabulary while using the same corrected automatic AU
verification transaction as the issuer-connection routes. They do not restore
manual review, document upload, holder activation, or the retired onboarding
lifecycle.

The POST accepts the same three-factor body documented above. It may return a
terminal result immediately. The GET and POST translate only:

- corrected `verified` to wallet `matched`;
- corrected `rejected` to wallet `rejected` with
  `IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED`;
- a real active verification to wallet `under_review`;
- no connection or `disconnected` to HTTP 404 `NOT_FOUND`.

An existing verified connection continues to return `matched`. An active
attempt returns HTTP 409 `ONBOARDING_REQUEST_ACTIVE`. The compatibility
response contains only `onboardingRequestId`, `verificationStatus`, the safe
generic `rejectionReason`, `reviewedAt`, and `submittedAt`. It never returns
passport/HMAC values or holder, provider, connection, enrollment, Auth, or
academic database IDs.

This implementation stops at a verified connection. It does not retrieve a
transcript, construct/sign/issue a credential, store a credential, upload a
passport document, or discover external trust registries. The provider
catalogue is a controlled prototype fixture, not a decentralized trusted list.
