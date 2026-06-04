# Go!Gosling Careers System — Backend Specification

> **Audience:** the server team (and their AI server agent) who will implement this backend.
> **Status:** Specification. The frontend (the static marketing site at this repo root) is being
> built to match this contract **exactly**. **Do not rename fields, routes, enums, or table
> columns** — the static site's fetch layer and `data/jobs.json` fallback are keyed to the names
> below.
>
> **Stack (decided):** NestJS (modular monolith) + PostgreSQL (managed) + S3-compatible object
> storage. The marketing frontend is a zero-build static site (HTML/CSS/vanilla JS); it talks to
> this backend over a small public REST surface and falls back to a static JSON file when the API
> is absent (so the site works before this backend exists).
>
> **Brand constraint:** Go!Gosling is privacy-first. This system must collect the minimum PII,
> require explicit consent, never make data public, and honour deletion-on-request. See
> [Security & Privacy](#9-security--privacy).

---

## Table of contents

1. [Overview & request flow](#1-overview--request-flow)
2. [Data model (PostgreSQL)](#2-data-model-postgresql)
   - [Extensions & migrations](#21-extensions--migrations)
   - [CREATE TABLE DDL](#22-create-table-ddl)
   - [Enums & status lifecycles](#23-enums--status-lifecycles)
3. [Public REST API (no auth)](#3-public-rest-api-no-auth)
4. [Admin REST API (auth required)](#4-admin-rest-api-auth-required)
5. [Authentication & RBAC](#5-authentication--rbac)
6. [Admin backend (recruiting dashboard) design](#6-admin-backend-recruiting-dashboard-design)
7. [File storage (resumes)](#7-file-storage-resumes)
8. [Audit logging](#8-audit-logging)
9. [Security & privacy](#9-security--privacy)
10. [Frontend wiring (how the static site talks to this)](#10-frontend-wiring-how-the-static-site-talks-to-this)
11. [Deployment & launch sequence](#11-deployment--launch-sequence)
12. [Appendix: JSON shapes & error codes](#12-appendix-json-shapes--error-codes)

---

## 1. Overview & request flow

The careers system has two faces:

| Face | Audience | Auth | Surface |
|------|----------|------|---------|
| **Public careers** | Candidates on `gogosling.ca/careers.html` | None | `GET` jobs, `POST` application (multipart) |
| **Admin / recruiting** | Internal admins & recruiters at `/admin` | JWT or httpOnly session cookie | Jobs CRUD, applications pipeline, CSV export, resume download |

```
                         ┌────────────────────────────────────────────┐
                         │  Static site (Vercel/Netlify/CF Pages)       │
                         │  careers.html + assets/js/careers.js         │
                         └───────────────┬──────────────────────────────┘
                                         │  window.GOSLING_CAREERS_API
                          (public, CORS) │  e.g. https://api.gogosling.ca
                                         ▼
   ┌────────────────────┐    ┌───────────────────────────────────────────┐
   │ Recruiter / admin   │   │  NestJS API                                 │
   │ browser  ──/admin── │──▶│  ├─ PublicCareersModule  (no auth)          │
   │ (JWT/cookie session)│   │  ├─ AdminAuthModule      (argon2id + JWT)   │
   └────────────────────┘    │  ├─ AdminJobsModule      (RBAC)             │
                             │  ├─ AdminApplicationsModule (RBAC, audit)  │
                             │  └─ StorageModule        (signed URLs)      │
                             └───────┬──────────────────────┬─────────────┘
                                     ▼                      ▼
                            ┌─────────────────┐   ┌────────────────────────┐
                            │ PostgreSQL       │   │ S3-compatible storage   │
                            │ jobs, apps,      │   │ resumes/{slug}/{id}.ext │
                            │ admin_users,     │   │ (private, signed URLs)  │
                            │ application_events│  └────────────────────────┘
                            └─────────────────┘
```

**Candidate apply flow (happy path):**

1. Candidate opens `careers.html`; the page `GET`s the open jobs list and renders cards.
2. Candidate opens a role (`GET /api/careers/jobs/:slug`) and fills the apply form.
3. Browser `POST`s `multipart/form-data` to `/api/careers/applications` (fields + résumé file + `consent=true` + empty honeypot).
4. API validates, stores the résumé in object storage, inserts an `applications` row (`status=new`) and a `created` audit event, returns `201 { ok:true, applicationId }`.
5. Recruiter sees the new application in the dashboard; every status change / note / view writes an `application_events` row.

---

## 2. Data model (PostgreSQL)

### 2.1 Extensions & migrations

Two extensions are required:

- **`citext`** — case-insensitive text, used for email columns so `Ada@x.com` and `ada@x.com` are the same value (unique constraints and lookups become case-insensitive for free).
- **`pgcrypto`** — provides `gen_random_uuid()` for UUID primary-key defaults.

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Migrations:** manage schema with a versioned migration tool — **TypeORM migrations**, **Prisma Migrate**, or **node-pg-migrate** (pick one; do not auto-`synchronize` in production). Each migration is forward-only and reviewed. The `updated_at` columns are maintained by a trigger (below) rather than application code, so partial updates can't forget it. Seed data (the first `admin_users` row and any launch jobs) ships as a separate idempotent seed script, **not** inside a schema migration.

> **Convention:** all timestamps are `timestamptz` stored in UTC. The API serializes them as ISO-8601 strings (`2026-06-04T17:30:00.000Z`).

### 2.2 CREATE TABLE DDL

```sql
-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ============================================================================
-- Enum types (Postgres native enums; alternatively use CHECK constraints)
-- ============================================================================
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'internship');
CREATE TYPE work_mode       AS ENUM ('remote', 'hybrid', 'onsite');
CREATE TYPE job_status      AS ENUM ('draft', 'open', 'closed');
CREATE TYPE application_status AS ENUM
  ('new', 'reviewing', 'interview', 'offer', 'rejected', 'hired');
CREATE TYPE admin_role      AS ENUM ('admin', 'recruiter');
CREATE TYPE application_event_type AS ENUM
  ('created', 'status_changed', 'note_added', 'viewed', 'resume_downloaded');

-- A reusable trigger to keep updated_at honest.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- jobs
-- ============================================================================
CREATE TABLE jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,                       -- e.g. "ios-engineer"
  title           text NOT NULL,
  team            text NOT NULL,                              -- e.g. "Engineering"
  location        text NOT NULL,                              -- e.g. "Toronto, ON / Remote (Canada)"
  employment_type employment_type NOT NULL,
  work_mode       work_mode NOT NULL,
  summary         text NOT NULL,                              -- 1-2 sentences
  description_md  text NOT NULL,                              -- markdown body
  responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,        -- array<text>
  requirements     jsonb NOT NULL DEFAULT '[]'::jsonb,        -- array<text>
  nice_to_have     jsonb,                                     -- array<text>, nullable
  comp_range      text,                                       -- nullable, e.g. "$120k–$160k CAD"
  status          job_status NOT NULL DEFAULT 'draft',
  posted_at       timestamptz,                                -- set when first published; nullable
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_jobs_slug      ON jobs (slug);
CREATE INDEX        idx_jobs_status    ON jobs (status);
CREATE INDEX        idx_jobs_posted_at ON jobs (posted_at DESC NULLS LAST);
-- Hot path: public list = open jobs newest first.
CREATE INDEX idx_jobs_open_posted ON jobs (posted_at DESC) WHERE status = 'open';

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- applications
-- ============================================================================
CREATE TABLE applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  applicant_name     text NOT NULL,
  email              citext NOT NULL,
  phone              text,                                    -- nullable
  links              jsonb NOT NULL DEFAULT '{}'::jsonb,      -- { portfolio, linkedin, github }
  cover_message      text,                                    -- nullable
  resume_object_key  text,                                    -- nullable; object-storage key
  status             application_status NOT NULL DEFAULT 'new',
  recruiter_notes    text,                                    -- nullable
  source             text,                                    -- nullable, e.g. "careers_site"
  consent_at         timestamptz NOT NULL,                    -- applicant consented to processing
  ip_hash            text,                                    -- hashed, NEVER the raw IP
  user_agent         text,                                    -- nullable
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_job_id     ON applications (job_id);
CREATE INDEX idx_applications_status     ON applications (status);
CREATE INDEX idx_applications_email      ON applications (email);
CREATE INDEX idx_applications_created_at ON applications (created_at DESC);

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- admin_users
-- ============================================================================
CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  password_hash text NOT NULL,                                -- argon2id
  role          admin_role NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE UNIQUE INDEX idx_admin_users_email ON admin_users (email);

-- ============================================================================
-- application_events  (append-only audit log)
-- ============================================================================
CREATE TABLE application_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_admin_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,  -- nullable (system/public)
  event_type      application_event_type NOT NULL,
  from_status     application_status,                          -- nullable
  to_status       application_status,                          -- nullable
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_events_application_id ON application_events (application_id, created_at);
CREATE INDEX idx_app_events_actor          ON application_events (actor_admin_id);
```

**Notes on FK delete behaviour:**

- `applications.job_id → jobs ON DELETE RESTRICT`: you cannot delete a job that has applications. The admin "delete job" route must surface this as a `409 conflict` (close it instead, or reassign/export the applications first).
- `application_events.application_id → applications ON DELETE CASCADE`: when an application is deleted (e.g. GDPR/PIPEDA deletion-on-request), its audit rows go with it. (A deletion is itself recorded separately if you keep a tenant-level audit; see [§9](#9-security--privacy).)
- `application_events.actor_admin_id → admin_users ON DELETE SET NULL`: removing an admin must not erase history; the event survives with a null actor.

### 2.3 Enums & status lifecycles

**Job status:** `draft → open → closed`. `posted_at` is `NULL` while `draft`; set to `now()` the first time the job is published, and **not** cleared if it is later closed and re-opened (it reflects "first posted"). The publish/close routes are the only writers of `status`.

```
draft ──publish──▶ open ──close──▶ closed
                    ▲                 │
                    └─────publish─────┘   (re-open allowed; posted_at unchanged)
```

**Application status:** `new → reviewing → interview → offer → hired`, with `rejected` reachable from any non-terminal state.

```
new ─▶ reviewing ─▶ interview ─▶ offer ─▶ hired
  └────────┴────────────┴──────────┴────▶ rejected
```

Every status transition is performed via `PATCH /api/admin/applications/:id { status }` and **must** write a `status_changed` event capturing `from_status`/`to_status`. Do not enforce a rigid state machine on the API (recruiters move applications around); just record the transition.

---

## 3. Public REST API (no auth)

Base path: `/api/careers`. **No authentication.** CORS allowlist = the marketing domain(s) only (see [§9](#9-security--privacy)). All responses are JSON unless noted.

### 3.1 `GET /api/careers/jobs`

Returns **only `status = 'open'`** jobs, sorted `posted_at DESC` (newest first).

**Response `200`:**

```json
{
  "jobs": [
    {
      "id": "0b3f…",
      "slug": "ios-engineer",
      "title": "iOS Engineer",
      "team": "Engineering",
      "location": "Toronto, ON / Remote (Canada)",
      "employmentType": "full_time",
      "workMode": "hybrid",
      "summary": "Build the Go!Gosling iPhone app with us.",
      "descriptionMd": "## About the role\n…",
      "responsibilities": ["Ship SwiftUI features", "…"],
      "requirements": ["3+ years iOS", "…"],
      "niceToHave": ["HealthKit experience"],
      "compRange": "$120k–$160k CAD",
      "postedAt": "2026-06-01T14:00:00.000Z"
    }
  ]
}
```

> **Field naming:** DB columns are `snake_case`; the JSON API is **`camelCase`** (`employmentType`, `workMode`, `descriptionMd`, `niceToHave`, `compRange`, `postedAt`). This mapping is part of the contract — the static site reads these exact keys, and the offline `data/jobs.json` fallback uses the same shape (see [§10](#10-frontend-wiring-how-the-static-site-talks-to-this)). Nullable fields (`niceToHave`, `compRange`) may be `null` or omitted; the frontend treats both as "absent".

### 3.2 `GET /api/careers/jobs/:slug`

Look up a single open job by `slug`.

- **`200`** → `{ "job": Job }` (same shape as the array item above).
- **`404`** → `{ "ok": false, "error": { "code": "not_found", "message": "Job not found" } }` when the slug doesn't exist **or** the job is not `open` (don't leak draft/closed roles publicly).

### 3.3 `POST /api/careers/applications`

Submit an application. **`Content-Type: multipart/form-data`.**

**Form fields:**

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `jobSlug` | ✅ | text | Must resolve to an `open` job. |
| `applicantName` | ✅ | text | 1–120 chars, trimmed. |
| `email` | ✅ | text | Valid email; stored as `citext`. |
| `phone` | — | text | Optional. |
| `portfolio` | — | text (URL) | Folded into `links.portfolio`. |
| `linkedin` | — | text (URL) | Folded into `links.linkedin`. |
| `github` | — | text (URL) | Folded into `links.github`. |
| `coverMessage` | — | text | Optional, max ~5,000 chars. |
| `consent` | ✅ | text | **Must equal the string `"true"`.** Sets `consent_at = now()`. |
| `resume` | — (recommended) | file | `application/pdf`, `.doc`, `.docx`. **Max 8 MB.** |
| `company_website` | ✅ (must be empty) | text | **Honeypot.** If non-empty → silently treat as spam (see below). |

**Server-side handling:**

1. Resolve `jobSlug` → open job, else `404 not_found`.
2. Validate all fields (see rules below). On failure → `400` with field errors.
3. **Honeypot:** if `company_website` is non-empty, respond `201 { ok:true, applicationId:"<random-uuid>" }` **without persisting anything** (don't tell bots they were caught). Optionally increment a spam metric.
4. **Rate limit (per IP):** e.g. **5 submissions / 10 min / IP** and **20 / day / IP**. On exceed → `429 rate_limited`. Compute the limit key from a **hashed** IP, and store only `ip_hash` (HMAC-SHA-256 of IP with a server-side pepper) — never the raw IP.
5. If a résumé file is present: validate content-type + size, then upload to object storage at `resumes/{jobSlug}/{applicationId}.{ext}` and keep only the returned object key. See [§7](#7-file-storage-resumes).
6. Insert the `applications` row (`status='new'`, `consent_at=now()`, `source` defaulting to `"careers_site"`, `ip_hash`, `user_agent`).
7. Insert a `created` `application_events` row.
8. Respond `201 { "ok": true, "applicationId": "<uuid>" }`.

**Validation rules:**

- `applicantName`: required, 1–120 chars after trim.
- `email`: required, RFC-5322-ish, ≤ 254 chars, lowercased for storage (citext handles case).
- `phone`: optional, ≤ 40 chars.
- URL fields (`portfolio`, `linkedin`, `github`): optional; if present must be `http(s)://…`, ≤ 500 chars. Reject `javascript:`/`data:` schemes.
- `coverMessage`: optional, ≤ 5,000 chars; store as-is (treat as untrusted text — never render unescaped in admin UI).
- `consent`: required, must be exactly `"true"`.
- `resume`: optional but recommended; if present, MIME ∈ {`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`} and size ≤ 8 MB. Sniff magic bytes, don't trust the client `Content-Type` alone.

**Error response shape (all public + admin endpoints):**

```json
{
  "ok": false,
  "error": {
    "code": "validation_failed",
    "message": "Some fields need attention.",
    "fields": {
      "email": "Enter a valid email address.",
      "consent": "You must agree before applying."
    }
  }
}
```

`fields` is present only for field-level validation errors. See the [error-code table](#122-error-codes) in the appendix.

---

## 4. Admin REST API (auth required)

Base path: `/api/admin`. **Auth required** on everything except `…/auth/login`. Accept **either** a `Bearer <JWT>` header **or** an httpOnly session cookie (see [§5](#5-authentication--rbac)). All list endpoints follow the [pagination convention](#43-pagination--filtering-convention).

### 4.1 Auth

| Method & path | Body | Result |
|---------------|------|--------|
| `POST /api/admin/auth/login` | `{ email, password }` | `200 { token }` **and** sets httpOnly cookie. argon2id verify. Lockout after **N** (e.g. 5) consecutive failures for that email/IP (e.g. 15 min). Generic error on bad creds (don't reveal which field). Updates `last_login_at`. |
| `POST /api/admin/auth/logout` | — | `204`. Clears the session cookie / revokes the refresh token. |

### 4.2 Jobs CRUD

| Method & path | Role | Description |
|---------------|------|-------------|
| `GET /api/admin/jobs` | admin, recruiter | List **all** jobs (any status). Supports `?status=&q=&page=`. |
| `POST /api/admin/jobs` | admin | Create a job (defaults to `draft`). |
| `GET /api/admin/jobs/:id` | admin, recruiter | Full job by **id** (not slug). |
| `PATCH /api/admin/jobs/:id` | admin | Partial update (any column except `id`/timestamps). |
| `DELETE /api/admin/jobs/:id` | admin | Delete. Returns `409 conflict` if applications reference it (ON DELETE RESTRICT). |
| `POST /api/admin/jobs/:id/publish` | admin | `status → open`; set `posted_at` if currently null. |
| `POST /api/admin/jobs/:id/close` | admin | `status → closed`. |

Job create/update body uses the same **camelCase** field names as the public Job shape (plus `status`). Validate `slug` is unique and URL-safe (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).

### 4.3 Applications

| Method & path | Role | Description |
|---------------|------|-------------|
| `GET /api/admin/applications?jobId=&status=&q=&page=` | admin, recruiter | Paginated list. `q` searches `applicant_name` + `email`. |
| `GET /api/admin/applications/:id` | admin, recruiter | Detail. **Writes a `viewed` audit event** (throttle to once per actor per N minutes to avoid noise). |
| `PATCH /api/admin/applications/:id` | admin, recruiter | Body `{ status?, recruiterNotes? }`. A `status` change writes `status_changed`; a notes change writes `note_added`. |
| `GET /api/admin/applications/:id/resume` | admin, recruiter | **`302`** redirect to a **time-limited signed URL** for the résumé. Writes a `resume_downloaded` event. `404` if no résumé. |
| `GET /api/admin/applications/export.csv?jobId=` | admin | Streams a CSV of applications (optionally filtered by job). Excludes résumé binaries; includes a column with the application id. |

**Pagination & filtering convention** (all admin list endpoints):

- Query: `page` (1-based, default `1`), `pageSize` (default `25`, max `100`), plus endpoint-specific filters (`status`, `jobId`, `q`).
- Response envelope:

```json
{
  "items": [ /* … */ ],
  "page": 1,
  "pageSize": 25,
  "total": 137,
  "totalPages": 6
}
```

- Default sort: `created_at DESC` for applications; `posted_at DESC NULLS LAST, created_at DESC` for jobs.

---

## 5. Authentication & RBAC

**Password hashing:** **argon2id** (e.g. `argon2` npm lib). Suggested params: `memoryCost ≈ 19456 KiB`, `timeCost = 2`, `parallelism = 1` — tune to ~250–500 ms on prod hardware. Never store or log plaintext passwords. There is **no public sign-up**; admin accounts are seeded/created by an existing admin.

**Sessions — support both, same guard:**

- **JWT (Bearer):** short-lived access token (e.g. 15 min) signed with `JWT_SECRET` (HS256) or an RS256 keypair. Claims: `sub` (admin id), `role`, `iat`, `exp`. Use a refresh token (httpOnly cookie) to mint new access tokens; keep a server-side revocation list / token version so logout works.
- **httpOnly session cookie:** for the SSR/SPA admin panel served same-site at `/admin`. Cookie flags: `HttpOnly; Secure; SameSite=Lax` (or `Strict`); short rolling expiry. **Cookie auth requires CSRF protection** — see [§9](#9-security--privacy).

**Lockout:** track consecutive failed logins per (email, IP). After **N=5** failures, reject with `429` for a cooldown window (e.g. 15 min). Reset the counter on success. Consider a small constant-time delay on all login responses to blunt timing/enumeration.

**RBAC matrix:**

| Capability | `admin` | `recruiter` |
|------------|:------:|:-----------:|
| View dashboard | ✅ | ✅ |
| List/view jobs | ✅ | ✅ |
| Create / edit / delete jobs | ✅ | ❌ |
| Publish / close jobs | ✅ | ❌ |
| List/view applications | ✅ | ✅ |
| Change application status | ✅ | ✅ |
| Add recruiter notes | ✅ | ✅ |
| Download résumé | ✅ | ✅ |
| CSV export | ✅ | ❌ |
| Manage admin users | ✅ | ❌ |

Enforce RBAC server-side with a Nest guard + a `@Roles('admin')` decorator on controllers/handlers. **Never** rely on the client hiding a button. A recruiter hitting an admin-only route gets `403 forbidden`.

---

## 6. Admin backend (recruiting dashboard) design

A small authenticated app served at **`/admin`**. It can be server-rendered (Nest + a template engine) or a lightweight SPA (e.g. a tiny React/Svelte bundle) behind login — implementer's choice. It consumes the [Admin REST API](#4-admin-rest-api-auth-required). It is **not** part of the static marketing site and **not** in this repo.

**Cross-cutting:** every page is gated by the auth guard; RBAC hides/disables actions the role can't perform (and the API re-checks). **Every state change writes an `application_events` row** (status, note, view, résumé download).

### Pages

**1. Login** — email + password; argon2id verify; surfaces lockout. Redirects to Dashboard on success.

**2. Dashboard** — at-a-glance cards:
- Open roles count (`jobs WHERE status='open'`).
- New applications count (`applications WHERE status='new'`).
- Recent activity feed (latest `application_events`, joined to applicant + job).

**3. Jobs** — a table of all jobs (status badge, team, location, posted date, applicant count).
- **Create / Edit** with a **markdown editor** for `description_md` (live preview), plus inputs for the array fields (`responsibilities`, `requirements`, `niceToHave` — repeatable text rows → JSON arrays), enum selectors (`employmentType`, `workMode`), and `compRange`.
- **Publish / Close** actions (admin only).
- **Preview** — render the job exactly as the public page will (reuse the public Job shape).

**4. Applications** — the recruiting workspace:
- **Kanban board** with one column per `application_status` (`new → reviewing → interview → offer → hired`, plus a `rejected` lane). **Drag a card between columns to change status** → fires `PATCH …{status}` → writes `status_changed`. Optimistic UI with rollback on error.
- **Table/list view** toggle for the same data.
- **Filters:** by job (`jobId`), by status, and free-text search (`q` over name + email).
- **Detail drawer** (opens from a card/row):
  - Applicant info (name, email, phone, links).
  - **Résumé viewer/download** — fetches `GET …/:id/resume` → `302` signed URL; inline PDF preview where possible; download writes `resume_downloaded`.
  - **Status control** (same transitions as the board).
  - **Notes** — edit `recruiter_notes`; saving writes `note_added`.
  - **Audit timeline** — the application's `application_events` newest-first (who did what, when; status transitions show `from → to`).
- **CSV export** (admin only) — current filter → `GET …/export.csv?jobId=`.

---

## 7. File storage (résumés)

**Recommendation:** S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO). For local dev, a local-disk driver behind the same `StorageService` interface is fine.

- **Bucket layout:** `resumes/{jobSlug}/{applicationId}.{ext}` — e.g. `resumes/ios-engineer/0b3f…c1.pdf`. One object per application; the path is reconstructable from DB columns but the **DB stores only the object key** (`applications.resume_object_key`), never a public URL.
- **Privacy:** the bucket is **private**. Objects are **never** publicly readable. Admin downloads go through `GET /api/admin/applications/:id/resume`, which returns a **`302` to a time-limited signed URL** (e.g. expires in 60–300 s). Signed URLs are minted per-request, never stored.
- **Upload validation:** enforce content-type allowlist (`pdf`, `doc`, `docx`) and the **8 MB** size cap **before** uploading; sniff magic bytes server-side. Set a sane `Content-Disposition: attachment; filename="…"` and the correct `Content-Type` on the stored object.
- **AV scan hook (optional):** expose a hook after upload to scan the object (e.g. ClamAV, or an S3-event-triggered Lambda). Quarantine on positive; mark the application so the admin sees "résumé pending scan / blocked" instead of a download link.
- **Lifecycle:** tie object deletion to the application retention/deletion policy ([§9](#9-security--privacy)) — when an application is purged or a deletion request is honoured, delete the object too. Consider a bucket lifecycle rule as a backstop.
- **Encryption:** enable server-side encryption at rest (SSE-S3 / SSE-KMS or the provider equivalent).

---

## 8. Audit logging

The `application_events` table is an **append-only** audit trail. Insert a row for each of:

| `event_type` | When | `from_status` / `to_status` | `actor_admin_id` |
|--------------|------|-----------------------------|------------------|
| `created` | Application submitted (public) | `null` / `new` | `null` (system) |
| `status_changed` | Admin changes status | old / new | the admin |
| `note_added` | Admin edits `recruiter_notes` | `null` / `null` | the admin |
| `viewed` | Admin opens detail | `null` / `null` | the admin |
| `resume_downloaded` | Signed résumé URL minted | `null` / `null` | the admin |

- `meta` (jsonb) carries context that doesn't fit columns (e.g. `{ "noteLength": 240 }`, `{ "search": "swift" }`). **Never** put résumé contents or raw PII beyond what's already in the row.
- `viewed` events are noisy — throttle to one per (actor, application) per N minutes.
- Events are **never** edited or deleted except via the application's `ON DELETE CASCADE`. The audit timeline in the admin UI reads straight from this table.

---

## 9. Security & privacy

Go!Gosling's brand promise is privacy-first; the careers system must reflect it.

### Principles

- **Minimal PII.** Collect only what's needed to evaluate a candidate: name, email, optional phone, optional links, optional cover message, optional résumé. No date of birth, no government IDs, no demographic data.
- **Explicit consent.** The apply form requires `consent="true"`; the server records `consent_at`. No consent → no submission. The consent checkbox copy must link to the privacy policy and state the purpose + retention period.
- **Retention policy.** Define and enforce a retention window, e.g. **purge non-hired applicant data N months (e.g. 12) after the last activity.** Run a scheduled job that deletes the `applications` rows (cascading events) and the résumé objects for expired, non-`hired` applications. `hired` applications may transfer to the HR system of record and then be purged from this store.
- **Deletion on request.** Provide an internal flow (admin action or a request mailbox like `privacy@gogosling.ca`) to delete a specific applicant's data on request: remove the `applications` row (cascade events) and the résumé object. Log the deletion in a tenant-level audit (outside the cascaded table) for compliance.
- **Encryption.** TLS in transit (HTTPS only; HSTS). Encryption at rest for DB and object storage.
- **Hash IPs.** Store `ip_hash` (HMAC-SHA-256 with a server-side pepper), never the raw IP. Use it only for rate limiting / abuse, not profiling.
- **Never log résumé contents** or full PII. Scrub logs; redact emails/phones in error reports.

### Web hardening

- **CSRF:** cookie-based admin auth must use CSRF protection (double-submit token or the `csurf` pattern) on all state-changing requests. Bearer-token (header) requests are not CSRF-vulnerable, but the public `POST` still relies on the honeypot + rate limit + CORS.
- **CORS allowlist:** the public API allows **only** the marketing origin(s) — `https://gogosling.ca`, `https://www.gogosling.ca`, and during dev `http://localhost:8080`. The admin API allows only the admin origin. Reject everything else; do not use `*`.
- **Rate limiting:** per-IP on the public `POST` (and login). A reverse-proxy/WAF layer (Cloudflare) in front is a plus.
- **Input sanitization:** treat all applicant text as untrusted. Validate/limit lengths, reject dangerous URL schemes, and **escape on output** in the admin UI (cover messages and notes render as plain text / sanitized markdown, never raw HTML).
- **Secrets via env:** DB URL, JWT secret, IP pepper, storage keys, signed-URL signing key — all from environment variables / a secrets manager. Never commit secrets. See [§11](#11-deployment--launch-sequence).

### Data we collect / why / retention

| Data | Field(s) | Why we collect it | Retention |
|------|----------|-------------------|-----------|
| Applicant name | `applicant_name` | Identify & address the candidate | Until purge (N months post-activity) or deletion request |
| Email | `email` | Contact the candidate | Same |
| Phone (optional) | `phone` | Alternate contact | Same |
| Links (optional) | `links` | Evaluate portfolio/LinkedIn/GitHub | Same |
| Cover message (optional) | `cover_message` | Candidate's pitch | Same |
| Résumé (optional) | `resume_object_key` → object storage | Evaluate experience | Same; object deleted on purge/request |
| Consent timestamp | `consent_at` | Prove lawful basis for processing | Life of the application record |
| Hashed IP | `ip_hash` | Abuse / rate limiting only | Same as application; never the raw IP |
| User agent | `user_agent` | Debug submission issues | Same |
| Recruiter notes | `recruiter_notes` | Internal evaluation | Life of the application record |

---

## 10. Frontend wiring (how the static site talks to this)

The static careers page (`careers.html` + its script, e.g. `assets/js/careers.js`) is **progressive-enhancement** and **degrades gracefully** when this backend doesn't exist yet.

### 10.1 API base URL + offline fallback

The page reads a global:

```html
<!-- Set in the page (or injected at deploy time). Unset = offline mode. -->
<script>window.GOSLING_CAREERS_API = "https://api.gogosling.ca";</script>
```

**Jobs fetch flow:**

1. If `window.GOSLING_CAREERS_API` is set, `fetch(`${base}/api/careers/jobs`)`.
2. If it's **unset, errors, times out, or returns non-2xx**, fall back to the bundled static file **`data/jobs.json`** so the site always shows roles.
3. Render the cards from whichever source succeeded.

```js
// assets/js/careers.js — sketch (vanilla, no deps)
const BASE = window.GOSLING_CAREERS_API;
async function loadJobs() {
  if (BASE) {
    try {
      const r = await fetch(`${BASE}/api/careers/jobs`, { headers: { Accept: "application/json" } });
      if (r.ok) return (await r.json()).jobs;
    } catch (_) { /* fall through to static */ }
  }
  const r = await fetch("data/jobs.json");        // same-origin static fallback
  return (await r.json()).jobs;
}
```

**`data/jobs.json` shape** — identical to the `GET /api/careers/jobs` body, so swapping between offline and live needs zero code changes:

```json
{
  "jobs": [
    {
      "id": "static-1",
      "slug": "ios-engineer",
      "title": "iOS Engineer",
      "team": "Engineering",
      "location": "Toronto, ON / Remote (Canada)",
      "employmentType": "full_time",
      "workMode": "hybrid",
      "summary": "Build the Go!Gosling iPhone app with us.",
      "descriptionMd": "## About the role\n…",
      "responsibilities": ["Ship SwiftUI features"],
      "requirements": ["3+ years iOS"],
      "niceToHave": ["HealthKit experience"],
      "compRange": null,
      "postedAt": "2026-06-01T14:00:00.000Z"
    }
  ]
}
```

> Single-job view: when live, `GET …/jobs/:slug`. In offline mode, the page finds the matching `slug` within the already-loaded `data/jobs.json` array (no per-slug static files needed).

### 10.2 Application POST flow (multipart)

The apply form is a real `<form>` that works without JS (native multipart submit). With JS, it's progressively enhanced for inline validation + async submit:

```js
form.addEventListener("submit", async (e) => {
  if (!window.GOSLING_CAREERS_API) return; // no backend → let native submit / show "applications open at launch"
  e.preventDefault();
  const fd = new FormData(form);            // includes file input + empty honeypot company_website
  // client-side: ensure consent checked, basic email check, file ≤ 8MB
  const r = await fetch(`${window.GOSLING_CAREERS_API}/api/careers/applications`, {
    method: "POST",
    body: fd,                               // browser sets multipart boundary; do NOT set Content-Type
  });
  const data = await r.json();
  if (r.status === 201 && data.ok) showSuccess();
  else showErrors(data.error);              // map data.error.fields back onto inputs
});
```

**Success / error UX contract:**

- **Success (`201 { ok:true, applicationId }`):** swap the form for a confirmation state ("Thanks — your application is in. We'll be in touch."). Mirrors the existing waitlist pattern (`[data-…-success]` block revealed, form hidden).
- **Validation (`400` with `error.fields`):** map each field key to its input, set `aria-invalid="true"`, and show the per-field `message`. Focus the first invalid field.
- **Rate limited (`429`):** friendly "You've submitted a few times — please try again later."
- **Server/network error / 5xx:** generic retryable message; never lose the user's typed input; suggest emailing `careers@gogosling.ca` as a fallback.
- **Honeypot field `company_website`:** rendered visually hidden (off-screen / `tabindex=-1` / `aria-hidden`), left empty by humans, must be submitted in the FormData.

> Reuse the i18n approach already in the repo: form copy (labels, success, errors) lives in `assets/js/i18n.js` under `careers.*` keys and is applied via `data-i18n` / `data-i18n-attr`. The error-field messages from the API are English fallbacks; prefer localized client copy keyed by `error.code`.

### 10.3 Required frontend env/config & CORS

- **`window.GOSLING_CAREERS_API`** — the API base URL. Set per environment (e.g. injected by the static host, or a tiny `assets/js/config.js`). Unset = offline (`data/jobs.json`) mode.
- The API's **CORS allowlist must include the exact marketing origin(s)** the site is served from (apex + `www` + localhost for dev), or browser requests will fail and the page will silently fall back to `data/jobs.json` (masking the misconfig). See [§9](#9-security--privacy).
- The résumé file input must not set a manual `Content-Type`; let the browser set the multipart boundary.

---

## 11. Deployment & launch sequence

### Frontend (this repo)

Static host — **Vercel / Netlify / Cloudflare Pages** (zero build). Point the apex domain (`gogosling.ca`) at it over HTTPS. Set `window.GOSLING_CAREERS_API` for the environment (or leave unset to ship in offline mode with `data/jobs.json`).

### Backend (NestJS + Postgres + object storage)

**Environment variables (minimum):**

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string (managed PG). |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Admin token signing. |
| `ADMIN_SESSION_COOKIE_SECRET` | Sign the httpOnly session cookie. |
| `IP_HASH_PEPPER` | Server-side pepper for `ip_hash` HMAC. |
| `STORAGE_ENDPOINT` / `STORAGE_REGION` | Object storage endpoint. |
| `STORAGE_BUCKET` | e.g. `gosling-resumes`. |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Storage credentials. |
| `SIGNED_URL_TTL_SECONDS` | Résumé signed-URL lifetime (e.g. `120`). |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowlist (`https://gogosling.ca,https://www.gogosling.ca`). |
| `RATE_LIMIT_*` | Public POST + login limits. |
| `ARGON2_*` | argon2id cost params (optional overrides). |

- **CORS:** configure Nest's CORS from `CORS_ALLOWED_ORIGINS`; credentials enabled only for the admin origin.
- **Migrations:** run forward-only migrations on deploy; then run the seed script once to create the first `admin` user and any launch jobs.
- **TLS/HTTPS** everywhere; HSTS; secrets from the platform's secret store (never in the repo).

### Launch sequence

1. **Deploy the static site** (offline mode, `data/jobs.json`) — careers page is live immediately, showing seed roles.
2. **Stand up the API + DB + bucket** — run extensions + migrations, create the bucket (private), seed the first admin user.
3. **Set `window.GOSLING_CAREERS_API`** on the static host to the API base URL and redeploy the static site (or flip the config). The page now reads live jobs and accepts applications.
4. **Seed jobs via the admin panel** — create/publish real roles at `/admin`; they immediately appear on `careers.html` via `GET /api/careers/jobs`.
5. **Verify:** open a private role check (404 for non-open), submit a test application end-to-end (honeypot + rate limit + résumé upload + signed-URL download), confirm audit events.

---

## 12. Appendix: JSON shapes & error codes

### 12.1 Canonical shapes

**Job (public + admin read):**

```ts
type Job = {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  workMode: "remote" | "hybrid" | "onsite";
  summary: string;
  descriptionMd: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[] | null;
  compRange: string | null;
  postedAt: string | null; // ISO-8601
};
```

**Application (admin read) — adds applicant + pipeline fields:**

```ts
type Application = {
  id: string;
  jobId: string;
  applicantName: string;
  email: string;
  phone: string | null;
  links: { portfolio?: string; linkedin?: string; github?: string };
  coverMessage: string | null;
  hasResume: boolean;            // derived from resume_object_key != null (key itself not exposed)
  status: "new" | "reviewing" | "interview" | "offer" | "rejected" | "hired";
  recruiterNotes: string | null;
  source: string | null;
  consentAt: string;             // ISO-8601
  createdAt: string;
  updatedAt: string;
};
```

> Note: `resume_object_key`, `ip_hash`, and `user_agent` are **internal** — never serialize the raw key/IP to the admin client. Expose résumé access only through the `302` signed-URL endpoint and a boolean `hasResume`.

### 12.2 Error codes

| `code` | HTTP | Meaning |
|--------|------|---------|
| `validation_failed` | 400 | One or more fields invalid (see `error.fields`). |
| `not_found` | 404 | Job/application not found, or job not `open` (public). |
| `unauthorized` | 401 | Missing/invalid/expired token or session. |
| `forbidden` | 403 | Authenticated but role lacks permission (RBAC). |
| `conflict` | 409 | e.g. deleting a job that has applications; duplicate `slug`. |
| `rate_limited` | 429 | Per-IP submission/login limit exceeded. |
| `payload_too_large` | 413 | Résumé over 8 MB. |
| `unsupported_media_type` | 415 | Résumé not pdf/doc/docx, or wrong multipart. |
| `internal_error` | 500 | Unexpected server error (generic message; log internally). |

All errors use the shared envelope `{ ok:false, error:{ code, message, fields? } }`.
