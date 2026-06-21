# Bank Queue Management System (BQMS) — Implementation Plan

## Current Status: Phase 1 & Phase 2 COMPLETED ✅

We have fully analyzed and verified the codebase for Phase 1 & 2:
1. **Phase 1 (Scaffolding & Infrastructure)**: Next.js app configuration, packages, environment validations, helper utilities, routing, and middleware are successfully set up.
2. **Phase 2 (Database Schema & Migrations)**: All 13 tables, dependencies, indexes, and primary/foreign keys are defined in [db/schema.ts](file:///c:/Users/VmanFdo/Desktop/Viman/Project/Bank%20Queue%20Management%20System/db/schema.ts). The migrations have been verified and applied to the database, and the development dataset has been successfully seeded via [db/seed.ts](file:///c:/Users/VmanFdo/Desktop/Viman/Project/Bank%20Queue%20Management%20System/db/seed.ts).

We are now ready to implement **Phase 3 — Queue Engine Core**.

---

## User Review Required

> [!NOTE]
> **Queue Engine Concurrency**: The Queue Engine functions will use Postgres transactions with `FOR UPDATE` locks on selected rows to prevent race conditions (such as double-calling a ticket or duplicate token sequences).

> [!WARNING]
> **NIC Data as PII**: The spec treats NIC numbers as PII — they are masked in UI surfaces where full values aren't operationally needed. The implementation will follow this as a baseline, but you may want to confirm your specific data-handling obligations under Sri Lankan law (PDPA).

> [!NOTE]
> **Mocked SMS**: v1 uses a logged-only SMS service. Real integration with Notify.lk or Twilio is **out of scope** but the `lib/notifications/send.ts` interface is designed to support a future drop-in.

---

## Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | **Priority Walk-in self-declaration** | Customers must tick a **confirmation checkbox with a declaration statement** (e.g. "I confirm I qualify for priority service as a senior citizen, person with disability, or pregnant individual") before the priority ticket is issued. |
| 2 | **Appointment slot granularity** | **15-minute** intervals in the time-slot picker UI. `appointment_slots_per_hour` = up to 4 slots per hour per service category. |
| 3 | **Staff account provisioning** | **Head Office admin creates and invites** staff accounts via the Admin Portal. Tellers/managers cannot self-register. Supabase Auth invite flow used. |
| 4 | **Geolocation fallback** | If location access is denied, **show all branches** with a **search-by-city UI** (text filter). |
| 5 | **Display board audio** | Announcements **cycle through all 3 languages** (SI → TA → EN) per ticket call event. |

---

## Proposed Changes

### Phase 1 — Project Scaffolding & Infrastructure

#### [NEW] Next.js 14 App Router project (`./`)
- Initialize with: `npx create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"`
- Install core dependencies: `drizzle-orm`, `postgres`, `drizzle-kit`, `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `zod`, `shadcn/ui` CLI, `lucide-react`
- Configure `next.config.ts` for i18n routing via `next-intl`
- Set up `vercel.json` with cron job definition (`/api/cron/sweep`, every 1 minute)

#### [NEW] Environment configuration
- `.env.local` template with `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `lib/env.ts` — validated environment variables via Zod (fails fast on missing vars)

---

### Phase 2 — Database Schema & Migrations

#### [NEW] `db/schema.ts` — Drizzle schema (all 10 entities)

All 10 entities from the spec, in dependency order:

| Table | Key Columns |
|---|---|
| `branches` | id, name, address, lat, lng, phone, is_active |
| `branch_config` | branch_id, priority_ratio_standard (3), priority_ratio_priority (1), appointment_buffer_minutes (15), appointment_window_minutes (20), arrival_confirmation_lead_minutes (10) |
| `appointment_caps` | branch_id, service_category, hour_of_day, max_bookings |
| `sla_thresholds` | branch_id, service_category, threshold_minutes |
| `services` | id, branch_id, name/name_si/name_ta, icon, category, avg_service_time_minutes, nic_required, is_active |
| `counters` | id, branch_id, name, assigned_teller_id, status (available/on_break/closed), current_ticket_id, break_started_at, break_expected_minutes |
| `counter_services` | counter_id, service_id (join table) |
| `tickets` | id, branch_id, token_number (A-105/P-001/S-047), service_id, pool (appointment/priority/standard), status (waiting/called/in_service/done/no_show/transferred/cancelled/on_hold), customer_name, customer_phone, nic, language, linked_ticket_id (self-ref FK), counter_id, created_at, called_at, service_started_at, done_at, no_show_count, original_wait_estimate_minutes |
| `appointments` | id, ticket_id (nullable FK), branch_id, service_id, booking_code, window_start, window_end, status (pending/checked_in/expired/cancelled/completed), arrival_confirmed_at, customer_name, customer_phone, nic |
| `nic_records` | nic, branch_id, no_show_count, restricted_until, last_visit_at |
| `notifications` | id, ticket_id, appointment_id, phone, channel (sms), event_type (enum), message_body, status (logged/sent/failed), created_at |
| `feedback` | id, ticket_id, rating (1–5), tags[], comment, created_at |
| `audit_log` | id, actor_type (teller/system/manager), actor_id, action, ticket_id, details (jsonb), created_at |

**Indexes**: `tickets(branch_id, status, pool, counter_id)`, `tickets(branch_id, created_at)`, `appointments(branch_id, window_start, status)`, `audit_log(ticket_id)`, `nic_records(nic, branch_id)`

#### [NEW] `db/migrations/` — Drizzle migration files
- Generated via `drizzle-kit generate`

#### [NEW] `db/index.ts` — Drizzle client with pooled postgres.js connection

---

### Phase 3 — Queue Engine Core (`lib/queue/`)

This is the most critical module. All writes go through this single engine with Postgres transactions and row locks.

#### [NEW] `lib/queue/engine.ts` — Core transactional functions

- **Database Locking Strategy**: All state modifications of `tickets` and `counters` inside engine methods are wrapped in `db.transaction` with high isolation level, or explicitly select rows `FOR UPDATE` to prevent concurrent modification by multiple tellers or customer check-ins.
- **Interleaving Priority Queue Logic**: 
  - When `getNextTicketForCounter` is called:
    1. First check if there is an active `appointment` ticket with `window_start <= NOW()` in the `waiting` status. If yes, return it first.
    2. Otherwise, check standard vs priority interleaving ratio. We query the last called ticket at this counter with `pool = 'priority'`. We then count standard tickets called at this counter since that ticket's `called_at`. If that count >= `priority_ratio_standard` (default 3), we attempt to fetch the oldest `priority` ticket. If no priority tickets are waiting, fallback to standard.
    3. Otherwise, fetch the oldest `standard` ticket. If standard is empty, try priority.
- **Linked-Pair (Multi-Service) Hold/Resume**:
  - A customer can issue two tickets linked via `linked_ticket_id`.
  - When a teller calls ticket A, the engine checks if ticket B is already in service or called at another counter. If B is already in service, ticket A is placed `on_hold` at this counter.
  - When ticket A is marked `done`, the engine checks if ticket B was `on_hold`. If B was held, the engine automatically moves B back to `waiting` (or triggers a resume) so it can be called next.
- **Undo Guard (60 Seconds)**:
  - When a ticket is marked `done`, we record `done_at`. The teller can undo this within 60 seconds. The undo operation restores the ticket to `in_service` and clears `done_at`.

#### [NEW] `lib/queue/estimation.ts`
- `computeWaitEstimate(branchId, serviceId, pool)`:
  - Calculates wait time: `(queueDepth * avgServiceTime) / max(1, openCountersCount)`.
  - Queue depth includes tickets in `waiting` or `called` state.
- `computeEarliestAppointmentSlot(branchId, serviceId, requestedTime)`:
  - Suggests the next available 15-minute slot that doesn't violate branch config caps or estimated queue clear times.

#### [NEW] `lib/queue/token.ts`
- Token number generation:
  - Generates token sequences such as `A-001`, `P-001`, `S-001` per branch per day.
  - Generates atomically by counting existing tickets for the branch and pool created today and incrementing by 1.

---

### Phase 4 — Auth & Middleware

#### [NEW] `lib/auth/middleware.ts` + `middleware.ts` (root)
- Supabase SSR session validation
- Role-based route protection: `/(staff)/teller` → `teller`, `/(staff)/manager` → `branch_manager`, `/(admin)/admin` → `head_office_admin`
- Public routes: `/(customer)/*`, `/display/*`
- Rate limiting on ticket creation endpoint (e.g., via IP-based counter in Supabase or simple in-memory with reset)
- **Staff invite flow**: Head Office admin triggers Supabase Auth `inviteUserByEmail()` with role metadata; invited user sets password on first login via `/auth/accept-invite` route

#### [NEW] `lib/auth/roles.ts`
- Role enum: `teller | branch_manager | head_office_admin`
- Helper `requireRole(session, role)` for Server Actions

---

### Phase 5 — Notification Service

#### [NEW] `lib/notifications/send.ts`
- `sendNotification({ phone, eventType, payload, ticketId?, appointmentId? })`
- Renders message body from trilingual template keyed by `eventType`
- Writes to `notifications` table with `status = 'logged'`
- No real SMS gateway in v1 — structured for drop-in replacement

#### [NEW] `lib/notifications/templates.ts`
- Templates for all 10 event types across EN/SI/TA:
  - `ticket_issued`, `appointment_confirmed`, `tickets_away`, `called`, `window_opening`, `expired`, `delay_alert`, `linked_pair_update`, `reroute_update`, `priority_interleave_notice`

---

### Phase 6 — i18n Setup

#### [NEW] `i18n/messages/en.json`, `i18n/messages/si.json`, `i18n/messages/ta.json`
- All customer and hall-facing UI strings
- Keys mirroring the notification template events for consistency

#### [NEW] `i18n/request.ts` — `next-intl` config
- Language detection: browser preference → session cookie fallback → `en`

---

### Phase 7 — UI Surfaces (5 Surfaces)

#### Surface A — Customer Web App `app/(customer)/`

| Route | Component | Description |
|---|---|---|
| `/` | `BranchFinder` | Geolocation → nearby branches; if denied → all branches + city search filter |
| `/branch/[id]` | `ServiceSelector` | Service categories with icons, trilingual, "Not sure" guided flow |
| `/branch/[id]/join` | `JoinNowFlow` | Standard/priority self-select → **priority requires declaration checkbox** → customer details → confirmation |
| `/branch/[id]/book` | `BookLaterFlow` | **15-min slot** picker, real-time greyed unavailable slots, earliest-available suggestion |
| `/branch/[id]/book/[appointmentId]/arrive` | `ArrivalConfirm` | "I Have Arrived" button with countdown timer |
| `/track/[ticketId]` | `TicketTracker` | Live position, wait estimate, status, linked-pair view, Realtime sub |
| `/track/[ticketId]/feedback` | `FeedbackForm` | Star rating + tags + comment (auto-shown post-service) |

**Key UX details**: large touch targets (min 60px), font-size toggle, high-contrast theme, trilingual language switcher persisted to localStorage.

#### Surface B — Teller Console `app/(staff)/teller/`

| Component | Description |
|---|---|
| `CurrentTicketCard` | Token, service, pool badge, wait duration, customer name (NIC masked), linked-pair indicator |
| `UpcomingQueue` | Next 3–5 tickets with pool labels |
| `ActionBar` | Call Next, Mark Done (60s undo timer), Transfer, No Show, Recall buttons |
| `BreakModal` | Expected-duration input → triggers `startBreak` |
| `LinkedPairHold` | "On Hold" card with "Call Next Instead" action |

#### Surface C — Branch Manager Dashboard `app/(staff)/manager/`

| Component | Description |
|---|---|
| `TopBar` | Total waiting, avg wait, open counters, SLA alert count |
| `QueueStatusPanel` | Per-service queue depth bars with SLA color (green/amber/red) + inline SLA alerts |
| `CounterStatusPanel` | Per counter: teller, current ticket, service, time-in-service, status |
| `BreakOverrideModal` | Approve manager override when no alternative counter exists |
| `RebalanceAction` | One-click rebalance post-break |

#### Surface D — Hall Display Board `app/display/[branchId]/`

| Component | Description |
|---|---|
| `NowServingGrid` | Per active counter: token + pool-type color/icon |
| `ComingNextList` | 2–3 upcoming tokens |
| `PriorityNotice` | Static trilingual explanation of priority interleaving (rotating or always-visible) |
| `AudioAnnouncer` | Browser SpeechSynthesis API — **cycles SI → TA → EN** sequentially for every ticket call event |

- Realtime via direct Supabase channel subscription (`tickets` table, filtered by `branch_id`)
- Designed for fullscreen kiosk mode (`?branchId=XXX` query param)

#### Surface E — Head Office Admin Portal `app/(admin)/admin/`

| Component | Description |
|---|---|
| `CrossBranchAnalytics` | Avg wait times, SLA compliance %, throughput/hour — filterable by branch/service/date |
| `PeakHourCharts` | Historical peak-pattern visualization |
| `BranchConfigEditor` | Priority ratio, appointment caps, SLA thresholds, active service categories |
| `NICRestrictionManager` | Flagged NICs viewer with manual clear action |
| `StaffManagement` | Counter/teller assignment + **staff invite UI** (enter email + role → triggers Supabase invite email) |
| `SMSOutboxViewer` | Notification log viewer (logged SMS records) |

---

### Phase 8 — Cron Sweep Endpoint

#### [NEW] `app/api/cron/sweep/route.ts`
Runs every 1 minute via Vercel Cron. Four idempotent jobs:

| Job | Logic |
|---|---|
| **Appointment expiry** | `now > window_end AND status = 'pending'` → set `expired`, free slot, send (mocked) SMS |
| **Break reminders** | `break_started_at + expected_minutes` reached → notify teller. `+10 min` overdue → alert manager |
| **Re-estimation** | For pending appointments, recompute if they still fit their window; if at risk, send delay-alert SMS and update `window_start`/`window_end` |
| **SLA checks** | Tickets with `waiting` duration > `sla_thresholds` for their service category → trigger manager alert |

---

### Phase 9 — API Routes (Queue Engine Endpoints)

#### [NEW] `app/api/queue/` — REST endpoints for queue engine actions

All wrapped with auth middleware (teller/manager roles). Each calls the corresponding `lib/queue/engine.ts` function:

- `POST /api/queue/call-next`
- `POST /api/queue/mark-done`
- `POST /api/queue/transfer`
- `POST /api/queue/no-show`
- `POST /api/queue/recall`
- `POST /api/queue/start-break`
- `POST /api/queue/end-break`
- `POST /api/queue/issue-ticket` (public, rate-limited)
- `POST /api/queue/check-in-appointment` (public)

All inputs validated via **Zod** schemas.

---

### Phase 10 — Realtime Integration

#### Supabase Realtime subscriptions (client components)
- `TicketTracker` subscribes to `tickets` channel filtered by `ticket_id`
- `TellerConsole` subscribes to `tickets` filtered by `counter_id`
- `ManagerDashboard` subscribes to `tickets` and `counters` filtered by `branch_id`
- `DisplayBoard` subscribes to `tickets` filtered by `branch_id`

All subscriptions use the anon key with **Row Level Security (RLS)** policies:
- Customers: can only read their own ticket row
- Tellers: can read tickets scoped to their `branch_id`
- Display board: read-only, branch-scoped

---

## Verification Plan

### Automated Tests
- `npx drizzle-kit push` — validate schema migration runs cleanly
- Unit tests for `lib/queue/engine.ts` (Jest or Vitest): test each engine function against a test DB or mocked Drizzle instance
  - Specifically: `callNext` 3-pool ordering, linked-pair hold/resume, no-show re-queue, break redistribution, 60s undo guard
- Zod schema validation tests for all API inputs

### Manual Verification
- **Queue engine**: issue tickets across all 3 pools, verify `callNext` respects priority interleave ratio (e.g., call 3 standard → 1 priority → 3 standard)
- **Teller Console**: end-to-end — issue ticket, call next, mark done, verify 60s undo, test transfer and no-show
- **Break management**: start break, verify tickets reroute to correct counter with SMS log, verify manager alert when no alternative counter
- **Realtime**: open Display Board and Teller Console side-by-side, trigger `callNext` — verify both update without refresh
- **Appointments**: book → arrive → check-in → ticket appears in appointment pool → gets called ahead of waiting tickets
- **Linked pairs**: book 2-service ticket, verify both tokens issued, on-hold behavior at second counter
- **i18n**: switch language to Sinhala/Tamil on customer app and display board, verify all strings switch
- **Cron sweep**: manually trigger `/api/cron/sweep` and verify appointment expiry logic, SLA alerts

---

## Build Order (mirrors spec §11)

| Phase | Deliverable | Depends On |
|---|---|---|
| 1 | Project scaffolding + env setup | — |
| 2 | Drizzle schema + migrations | Phase 1 |
| 3 | Queue engine + estimation + token generation | Phase 2 |
| 4 | Auth + middleware + role guards | Phase 1 |
| 5 | Notification service + templates | Phase 2 |
| 6 | i18n messages setup | Phase 1 |
| 7A | Teller Console (validates engine) | Phases 3, 4 |
| 7B | Branch Manager Dashboard | Phases 3, 4 |
| 7C | Customer Web App (both flows, linked-pair, feedback) | Phases 3, 5, 6 |
| 7D | Hall Display Board (Realtime) | Phases 3, 10 |
| 7E | Head Office Admin Portal | Phases 3, 5 |
| 8 | Cron sweep endpoint | Phase 3 |
| 9 | API route layer | Phases 3, 4 |
| 10 | Realtime + RLS policies | Phase 2 |
| 11 | i18n pass across all customer/hall surfaces | Phase 6 |
| 12 | Accessibility pass (touch targets, contrast, font-size) | Phase 7 |
| 13 | Vercel deployment | All phases |
