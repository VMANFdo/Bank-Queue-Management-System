# Bank Queue Management System (BQMS)
## System Specification & Development Brief

**Status:** Initial system definition — production-track build
**Target hosting:** Vercel (Next.js)
**Audience:** Development team / AI coding agents working on this project

---

## 1. Project Overview

BQMS is a digital queue management platform for Sri Lankan bank branches. It replaces informal paper-slip queuing with a structured system spanning customer-facing booking/tracking, in-branch staff tools, and head-office analytics.

The system manages three concurrent ticket pools per service counter — **Appointments**, **Priority Walk-ins**, and **Standard Walk-ins** — and coordinates them through a single, transactional queue engine that every surface reads from and writes to.

### 1.1 Surfaces in Scope (v1)

| Surface | Users | Description |
|---|---|---|
| Customer Web App | Public | Branch/service selection, appointment booking, live ticket tracking, feedback |
| Teller Console | Counter staff | Current ticket, upcoming queue, call/done/transfer/no-show/recall, break management |
| Branch Manager Dashboard | Branch managers | Real-time branch overview, SLA alerts, counter status, rebalance tools |
| Hall Display Board | Public (in-branch screen) | Now serving / next up, realtime, trilingual |
| Head Office Admin Portal | Multi-branch admins | Cross-branch analytics, configuration, no-show management |

**Out of scope for v1:** physical kiosk hardware integration (printing, offline mode), real SMS delivery (mocked/logged), audio announcement hardware (simulated via on-screen + optional browser TTS).

### 1.2 Multi-Branch from Day One

Every entity (counters, services, tickets, config) is scoped to a `branch_id`. Single-branch deployments are just a tenant with one branch row — the Head Office portal and per-branch configuration model require multi-branch support to be foundational, not retrofitted.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router, TypeScript)** | Single codebase for UI + API (Route Handlers/Server Actions), first-class Vercel deployment |
| Database | **Supabase (Postgres)** | Managed Postgres with row-level locking for queue concurrency, plus built-in Realtime and Auth in one provider |
| ORM | **Drizzle ORM** | Lightweight, SQL-first, edge/serverless friendly, explicit schema for the queue tables |
| Realtime | **Supabase Realtime (Postgres logical replication)** | Drives live updates to display board, teller queues, manager dashboard, and customer tracking without aggressive polling |
| Auth (staff) | **Supabase Auth** (email/password + role claims) | Roles: `teller`, `branch_manager`, `head_office_admin`. Customers are not authenticated — tracked via ticket ID + phone/NIC |
| Styling/UI | **Tailwind CSS + shadcn/ui** | Fast, accessible component base; large touch targets and high-contrast themes configurable via design tokens |
| i18n | **next-intl** | Sinhala / Tamil / English across all customer- and hall-facing screens, persisted per session |
| Scheduled jobs | **Vercel Cron → API Route (every 1 min)** | Sweeps for: expired appointment windows, break-timer reminders, re-estimation triggers, SLA breach checks |
| Notifications | **Internal notification service module** (`lib/notifications.ts`) | Writes to a `notifications` table + renders in an admin log UI; designed with a single `send()` interface so a real SMS gateway (e.g. Notify.lk, Twilio) can be plugged in later without touching call sites |
| Validation | **Zod** | Shared schema validation for forms, API inputs, and Server Actions |
| Deployment | **Vercel** | Next.js native; Supabase connection via pooled connection string (Drizzle + `postgres.js` with connection pooling for serverless) |

### 2.1 Why Not X

- **WebSocket server / Socket.io**: avoided — doesn't suit Vercel's serverless functions. Supabase Realtime (over WebSocket on Supabase's side, client subscribes directly) covers this without Claude needing a custom realtime server.
- **Separate background worker (BullMQ, etc.)**: avoided for v1 — Vercel Cron + idempotent sweep endpoints cover the time-based logic (appointment expiry, break reminders) at this scale. Revisit if job volume grows.
- **Prisma**: Drizzle chosen for lighter cold-starts and more direct control over the transactional queue operations, which involve hand-tuned locking.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App (Vercel)                      │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐    │
│  │ Customer Web   │  │ Teller Console │  │ Manager Dashboard  │    │
│  │ App (public)   │  │ (auth: teller) │  │ (auth: manager)    │    │
│  └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘    │
│          │                   │                      │              │
│  ┌───────┴────────┐  ┌───────┴────────┐            │              │
│  │ Display Board   │  │ Head Office     │           │              │
│  │ (public, kiosk  │  │ Admin Portal    │           │              │
│  │  screen mode)   │  │ (auth: admin)   │           │              │
│  └───────┬────────┘  └───────┬────────┘            │              │
│          │                   │                      │              │
│          └───────────┬───────┴──────────────────────┘              │
│                       │                                             │
│              ┌────────┴─────────┐                                  │
│              │   Queue Engine    │  <- core module, all writes      │
│              │  (lib/queue/*)    │     go through transactions      │
│              └────────┬─────────┘                                  │
│                       │                                             │
│              ┌────────┴─────────┐                                  │
│              │ Drizzle ORM       │                                  │
│              └────────┬─────────┘                                  │
└───────────────────────┼─────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │  Supabase Postgres   │
              │  + Realtime + Auth   │
              └──────────────────────┘
                         ▲
                         │ Vercel Cron (1 min)
              ┌──────────┴──────────┐
              │ /api/cron/sweep      │
              │ - appointment expiry │
              │ - break reminders    │
              │ - SLA checks         │
              │ - re-estimation      │
              └──────────────────────┘
```

### 3.1 Core Principle: Single Queue Engine

All state-changing queue operations (`callNext`, `markDone`, `transfer`, `noShow`, `recall`, `startBreak`, `endBreak`, `checkInAppointment`, `issueTicket`) live in `lib/queue/` as Postgres-transaction-wrapped functions. No UI surface computes queue order independently — every surface calls the engine or reads from views/queries the engine maintains. This guarantees consistency between what the teller sees, what the display board shows, and what the customer's tracking screen says.

---

## 4. Database Schema (Core Entities)

> Implemented as Drizzle schema in `db/schema.ts`. Below is the conceptual model.

### 4.1 `branches`
- `id`, `name`, `address`, `lat`, `lng`, `phone`, `is_active`
- `config` (jsonb or related config table — see 4.7)

### 4.2 `services`
- `id`, `branch_id`, `name` (+ `name_si`, `name_ta`), `icon`, `category` (Cash Services, Account Services, Loans & Credit, Foreign Exchange, Trade Finance, Premier Banking), `avg_service_time_minutes`, `nic_required` (bool), `is_active`

### 4.3 `counters`
- `id`, `branch_id`, `name`, `assigned_teller_id`, `service_ids[]` (or join table `counter_services`), `status` (available | on_break | closed), `current_ticket_id`, `break_started_at`, `break_expected_minutes`

### 4.4 `tickets`
- `id`, `branch_id`, `token_number` (e.g. `A-105`, `P-001`, `S-047`), `service_id`
- `pool` (`appointment` | `priority` | `standard`)
- `status` (`waiting` | `called` | `in_service` | `done` | `no_show` | `transferred` | `cancelled` | `on_hold`)
- `customer_name`, `customer_phone`, `nic`
- `language` (si | ta | en)
- `linked_ticket_id` (nullable — self-referencing FK for linked pairs)
- `counter_id` (nullable until called)
- `created_at`, `called_at`, `service_started_at`, `done_at`
- `no_show_count` (denormalized for quick checks, also see 4.6)
- `original_wait_estimate_minutes`

### 4.5 `appointments`
- `id`, `ticket_id` (FK, nullable until check-in creates the ticket — or created upfront with status `pending`)
- `branch_id`, `service_id`
- `booking_code` (for fallback check-in)
- `window_start`, `window_end` (the 20-min window)
- `status` (`pending` | `checked_in` | `expired` | `cancelled` | `completed`)
- `arrival_confirmed_at`
- `customer_name`, `customer_phone`, `nic`

### 4.6 `nic_records`
- `nic`, `branch_id` (or global), `no_show_count`, `restricted_until` (nullable), `last_visit_at`

### 4.7 `branch_config`
- `branch_id`
- `priority_ratio_standard` (default 3), `priority_ratio_priority` (default 1)
- `appointment_slots_per_hour` (per service category — likely a child table `appointment_caps`)
- `sla_threshold_minutes` (per service category — child table `sla_thresholds`)
- `appointment_buffer_minutes` (default 15)
- `appointment_window_minutes` (default 20)
- `arrival_confirmation_lead_minutes` (default 10)

### 4.8 `notifications` (mocked SMS log)
- `id`, `ticket_id` (nullable), `appointment_id` (nullable), `phone`, `channel` (`sms`),
- `event_type` (ticket_issued | appointment_confirmed | tickets_away | called | window_opening | expired | delay_alert | linked_pair_update | reroute_update | priority_interleave_notice)
- `message_body`, `status` (`logged` | `sent` | `failed`), `created_at`

### 4.9 `feedback`
- `id`, `ticket_id`, `rating` (1-5), `tags[]`, `comment`, `created_at`

### 4.10 `audit_log`
- `id`, `actor_type` (`teller` | `system` | `manager`), `actor_id`, `action`, `ticket_id`, `details` (jsonb), `created_at`
- Important for "production-ready" — every queue engine action is logged for traceability and the 60-second undo window.

---

## 5. Queue Engine — Business Rules

### 5.1 The Three Pools & Call Order

Per counter, on `callNext`:

1. **Appointment check**: is there a checked-in appointment ticket whose `window_start` has passed and is not yet served, for a service this counter handles? If yes and the current ticket is `done` (not mid-service) → call it next, *ahead* of priority/standard.
2. **Priority interleaving**: maintain a per-counter running counter of standard tickets served since the last priority ticket. When it reaches the configured ratio (default 3), the next call is from the priority pool (if non-empty). If priority pool is empty, continue serving standard with no gap.
3. **Standard**: FIFO by `created_at` within the standard pool.

This logic must be a single function `getNextTicketForCounter(counterId)` used by both the teller's "Call Next" button and any auto-call logic.

### 5.2 Linked-Pair Tickets

- Issued together at ticket creation when a customer selects 2 services; both rows share `linked_ticket_id` pointing at each other.
- On `markDone` for ticket A, the engine checks if `linked_ticket_id` is set and the linked ticket B is currently in status `called` at another counter awaiting service start — if B was put `on_hold` because A was being served, resume B (re-call it).
- **Conflict rule**: if both A and B reach the front of their respective queues while the customer is still being served at the *other* counter, the second one to be called is set to `on_hold` and the teller's UI shows "Call Next Instead" to skip past it temporarily without dropping its queue position.
- During break rerouting, `linked_ticket_id` is preserved across counter reassignment.

### 5.3 Appointments

- **Booking**: customer selects branch + service + "Later" + time. System computes `estimated_clear_time` from current queue depth × avg service time for that service category. Booking allowed only if `estimated_clear_time + appointment_buffer_minutes <= requested_time`. If not, return the earliest valid slot instead.
- **Hourly cap**: `appointment_caps` table enforces max bookings per service category per hour; once reached, that slot is shown as full.
- **Window**: confirmed booking returns `window_start`–`window_end` (default 20 min), not an exact time.
- **Check-in (Option A)**: customer taps "I Have Arrived" in the web app — button disabled until `window_start - arrival_confirmation_lead_minutes` (default 10 min before). On tap, `appointments.status -> checked_in`, `arrival_confirmed_at` set, and the linked `tickets` row is created/activated into the appointment pool.
- **Fallback check-in**: if arrival isn't confirmed via app, customer can enter `booking_code` or NIC — same effect, used as an exception path (not the primary flow, but must exist).
- **No-show expiry**: cron sweep — if `now > window_end` and `status = pending`, set `status = expired`, free the slot, send (mocked) SMS.
- **Re-estimation**: cron sweep periodically recomputes whether `pending` appointments still fit their window; if at risk, send a delay-alert SMS with a revised window and update `window_start`/`window_end`.

### 5.4 Break Management

`startBreak(counterId, expectedMinutes)`:

1. `tickets_serviceable = floor(expectedMinutes / avg_service_time_for_this_counters_services)`
2. Counter continues serving up to `tickets_serviceable` more tickets normally.
3. After the Nth `markDone`, counter auto-locks (`status = on_break`), and remaining queued tickets for this counter are redistributed:
   - Find other open counters serving the same service(s), weighted by *lowest current queue depth first* (equalize depths).
   - Update each moved ticket's `counter_id`, preserve `created_at` (no loss of position), send (mocked) SMS with new counter + updated wait estimate.
4. If no alternative counter exists for a service this counter uniquely handles → do **not** allow the break to proceed automatically; create a manager alert requiring `open another counter` or `approve override` before `startBreak` completes.
5. At `expectedMinutes` mark, send a reminder notification to the teller. At `+10 min` overdue with no return, alert the branch manager.
6. `endBreak`: counter set `available`, starts receiving new tickets normally. No automatic pull-back of rerouted tickets. Manager dashboard exposes an optional one-click rebalance across open counters of a service.

### 5.5 No-Show Handling

- Teller marks `no_show` on a called ticket → ticket gets **one** automatic re-queue to the back of its original pool (status back to `waiting`, `created_at` effectively reset for ordering purposes — but original `created_at` retained for records).
- Second no-show for the same ticket (i.e., the re-queued one is also a no-show) → ticket status `no_show` (final), and `nic_records.no_show_count` incremented.
- If `nic_records.no_show_count >= 2` within a configurable rolling period → flag NIC as `restricted` (visible to Head Office; restricted customers may face limits on appointment booking — exact restriction policy configurable).

### 5.6 Transfers

- **Teller-initiated**: teller transfers current ticket to a different service/counter. New ticket enters destination queue; `created_at` preserved so original wait time counts toward position (i.e., not pushed to the very back as if newly arrived).
- **Customer-initiated wrong-counter correction**: when a teller transfers a ticket because the *customer* came to the wrong category (system/routing failure, not customer fault), the transferred ticket is placed at the **front of the standard pool** at the destination counter, regardless of pool type origin.

### 5.7 Recall

- Re-triggers the "now serving" announcement (display board + audio + repeat) for the currently `called`/`in_service` ticket without changing any state — purely a notification re-fire.

### 5.8 60-Second Undo

- `markDone` sets `done_at` but the ticket remains revertible to `in_service`/`called` for 60 seconds (checked via `done_at` timestamp comparison in the UI and guarded server-side). After 60s, `Call Next` becomes the only forward action and the done state is final.

---

## 6. Feature Specs by Surface

### 6.1 Customer Web App

- Landing: nearby branches (geolocation-based suggestion), each showing live wait time / crowd level (derived from queue depth)
- Branch detail → service category selection (icon + plain-language, trilingual) → "Not sure" guided flow
- Flow A — Join now: ticket type (standard/priority, self-declared) → details (name, phone, NIC with SI/TA/EN format validation for 9- and 12-digit formats, required/optional per service) → confirmation (wait estimate, position) → ticket issued + (mocked) SMS
- Flow B — Book later: time slot picker with real-time validation (greyed-out unavailable slots, earliest-available suggestion) → details → confirmation with window → (mocked) SMS with booking code
- "I Have Arrived" button: disabled/countdown until `window_start - 10min`, then active
- Linked-pair selection: multi-service selection issues two linked tickets, shown together in tracking UI
- Live tracking screen: token number, pool label, position, live wait estimate, status updates (including the "priority customer interleaved next, you remain at position X" quiet notice)
- Post-service: auto-switches to feedback (star rating + tags + optional comment) when ticket marked done

### 6.2 Teller Console

- Current ticket card: token, service, pool/priority badge, wait duration, customer name/NIC (masked appropriately), linked-pair indicator
- Upcoming queue: next 3–5 with pool labels
- Actions: Call Next (disabled until current resolved), Mark Done (with 60s undo), Transfer (destination picker), No Show, Recall
- Status toggle: Available / On Break (opens break-duration modal) / Counter Closed
- Linked-pair "on hold" card with "Call Next Instead" action

### 6.3 Branch Manager Dashboard

- Top bar: total waiting, avg wait time, open counters, active SLA alert count
- Queue Status panel: per service category, queue depth bar + count, SLA color (green/amber/red)
- Counter Status panel: per counter — teller name, current ticket, service, time-in-service, status
- Inline SLA alerts within queue cards (not separate panel)
- Actions: open additional counter, send alert to teller, rebalance (post-break), view reports
- Break-override approval modal (per 5.4 step 4)

### 6.4 Hall Display Board

- Public, no-auth, designed for large-screen kiosk display mode
- "Now Serving" per active counter with pool-type visual indicators (color/icon for standard/priority/appointment)
- "Coming Next" — 2–3 tokens
- Static permanent notice explaining the priority interleaving rule (trilingual, rotating or always-visible)
- Realtime via Supabase subscription — no polling
- Audio cue: trigger on-screen + (v1) browser speech synthesis in SI/TA/EN sequence as a stand-in for hall audio hardware

### 6.5 Head Office Admin Portal

- Cross-branch performance: avg wait times, SLA compliance %, throughput/hour, filterable by branch/service/date range
- Peak-hour pattern charts (historical)
- Branch configuration UI: priority ratio, appointment caps per service/hour, SLA thresholds, active service categories per branch
- NIC restriction management: view flagged NICs, manually clear restrictions
- Staff/counter assignment management
- Notification log viewer (the mocked SMS outbox)

---

## 7. Non-Functional Requirements

- **Trilingual (SI/TA/EN)**: every customer- and hall-facing string via next-intl; language persists for session (cookie/localStorage on client side — not Vercel KV, per-browser only)
- **Accessibility**: min 60px touch targets on customer/kiosk-style UI, high-contrast theme option, font-size toggle, large-text mode for elderly users
- **Concurrency safety**: all queue engine writes wrapped in Postgres transactions with row locks (`SELECT ... FOR UPDATE`) on the relevant counter/ticket rows to prevent double-calls
- **Auditability**: every engine action written to `audit_log`
- **Performance**: dashboard and display board queries should be served from indexed views; Supabase Realtime subscriptions scoped per-branch to avoid cross-tenant noise
- **Security**: staff routes protected by Supabase Auth + role middleware; customer routes are public but rate-limited (e.g. ticket creation) to prevent abuse; NIC data treated as PII — masked in UI where full value isn't operationally needed

---

## 8. Notification Service (Mocked SMS)

`lib/notifications/send.ts` exposes:

```ts
sendNotification({
  phone: string,
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
  ticketId?: string,
  appointmentId?: string,
})
```

- Renders the message body from a trilingual template keyed by `eventType` (templates cover all events listed in the original spec: ticket issued, appointment confirmed, N tickets away, called, window opening, expired, delay alert, linked-pair update, reroute update, priority-interleave notice)
- Writes to `notifications` table with `status = 'logged'`
- Visible in Head Office Admin Portal as an "SMS Outbox" — useful for demos and QA
- Designed so a future real implementation only changes the body of `send()`, not any call sites

---

## 9. Project Structure (Next.js App Router)

```
/app
  /(customer)
    /page.tsx                 — branch finder / landing
    /branch/[id]/...           — service selection, booking flows
    /track/[ticketId]/...      — live tracking + feedback
  /(staff)
    /teller/...                — teller console (auth: teller)
    /manager/...                — branch manager dashboard (auth: branch_manager)
  /(admin)
    /admin/...                  — head office portal (auth: head_office_admin)
  /display/[branchId]/...       — hall display board (public, fullscreen)
  /api
    /cron/sweep/route.ts        — Vercel Cron target
    /queue/...                  — queue engine endpoints (call-next, mark-done, etc.)
/lib
  /queue/                       — queue engine (transactional functions)
  /notifications/               — mocked SMS service + templates
  /estimation/                  — wait-time & slot estimation logic
  /auth/                         — role guards
/db
  /schema.ts                    — Drizzle schema
  /migrations/
/i18n
  /messages/{en,si,ta}.json
```

---

## 10. Deployment on Vercel

- Connect repo to Vercel; set environment variables: `DATABASE_URL` (Supabase pooled connection, e.g. via PgBouncer/Transaction mode for serverless), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- Vercel Cron configured in `vercel.json` to hit `/api/cron/sweep` every 1 minute
- Realtime: client components subscribe directly to Supabase channels using the anon key with row-level security policies scoped per branch
- Display board route designed for `?branchId=` query param so each branch's screen can bookmark its own view

---

## 11. Suggested Build Order

1. Drizzle schema + migrations for all entities in Section 4
2. Queue engine core functions (5.1–5.7) with unit tests against the DB (no UI)
3. Teller Console (validates engine end-to-end)
4. Branch Manager Dashboard
5. Customer Web App (both flows, linked-pair selection, feedback)
6. Hall Display Board (Realtime)
7. Cron sweep endpoint (appointment expiry, break reminders, re-estimation, SLA checks)
8. Head Office Admin Portal (config, analytics, NIC restrictions)
9. Notification templates + SMS outbox UI
10. i18n pass across all customer/hall surfaces
11. Accessibility pass (touch targets, contrast, font-size toggle)
