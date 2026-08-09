# AU Wallet Backend API Contract: August 7 Frontend Integration Subset

> Historical contract: the account-opening/onboarding meaning in this document
> is superseded by the August 10 provider-connection contract. The historical
> onboarding endpoints are no longer wired into the active module, and AU
> verification no longer activates or disables a wallet account. See
> `backend-api-contract-2026-08-10-provider-connections.md`.

Target integration date: 2026-08-07

This document describes the August 7 frontend integration subset implemented by
the NestJS backend. It is not an exhaustive list of every backend route. Both
clients call NestJS only and must not call the Supabase Data API directly.

Base URL when both backend and frontend run on the same computer:
`http://localhost:3000`

`localhost` on a physical phone refers to the phone, not the developer's
computer. A physical wallet device therefore needs a backend address reachable
over the LAN or a deployed backend address. A shared HTTPS backend is
recommended for team integration.

## Shared HTTP rules

Protected routes use:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Successful requests use one envelope:

```json
{
  "data": {},
  "message": "Safe message",
  "meta": {}
}
```

Errors use one envelope:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe user-facing message",
    "details": []
  }
}
```

The clients must branch on `error.code`, not on the human-readable message.

Common status codes:

| HTTP | Default code                        | Meaning                                                              |
| ---- | ----------------------------------- | -------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                  | The body, path parameter, or query parameter is invalid.             |
| 401  | `AUTHENTICATION_REQUIRED`           | Authentication is required for a non-token-specific failure.         |
| 403  | `FORBIDDEN`                         | The authenticated role cannot perform the action.                    |
| 404  | `NOT_FOUND`                         | The requested record does not exist or is not available.             |
| 409  | `CONFLICT` or a specific code below | Current workflow state prevents the action.                          |
| 500  | `INTERNAL_ERROR`                    | A safe unexpected-error response; internal details are not returned. |
| 503  | `SERVICE_UNAVAILABLE`               | A required backend dependency is temporarily unavailable.            |

Authentication-specific errors:

| HTTP | Code                               | Meaning                                                                               | Frontend behavior                                                           |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 400  | `REGISTRATION_FAILED`              | Registration could not be completed for a safe, non-duplicate authentication failure. | Show a generic failure and allow retry; never display raw Supabase details. |
| 401  | `EMAIL_NOT_CONFIRMED`              | Login requires email confirmation.                                                    | Ask the user to confirm the email before logging in.                        |
| 401  | `INVALID_CREDENTIALS`              | The supplied login credentials are invalid.                                           | Show one generic invalid email/password message.                            |
| 409  | `EMAIL_ALREADY_REGISTERED`         | Registration found an existing account for the email.                                 | Offer login or confirmation resend instead of registration.                 |
| 401  | `ACCESS_TOKEN_INVALID_OR_EXPIRED`  | The access token is missing, invalid, or expired.                                     | Refresh if possible; otherwise return to login.                             |
| 401  | `REFRESH_TOKEN_INVALID_OR_EXPIRED` | The refresh token is invalid, expired, or unusable.                                   | Clear the local session and return to login.                                |
| 403  | `ACCOUNT_DISABLED`                 | The holder account cannot currently be used.                                          | Block use and show a controlled account-disabled message.                   |

Raw Supabase Auth messages are never part of the API contract. Login failures
do not reveal whether an unknown email is registered.

## Roles

| Role           | Intended client | Access in this contract                                     |
| -------------- | --------------- | ----------------------------------------------------------- |
| `student`      | Wallet UI       | Own authentication, holder account, and onboarding request. |
| `issuer_staff` | Issuer UI       | Review queue, request details, approve, and reject.         |
| `admin`        | Issuer UI       | Same onboarding-review routes as issuer staff.              |

Roles come from server-controlled Supabase Auth `app_metadata`. A client-provided role is never trusted.

## Authentication routes

These routes are shared by both clients where their role permits login.

### `POST /auth/register`

Role: public. Creates a student Auth user and pending holder account. Supabase
sends its standard confirmation-link email. The student clicks the link,
manually returns to the wallet, and then logs in. Registration does not provide
an authenticated session.

```json
{
  "firstName": "<fictional-first-name>",
  "lastName": "<fictional-last-name>",
  "personalEmail": "<fictional-email>",
  "password": "<user-entered-password>"
}
```

```json
{
  "data": {
    "authUserId": "<auth-user-id>",
    "holderAccountId": 12,
    "email": "<fictional-email>",
    "role": "student",
    "accountStatus": "pending"
  },
  "message": "Registration successful. Check your email to confirm your account, then return to the wallet and log in.",
  "meta": {}
}
```

Password validation requires at least eight characters, including an uppercase letter, lowercase letter, and number.

The August 7 test uses Supabase's default confirmation-link email template
without customization. No email OTP, application callback page, localhost
redirect, or mobile deep link is part of this flow.

The default Supabase mailer is appropriate only for limited testing. Without
custom SMTP, it sends only to addresses belonging to members of the project's
Supabase organization, is strongly rate-limited, and has no delivery SLA.
No custom template or SMTP setup is required for this limited test when those
restrictions are acceptable.

### `POST /auth/resend-confirmation`

Role: public. Optional action when the student did not receive the first signup
confirmation message. It sends the standard signup-confirmation email without
an application-specific redirect.

```json
{
  "email": "<fictional-email>"
}
```

```json
{
  "data": null,
  "message": "If the account is awaiting confirmation, a new email has been sent.",
  "meta": {}
}
```

### `POST /auth/login`

Role: public. Used by students, issuer staff, and admins.

```json
{
  "email": "<fictional-email>",
  "password": "<user-entered-password>"
}
```

```json
{
  "data": {
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresAt": 0,
    "user": {
      "authUserId": "<auth-user-id>",
      "holderAccountId": 12,
      "email": "<fictional-email>",
      "role": "student",
      "accountStatus": "pending"
    }
  },
  "message": "Login successful",
  "meta": {}
}
```

For issuer staff and admins, `holderAccountId` and `accountStatus` are `null`.
`expiresAt` is Unix time in seconds.

### `POST /auth/refresh`

Role: public with a valid refresh token.

```json
{
  "refreshToken": "<refresh-token>"
}
```

The response has the same `data` shape as login and returns a refreshed token
pair. After every successful refresh, the frontend must replace both its access
token and refresh token. When a protected request fails with
`ACCESS_TOKEN_INVALID_OR_EXPIRED`, the frontend may refresh and retry that
protected request once. It must not enter an unlimited refresh/retry loop.

### `POST /auth/logout`

Role: any authenticated user.

Request body: none.

```json
{
  "data": null,
  "message": "Logout successful",
  "meta": {}
}
```

### `GET /auth/me`

Role: any authenticated user.

```json
{
  "data": {
    "supabaseAuthId": "<auth-user-id>",
    "holderAccountId": 12,
    "email": "<fictional-email>",
    "role": "student",
    "accountStatus": "pending"
  },
  "message": "Request completed successfully.",
  "meta": {}
}
```

## Wallet routes

Wallet frontend order:

```text
POST /auth/register
→ student clicks the standard Supabase confirmation link
→ student manually returns to the wallet
→ POST /auth/login
→ POST /onboarding-verification/requests
→ GET /onboarding-verification/requests/me
```

If the first email is not received, the wallet may call
`POST /auth/resend-confirmation` before the student follows the confirmation
link.

### `GET /holder-accounts/me`

Role: authenticated holder.

```json
{
  "data": {
    "holderAccountId": 12,
    "authUserId": "<auth-user-id>",
    "universityEmail": null,
    "personalEmail": "<fictional-email>",
    "accountStatus": "pending",
    "confirmedAt": null,
    "createdAt": "<timestamp>",
    "updatedAt": "<timestamp>"
  },
  "message": "Request completed successfully.",
  "meta": {}
}
```

### `POST /onboarding-verification/requests`

Role: `student` with a holder account. A pending holder may submit.

```json
{
  "admissionNo": "<fictional-admission-number>",
  "dateOfBirth": "YYYY-MM-DD",
  "passportNumber": "<holder-entered-passport-identifier>"
}
```

The passport value is normalized and HMACed only in trusted backend code. It is not stored or logged raw and is never returned.

Exact identity plus exactly one eligible enrollment creates `under_review`, stores the candidate enrollment internally, and keeps the holder pending. A mismatch or ambiguous match also creates `under_review`, but without a candidate. An exact ineligible enrollment creates `rejected`.

```json
{
  "data": {
    "onboardingRequestId": 101,
    "verificationStatus": "under_review",
    "rejectionReason": null,
    "reviewedAt": null,
    "submittedAt": "<timestamp>"
  },
  "message": "Onboarding request submitted for issuer review.",
  "meta": {}
}
```

Specific conflict:

| Code                        | Meaning                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `ONBOARDING_REQUEST_ACTIVE` | The holder already has a submitted, under-review, or matched request. |

A rejected request does not prevent the holder from correcting the supplied values and submitting again.

### `GET /onboarding-verification/requests/me`

Role: `student` with a holder account.

Returns the same safe onboarding-request shape as submission. It never returns the submitted passport, passport HMAC, candidate enrollment ID, or matching diagnostics.
When the holder has no onboarding request, it returns HTTP 404 with code
`NOT_FOUND`.

## Issuer routes

All issuer routes require `issuer_staff` or `admin`.

Issuer frontend order:

```text
POST /auth/login
→ GET /issuer/onboarding-requests
→ GET /issuer/onboarding-requests/:id
→ PATCH /issuer/onboarding-requests/:id/decision
```

### `GET /issuer/onboarding-requests?page=1&limit=20`

Returns under-review requests only. `page` starts at 1. `limit` is 1 through 100.

```json
{
  "data": [
    {
      "onboardingRequestId": 101,
      "holderAccountId": 12,
      "admissionNo": "<fictional-admission-number>",
      "dateOfBirth": "YYYY-MM-DD",
      "verificationStatus": "under_review",
      "systemMatch": "exact_eligible_candidate",
      "canApprove": true,
      "academicReview": {
        "studentName": "<fictional-student-name>",
        "admissionNo": "<fictional-admission-number>",
        "dateOfBirth": "YYYY-MM-DD",
        "degreeName": "<degree-name>",
        "major": "<major>",
        "majorConcentration": null,
        "admissionDate": "YYYY-MM-DD",
        "academicStatus": "studying",
        "officialGraduationDate": null
      },
      "reviewedAt": null,
      "rejectionReason": null,
      "submittedAt": "<timestamp>"
    }
  ],
  "message": "Onboarding review queue loaded.",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

`academicReview` is `null` for a mismatch, ambiguous match, missing candidate, or stale candidate. It contains only the limited review fields shown above. Grades, GPA, transcripts, emails, passport values, and passport HMACs are not returned.

### `GET /issuer/onboarding-requests/:id`

Returns one request using the same item shape as the list.

### `PATCH /issuer/onboarding-requests/:id/decision`

Approve:

```json
{
  "decision": "approve"
}
```

`canApprove: true` means the request currently has a submission-time exact eligible candidate available for issuer review. It is not the final identity-verification result. When Approve is executed, the backend RPC definitively revalidates the stored admission number, date of birth, passport HMAC, and sole eligible enrollment inside the same transaction that completes the review and activates the holder.

A successful approval atomically changes the onboarding request to `matched`,
changes the holder account to `active`, and sets the holder's `confirmedAt`.
The issuer approval response reports the onboarding review result and does not
include holder-account status. The wallet obtains the resulting holder state
through `GET /holder-accounts/me`.

Reject:

```json
{
  "decision": "reject",
  "rejectionReason": "IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED"
}
```

Rejection is allowed for an under-review request and leaves the holder pending.
For an exact candidate, the candidate enrollment may be preserved internally as review history. A rejected row does not own the active-candidate uniqueness slot, so a corrected resubmission can proceed. The internal enrollment ID is never returned to either frontend.

Specific conflicts:

| Code                     | Meaning                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `REVIEW_NOT_APPROVABLE`  | Match is absent, ambiguous, stale, ineligible, or cannot be independently revalidated.   |
| `REVIEW_ALREADY_DECIDED` | Another reviewer already approved/rejected the request, or it is no longer under review. |

## Status meanings

| Request status | Meaning                                                                                                                                                                     | Holder effect                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `under_review` | Waiting for an issuer decision. `canApprove` distinguishes an available exact eligible candidate from an unconfirmed match; definitive revalidation occurs during approval. | Remains `pending`.                                     |
| `matched`      | Issuer approved an independently revalidated exact eligible match.                                                                                                          | Changes atomically to `active`; `confirmed_at` is set. |
| `rejected`     | Ineligible enrollment or issuer rejection.                                                                                                                                  | Remains `pending`; corrected resubmission is allowed.  |

Eligible academic statuses are `studying`, `graduated`, and `alumni`. `withdrawn` is ineligible. Official graduation date is read only from `academic.graduation_record`; the holder never submits it.

## Integration safety notes

- Store browser access tokens in memory for this development integration; do not place them in examples or source control.
- Never log passwords, tokens, passport inputs, normalized passport values, passport HMACs, HMAC secrets, or Supabase secret keys.
- Do not infer a failed matching factor from a generic review result.
- Password recovery is postponed and is not part of this frontend integration
  subset. No React Native password-recovery callback has been approved.
