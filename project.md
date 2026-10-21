# Spotter — Project Specification & Technical Architecture

## 1. Executive Summary

**Spotter** is a dedicated member web application provided by a gym to its registered members. Rather than a generic fitness chatbot or standard gym management SaaS, Spotter is purposefully engineered around one specific gym's verified operational records and private member data.

Members register using a unique six-digit member number provided by the front desk, log in to have their gym-related questions answered strictly from approved gym records, generate single-use keypad check-in codes, inspect their personal attendance and ledger balance, and pay for renewals or arrears with instant membership extension.

---

## 2. Core Problem & Product Philosophy

### The Real-World Friction
In typical mid-sized gyms (e.g., 400 members with a single front desk shared sequentially by reception staff):
- **Repetitive Inquiries:** Front-desk officers spend significant time fielding the same recurring questions (*"What time is the Saturday class?", "Can I bring a guest?", "What are peak hours?", "Did I pay for last month?"*).
- **Off-Hours Dead Zones:** Once the reception closes in the evening, members have zero access to reliable information or arrival validation.
- **Lost Records & Cash Disputes:** Cash payments, paper receipt books, and physical ledgers create discrepancies, resulting in disputed memberships and lost revenue.
- **Unreliable Answers:** Staff guess answers or provide inconsistent information when records are unavailable.

### Guiding Principles
1. **Never Hallucinate, Never Guess:** If a question cannot be answered with high confidence from an approved record, the system explicitly refuses or routes the member to the named duty officer via WhatsApp.
2. **Absolute Privacy Invariance:** Private records (attendance, financial ledger, balance, membership tier) belong to one member alone. They are **never** searched across members, never vectorized, and never exposed in vector embeddings.
3. **Frictionless Habit:** The primary recurring touchpoint is the 15-second arrival check-in, driving active daily retention without push notifications or spam.
4. **Member-Only Experience:** Staff and gym owners have separate administrative screens and sessions. They provide and verify data; they are not inside the member app.

---

## 3. The 5 Core MVP Features

```
+---------------------------------------------------------------------------------+
|                                 SPOTTER MEMBER APP                              |
+---------------------------------------------------------------------------------+
|  [01] Check In       |  Single-use 6-digit code for physical door keypad       |
|  [02] My Records     |  Private attendance history & financial ledger balance   |
|  [03] Ask the Gym    |  RAG Q&A grounded exclusively in approved shared cards   |
|  [04] Pay & Renew    |  Flutterwave renewal & arrears with instant extension   |
|  [05] Ask the Desk   |  Direct WhatsApp handoff to duty officer with context    |
+---------------------------------------------------------------------------------+
```

### Feature 1: Ask About the Gym (Shared Records)
- Answers common questions regarding timetable, pricing, guest policy, hours, training plans, and pause/cancellation policies.
- Driven by a similarity search over owner-approved "Shared Cards" filtered by the member's effective tier (`BASIC` or `PREMIUM`).
- Every answer cites the source card and its last confirmed date.
- Includes a member report control (*"This answer is wrong"*) creating an audit row for owner review.

### Feature 2: My Records (Private Data)
- Direct, deterministic lookup of the member's own attendance days and financial balance.
- Money is reported factually from the ledger, never arbitrarily ruled on.
- Queries always read strictly from the authenticated session member ID; never from client request bodies.

### Feature 3: Check-In Code Generation
- Generates a single-use six-digit code in the app with a limited lifespan.
- The member punches the code into the physical keypad at the gym entrance.
- One check-in per member per calendar day.
- Supports a software-simulated verifier mode (`CHECKIN_SIMULATED=true`) for testing before hardware deployment.

### Feature 4: Pay & Renew (Flutterwave)
- Handles subscription renewals and clearing of outstanding arrears.
- Uses Flutterwave payment links/gateways.
- Only verified gateway webhooks (validated with `FLUTTERWAVE_WEBHOOK_HASH`) confirm payments and trigger atomic membership extensions and ledger updates.

### Feature 5: Ask the Desk (Handoff)
- When a question cannot be answered from gym records, or hits policy refusal boundaries (e.g. medical, injuries, door malfunction), Spotter identifies the staff member on duty and generates a pre-filled WhatsApp link with the user's question.

---

## 4. Explicit Non-Goals & Boundaries

To preserve architectural integrity, Spotter strictly excludes:
- **No Class Booking / Capacity Queueing:** Prevents race conditions and complex booking management for small studios.
- **No Push Notifications / Marketing Blasts:** Respects member data budgets and avoids communication clutter.
- **No Direct In-App Chat:** Avoids dragging staff into continuous real-time chat threads inside the app.
- **No Door Lock Control Hardware:** Spotter verifies the identity/claim of entry; it does not directly trigger electric strike locks or turnstiles.
- **No Health / Medical / Dietary Advice:** Inquiries concerning injuries, diets, or medical clearance are rejected deterministically by the rules layer.
- **No Multi-Gym SaaS Tenancy in V1:** Engineered specifically for single-gym operations, while maintaining a `gymId` foreign key for future multi-tenant expansion.

---

## 5. System Architecture & Tech Stack

```mermaid
graph TD
    Client[Next.js App Router Client / Mobile Web]
    Proxy[src/proxy.ts Middleware & Session Gate]
    
    subgraph Routing & Application Layer
        MemberRoutes["Member Routes: / & /auth"]
        StaffRoutes["Staff Routes: /staff & /staff/login"]
        APIRoutes["Route Handlers: /api/auth/*, /api/jobs/*"]
    end

    subgraph Core Server Modules
        AuthService["src/server/auth/ (Argon2id, HIBP, Rate Limits)"]
        StaffService["src/server/auth/staff-service.ts"]
        EmailService["src/server/email/ (Nodemailer, Templates)"]
        JobsService["src/server/jobs/ (purge-deletions)"]
        MemberNumService["src/server/membership/member-numbers.ts"]
        DBClient["src/server/db.ts (Prisma Client)"]
    end

    subgraph Data Layer
        Postgres[(PostgreSQL Database)]
        PGVector[(pgvector Extension)]
    end

    Client --> Proxy
    Proxy --> MemberRoutes
    Proxy --> StaffRoutes
    Proxy --> APIRoutes
    
    MemberRoutes --> AuthService
    StaffRoutes --> StaffService
    APIRoutes --> AuthService
    APIRoutes --> JobsService
    
    StaffService --> MemberNumService
    MemberNumService --> EmailService
    AuthService --> EmailService
    
    AuthService --> DBClient
    StaffService --> DBClient
    JobsService --> DBClient
    MemberNumService --> DBClient
    
    DBClient --> Postgres
    DBClient -.-> PGVector
```

### Technology Matrix

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server Components, Server Actions, Route Handlers |
| **Language** | TypeScript 5 | Strict mode, strict null checks, no emit |
| **Database ORM** | Prisma 6.19.3 | Pinned to v6 (preserves datasource `url`/`directUrl` compatibility) |
| **Database** | PostgreSQL | Relational storage with `pgvector` extension |
| **Styling** | Vanilla CSS + Design Tokens | W3C Design Tokens JSON mapped to CSS custom properties |
| **Security / Crypto** | `@node-rs/argon2`, Node `crypto` | Argon2id password hashing, HMAC-SHA256 session signatures |
| **Testing** | Vitest 3.2.7 | Unit and integration test suites |
| **Validation** | Zod 4 | Request validation with shared error formatting |
| **Email** | Nodemailer | SMTP client with HTML/Plaintext transactional templates |
| **External APIs** | HaveIBeenPwned, Flutterwave, Gemini | Breach detection, payment processing, semantic embeddings |

---

## 6. Privacy Invariants & Security Engineering

The following architectural invariants are strictly enforced:

1. **Exact-ID Session Isolation:**
   Every private record retrieval requires the caller to supply the `memberId` extracted directly from the verified server session cookie. No member ID may ever be accepted from a client request body or query parameter.
2. **Zero Cross-Member Search:**
   Private records are never indexed in vector tables and never matched across multiple member profiles.
3. **Mandatory Access Auditing:**
   Every single private read operation writes a record into `PrivateAccessLog` (`sessionMemberId`, `targetMemberId`, `functionName`, `createdAt`). Any mismatch between `sessionMemberId` and `targetMemberId` is flagged as a high-severity violation.
4. **Segregated Session Management:**
   - Members: `spotter_session` cookie (90-day validity, signed via `SESSION_SECRET`).
   - Staff / Owner: `spotter_staff_session` cookie (12-hour validity, restricted to `/staff` path, signed via `STAFF_SESSION_SECRET`).
   - `STAFF_SESSION_SECRET` must strictly differ from `SESSION_SECRET`.
5. **Argon2id Password Security & HIBP Protection:**
   - All passwords hashed using Argon2id.
   - Every sign-up and password reset queries the HaveIBeenPwned range API (`https://api.pwnedpasswords.com/range/`) using k-anonymity (SHA-1 prefix) to block compromised passwords.
6. **Account Lockout & IP Rate Limiting:**
   - 5 consecutive failed login attempts trigger a 15-minute account lock.
   - 5 consecutive failures from an IP trigger a 1-hour IP block.
7. **Soft Deletion with Grace Period:**
   - Account deletion requests instantly lock the account and revoke all active sessions.
   - A 7-day grace period allows for restoration if needed.
   - The nightly cron job (`/api/jobs/nightly`) purges private member data, anonymizes the member name to `"Deleted member"`, clears credentials, while retaining payment ledger records for 7-year regulatory compliance.

---

## 7. Database Domain Model

The schema is defined in `prisma/schema.prisma` across the following domains:

```
+-----------------------------------------------------------------------------------+
|                                  SCHEMA DOMAINS                                   |
+-----------------------------------------------------------------------------------+
|  1. Core & Gym:         Gym, Role, Permission, RolePermission                     |
|  2. Staff & Desk:       Staff, StaffSession, DeskShift, MemberNumberReservation   |
|  3. Members & Sessions: Member, MemberSession, PrivateAccessLog                   |
|  4. Shared Knowledge:   Card, CardVersion, CardChunk (pgvector)                   |
|  5. Attendance:         CheckIn, CheckInCode                                      |
|  6. Financial Ledger:   MembershipPlan, PaymentAttempt, Payment, LedgerEntry,     |
|                         MembershipChange                                          |
|  7. Question Auditing:  QuestionLog, WrongAnswerReport, AnswerAudit               |
+-----------------------------------------------------------------------------------+
```

### Key Models & Relationships
- **`Member`:** Central identity holding member status, email verification codes, hashed credentials, and soft-deletion markers. Uniquely identified by `[gymId, memberNumber]`.
- **`Staff` & `RolePermission`:** Granular role-based access control (`staff.dashboard.access`, `member_number.reserve`) with separate sessions and shift assignments (`DeskShift`).
- **`MemberNumberReservation`:** Generated by receptionist staff at desk sign-up; reserves a 6-digit number bound to an prospective member's email address.
- **`Card`, `CardVersion`, `CardChunk`:** Draft-and-approve lifecycle for knowledge cards. Chunks store 768-dimensional embeddings (`Unsupported("vector(768)")`) with tier permissions (`BASIC`, `PREMIUM`).
- **`CheckInCode` & `CheckIn`:** 6-digit codes consumed once by the keypad verifier seam, enforcing uniqueness per member per calendar day (`@@unique([memberId, date])`).
- **`PaymentAttempt`, `Payment`, `LedgerEntry`:** Idempotent payment tracking with Flutterwave reference tracking and ledger balance logging.

---

## 8. Frontend Architecture & Design System

### Design Tokens Pipeline
- Primitive and semantic design tokens originate in `design-tokens.tokens.json`.
- Processed via `node scripts/convert-tokens.js` to produce `src/styles/tokens.css`.
- **UI Rule:** Components must never reference raw palette primitives (`--primitive-*`); all interfaces consume semantic tokens (`--color-surface`, `--color-primary`, `--color-outline`, etc.).

### Centralized Copy Management
- Per `rules/copy.md`, **no member-facing string is hardcoded in UI components**.
- All static labels, refusal statements, legal policies, error notifications, and email text are centralized in `src/lib/copy.ts`.

### Layout & Page Hierarchy
- **`/` (`src/app/page.tsx`):** Dynamic landing page. If logged out, displays the brand story and features overview. If logged in, displays the active `MemberPortal` view with verification banners, questions, and account deletion controls.
- **`/auth` (`src/app/auth/page.tsx`):** Consolidated accessible view handling Login, Sign Up, and Password Reset.
- **`/staff/login` & `/staff` (`src/app/staff/`):** Receptionist portal for staff authentication and issuing/emailing member number reservations.

---

## 9. Current Implementation Status

### Completed Modules
- [x] **Full Relational Schema:** Complete schema defined in `prisma/schema.prisma` with all 20+ models and indexes.
- [x] **Database-Backed Member Auth:** Argon2id hashing, HIBP breach check, IP rate-limiting, and signed cookies.
- [x] **Email Verification & Transactional Emails:** Nodemailer integration with 6-digit time-limited OTP email verification and welcome emails.
- [x] **Staff Portal & RBAC:** Separate staff login, staff session cookie, permission checking, and receptionist member-number reservation workflow.
- [x] **Account Deletion & Nightly Purge:** Soft-deletion flow with 7-day grace period and cron job route at `/api/jobs/nightly`.
- [x] **Design Tokens & Accessibility:** W3C design tokens compiled into CSS custom properties, WCAG-compliant high-contrast inputs and focus trapping for mobile navigation.
- [x] **Centralized Copy System:** Complete coverage in `src/lib/copy.ts`.
- [x] **Test Suite:** Unit tests for validation, breached password check, rate limiting, sessions, staff auth, and member numbers.

### Pending / Next Implementation Phases
- [ ] **RAG Pipeline (`src/server/retrieval/`):** Implementation of pgvector similarity search, Gemini embeddings integration, deterministic rules layer, and number-grounding checks.
- [ ] **Check-In Verifier Seam (`src/server/checkin/`):** Code generation endpoint, verification seam, and simulated automatic check-in worker.
- [ ] **Financials & Flutterwave Webhook (`src/server/payments/`):** Payment initialization route, Flutterwave signature verification webhook, and automatic membership extension.
- [ ] **Private Records Endpoints (`src/server/private/`):** Attendance history reader and ledger balance calculation with automatic `PrivateAccessLog` writes.

---

## 10. Environment Configuration

Copy `.env.example` to `.env` to configure your local runtime:

```bash
# --- Database ---
DATABASE_URL="postgresql://user:password@localhost:5432/spotter?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/spotter?schema=public"

# --- Models ---
GEMINI_API_KEY=""

# --- Payments ---
FLUTTERWAVE_SECRET_KEY=""
FLUTTERWAVE_PUBLIC_KEY=""
FLUTTERWAVE_WEBHOOK_HASH=""

# --- Application ---
SESSION_SECRET="secure-random-string-for-member-sessions"
STAFF_SESSION_SECRET="different-secure-random-string-for-staff-sessions"
APP_URL="http://localhost:3000"
CRON_SECRET="secret-bearer-token-for-nightly-jobs"

# --- Check In ---
CHECKIN_SIMULATED="true"

# --- Email (SMTP) ---
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="user@example.com"
SMTP_PASS="password"
SMTP_FROM="Spotter <noreply@spotter.gym>"
```

---

## 11. Verification & Quality Commands

Always ensure all static analysis and build checks pass clean:

```bash
# Verify TypeScript types without emitting JavaScript
npm run typecheck

# Execute ESLint validation across project
npm run lint

# Validate Prisma schema against engine constraints
npx prisma validate

# Run automated Vitest test suite
npm test

# Build production bundle
npm run build
```
