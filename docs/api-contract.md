# Pulse Health mock API contract

The mock HTTP API lives in `apps/mock-api` (FastAPI, Python 3.12). This contract is
**frozen**: field names, status codes and error codes below are what clients may rely on.

```bash
cd apps/mock-api
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000     # serves http://localhost:8000/api/...
.venv/bin/pytest                               # test suite
.venv/bin/ruff check .                         # lint
```

Everything is served under the `/api` prefix. Interactive schema: `/docs`, `/openapi.json`.

## Conventions

- JSON keys are **camelCase**.
- All timestamps are UTC ISO 8601 with second precision and a `Z` suffix: `2026-08-03T09:00:00Z`.
- Collection endpoints return a **bare JSON array**, never a wrapper object.
- Every non-2xx response uses the single error envelope described below.
- State is persisted to `apps/mock-api/data/store.json` (gitignored) on every mutation, so it
  survives a process restart. Delete the file, or call `POST /api/dev/reset`, to reseed.

## Data shapes

### Provider

```json
{
  "id": "prv_001",
  "name": "Dr. Alice Nguyen",
  "specialty": "Primary Care",
  "credentials": "MD",
  "locationName": "Pulse Health Downtown",
  "bio": "Dr. Nguyen has practiced primary care..."
}
```

`bio` is free text entered by a care coordinator for the public Provider Directory profile; it
is additive to this contract (added after the initial appointments-only cut) and is never
included in the `provider` object embedded in an `Appointment` — see `ProviderSummary` below,
which intentionally omits it along with `credentials`.

### VisitType

```json
{ "id": "in_person", "label": "In person", "durationMinutes": 30 }
```

`id` is exactly one of `in_person`, `video`, `phone`.

### Slot

```json
{
  "id": "slt_prv_001_20260803T0900",
  "providerId": "prv_001",
  "startsAt": "2026-08-03T09:00:00Z",
  "endsAt": "2026-08-03T09:30:00Z",
  "isBooked": false
}
```

Slot ids follow `slt_{providerId}_{yyyyMMdd}T{HHmm}`, but treat them as opaque strings.
Every slot is 30 minutes long.

### Appointment

```json
{
  "id": "apt_001",
  "providerId": "prv_001",
  "provider": {
    "id": "prv_001",
    "name": "Dr. Alice Nguyen",
    "specialty": "Primary Care",
    "locationName": "Pulse Health Downtown"
  },
  "slotId": "slt_prv_001_20260803T0900",
  "startsAt": "2026-08-03T09:00:00Z",
  "endsAt": "2026-08-03T09:30:00Z",
  "status": "scheduled",
  "visitType": "in_person",
  "reason": "Annual physical",
  "cancellable": true,
  "createdAt": "2026-08-01T12:00:00Z",
  "updatedAt": "2026-08-01T12:00:00Z"
}
```

- `status` is exactly one of `scheduled`, `completed`, `cancelled`.
- The embedded `provider` is a projection **without** `credentials`.
- `cancellable` is computed per request: `true` only when `status == "scheduled"` **and**
  `startsAt` is in the future.
- `startsAt` / `endsAt` are copied from the booked slot, so they always span 30 minutes.
  `visitType.durationMinutes` is display metadata only and does not change `endsAt`.

## Endpoints

| Method | Path | Success | Body / query |
| --- | --- | --- | --- |
| GET | `/api/health` | 200 | `{status, service, version, time}` |
| GET | `/api/providers` | 200 | `Provider[]` |
| GET | `/api/providers/{id}` | 200 | `Provider` |
| GET | `/api/visit-types` | 200 | `VisitType[]` |
| GET | `/api/slots` | 200 | `Slot[]`, see filters |
| GET | `/api/appointments` | 200 | `Appointment[]`, see filters |
| GET | `/api/appointments/{id}` | 200 | `Appointment` |
| POST | `/api/appointments` | **201** | `{providerId, slotId, visitType, reason}` |
| PATCH | `/api/appointments/{id}` | 200 | `{slotId}` — this is reschedule |
| POST | `/api/appointments/{id}/cancel` | 200 | no body |
| POST | `/api/dev/reset` | 200 | `{"status":"reset"}` |
| POST | `/api/telemetry` | **204** | `{source, level, message, route?, requestId?, errorCode?}` — frontend logging/error reporting, not a domain resource |

### GET /api/slots

| Query | Type | Default | Meaning |
| --- | --- | --- | --- |
| `providerId` | string | — | exact provider match |
| `from` | ISO datetime | — | inclusive lower bound on `startsAt` |
| `to` | ISO datetime | — | inclusive upper bound on `startsAt` |
| `includeBooked` | boolean | `false` | when false, only `isBooked == false` slots |

- Slots that start in the past are **never** returned, regardless of `includeBooked`.
- Always sorted by `startsAt` ascending.
- An unknown `providerId` yields `[]` (not a 404).
- `from`/`to` without an offset are interpreted as UTC. Unparseable values give
  `VALIDATION_ERROR` 422 with `field` `"from"` / `"to"`.

### GET /api/appointments

| Query | Type | Meaning |
| --- | --- | --- |
| `scope` | `upcoming` \| `past` | omit for all appointments |
| `status` | `scheduled` \| `completed` \| `cancelled` | single value or repeated |
| `visitType` | `in_person` \| `video` \| `phone` | single value or repeated |
| `providerId` | string | exact provider match |

- `upcoming` = `status == "scheduled"` **and** `startsAt >= now`, sorted `startsAt` **ascending**.
- `past` = everything else (`startsAt < now`, or status `completed` / `cancelled`), sorted
  `startsAt` **descending**.
- The two scopes partition the full list; omitting `scope` returns all of them sorted
  `startsAt` ascending.
- Repeated params behave as OR (`?status=completed&status=cancelled`); different params AND
  together.
- Unknown values for `scope`, `status` or `visitType` are `VALIDATION_ERROR` 422 (never a 500),
  with `field` naming the offending param. Unknown `providerId` yields `[]`.

## Error envelope

Every non-2xx response body is exactly:

```json
{
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "That time slot has just been taken. Please pick another.",
    "field": "slotId"
  }
}
```

`field` is `null` when the problem is not tied to a single field. `message` is human readable
and safe to render in a UI. This applies to framework-level failures too: malformed JSON,
missing body fields, wrong types, unknown routes (404) and wrong methods (405) are all
translated into this envelope.

| Code | HTTP | Raised when |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | missing/blank/too short/too long `reason`, unknown `visitType`, unknown filter value, malformed body, slot that does not belong to the given provider |
| `SLOT_IN_PAST` | 422 | target slot `startsAt <= now` |
| `SLOT_ALREADY_BOOKED` | 409 | target slot already has `isBooked == true` |
| `APPOINTMENT_NOT_CANCELLABLE` | 409 | cancelling an appointment whose status is `completed` or `cancelled` |
| `APPOINTMENT_NOT_RESCHEDULABLE` | 409 | rescheduling an appointment whose status is `completed` or `cancelled` |
| `NOT_FOUND` | 404 | unknown appointment (`field: "id"`), slot (`field: "slotId"`), provider (`field: "providerId"`), or unknown route (`field: null`) |

## Business rules

1. A slot whose `startsAt` is in the past cannot be booked -> `SLOT_IN_PAST`.
2. A slot cannot be booked twice -> `SLOT_ALREADY_BOOKED`.
3. `reason` is required and trimmed server-side; min 3 and max 500 characters after trimming
   -> `VALIDATION_ERROR` with `field: "reason"`. The response echoes the trimmed value.
4. `completed` and `cancelled` appointments cannot be cancelled -> `APPOINTMENT_NOT_CANCELLABLE`.
5. Cancelling a `scheduled` appointment sets `status: "cancelled"` and frees its slot
   (`isBooked: false`), so the slot reappears in `GET /api/slots` and can be booked again.
6. Rescheduling is only allowed while `status == "scheduled"`. It frees the old slot and books
   the new one atomically; the new slot must satisfy rules 1 and 2.
7. Booking a slot that belongs to a different provider than `providerId` ->
   `VALIDATION_ERROR` with `field: "slotId"`.
8. Every mutation is written to `data/store.json`, so state survives a process restart. A failed
   mutation leaves nothing behind: the slot stays free and no appointment is created.

### Validation order (matters when several rules could fire)

For `POST /api/appointments`: body shape -> `reason` -> `visitType` -> provider exists ->
slot exists -> slot belongs to provider -> slot in the past -> slot already booked.
So booking another provider's *past* slot returns `VALIDATION_ERROR`, not `SLOT_IN_PAST`.

For `PATCH /api/appointments/{id}`: appointment exists -> reschedulable -> slot exists ->
slot belongs to the appointment's provider -> slot in the past -> slot already booked.

### Client-visible nuances

- **Rescheduling onto the appointment's current slot returns 409 `SLOT_ALREADY_BOOKED`**, because
  rule 2 is evaluated while the appointment still holds that slot. Skip the request client-side
  when the selected slot equals the current `slotId`.
- `cancellable` is `false` for a `scheduled` appointment that has already started, but
  `POST /{id}/cancel` still succeeds for it: 409 is reserved for `completed` and `cancelled`
  (rule 4). Use `cancellable` to drive the UI, not to predict a 409.
- `POST /api/appointments` returns **201**, the other mutations return 200.
- Appointment ids are `apt_###` and increment from the highest existing id; the first booking
  on a freshly seeded store is `apt_007`.
- `POST /api/dev/reset` rebuilds providers, slots and appointments from scratch relative to the
  current time, so slot ids and appointment ids change. Re-fetch everything afterwards.

## Seed data

`app/seed.py` builds the dataset relative to "now" at reset time, so the demo always has
genuinely future slots.

- Providers: `prv_001` Dr. Alice Nguyen (Primary Care, Pulse Health Downtown), `prv_002`
  Dr. Marcus Bell (Dermatology, Pulse Health Riverside), `prv_003` Dr. Priya Raman
  (Pediatrics, Pulse Health Northgate), `prv_004` Samuel Okafor (Behavioral Health,
  Pulse Health Virtual Care).
- Future slots: every weekday within the next 14 calendar days, 09:00 to 16:30 UTC in
  30-minute steps, for all four providers (~640 slots).
- Past slots: every weekday within the previous 14 calendar days at 09:00, 11:00, 14:00 and
  15:30 UTC. They exist to back the seeded history and are never returned by `GET /api/slots`.
- Appointments: `apt_001`-`apt_003` upcoming and `scheduled` (prv_001 `in_person`, prv_002
  `video`, prv_004 `phone`), `apt_004`-`apt_005` `completed` in the past, `apt_006` `cancelled`
  in the past. Slots of scheduled and completed appointments are `isBooked: true`; the
  cancelled one's slot is free, matching rule 5.

## Configuration

Settings come from `app/config.py` (pydantic-settings, `APP_` prefix, optional `.env`):

| Setting | Env var | Default |
| --- | --- | --- |
| `name` | `APP_NAME` | `pulse-health-api` |
| `version` | `APP_VERSION` | `0.1.0` |
| `cors_origins` | `APP_CORS_ORIGINS` | `["http://localhost:4200"]` |
| `store_path` | `APP_STORE_PATH` | `data/store.json` |
