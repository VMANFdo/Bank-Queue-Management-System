# BQMS — Task Checklist

## Phase 1 — Project Scaffolding & Infrastructure ✅
- [x] Initialize Next.js 14 App Router project with TypeScript, Tailwind, ESLint (`create-next-app`)
- [x] Install core dependencies
  - [x] `drizzle-orm`, `postgres`, `drizzle-kit`
  - [x] `@supabase/supabase-js`, `@supabase/ssr`
  - [x] `next-intl`
  - [x] `zod`
  - [x] `lucide-react`, Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge`
  - [/] `npm install` — re-running after removing non-existent `@radix-ui/react-badge`
- [x] Configure `next.config.ts` — next-intl plugin + security headers
- [x] Create `vercel.json` — cron schedule (`/api/cron/sweep` every 1 min)
- [x] Create `.env.example` — template with all required environment variable keys
- [x] Create `lib/env.ts` — Zod-validated environment config (fail-fast on missing vars)
- [x] Create `lib/utils.ts` — `cn()`, `maskNic()`, `isValidNic()`, `formatWaitTime()` helpers
- [x] Create `drizzle.config.ts` — schema + migrations path config
- [x] Create `middleware.ts` — next-intl + Supabase session guard combined
- [x] Create `i18n/routing.ts` — locale config (en / si / ta)
- [x] Create `i18n/request.ts` — next-intl server config
- [x] Set up `tsconfig.json` path aliases (`@/*`) — already set by create-next-app

---

## Phase 2 — Database Schema & Migrations ✅
- [x] Create `db/index.ts` — Drizzle client with pooled `postgres.js` connection
- [x] Create `db/schema.ts` — all 13 tables in dependency order:
  - [x] `branches`
  - [x] `branch_config`
  - [x] `appointment_caps` (child of `branch_config`)
  - [x] `sla_thresholds` (child of `branch_config`)
  - [x] `services`
  - [x] `counters`
  - [x] `counter_services` (join table)
  - [x] `tickets` (self-referencing `linked_ticket_id`)
  - [x] `appointments`
  - [x] `nic_records`
  - [x] `notifications`
  - [x] `feedback`
  - [x] `audit_log`
- [x] Add all required indexes (`tickets`, `appointments`, `audit_log`, `nic_records`)
- [x] Run `drizzle-kit generate` to produce migration files
- [x] Run `drizzle-kit push` / apply migration to Supabase Postgres (Completed: Seeded and verified tables)
- [x] Seed script — `db/seed.ts` with sample branch, services, and counters for development



---

## Phase 3 — Queue Engine Core (`lib/queue/`) ✅
- [x] `lib/queue/token.ts` — atomic token number generation per branch/pool/day (`A-NNN`, `P-NNN`, `S-NNN`)
- [x] `lib/queue/estimation.ts`
  - [x] `computeWaitEstimate(branchId, serviceId, pool)` — queue depth × avg service time
  - [x] `computeEarliestAppointmentSlot(branchId, serviceId, requestedTime)` — with buffer check
- [x] `lib/queue/engine.ts` — all transactional functions (each wrapped in `SELECT ... FOR UPDATE`):
  - [x] `getNextTicketForCounter(counterId)` — 3-pool priority logic (appointments → priority interleave → standard FIFO)
  - [x] `issueTicket(branchId, serviceId, pool, customerDetails, linkedServiceId?)` — creates ticket(s), computes estimate, fires SMS
  - [x] `callNext(counterId, actorId)` — calls `getNextTicketForCounter`, updates ticket to `called`, writes `audit_log`
  - [x] `markDone(ticketId, actorId)` — sets `done_at`, checks linked-pair for held partner, 60s undo guard
  - [x] `transfer(ticketId, destinationServiceId, actorId, reason)` — preserves `created_at`; wrong-counter correction goes to front of standard pool
  - [x] `noShow(ticketId, actorId)` — first no-show re-queues; second is final, increments `nic_records`
  - [x] `recall(ticketId, actorId)` — re-fires display + audio without state change
  - [x] `startBreak(counterId, expectedMinutes, actorId)` — `tickets_serviceable` calc, redistribution, manager alert if no alt counter
  - [x] `endBreak(counterId, actorId)` — sets counter `available`
  - [x] `checkInAppointment(appointmentId, method)` — activates appointment ticket into appointment pool
  - [x] `undoMarkDone(ticketId, actorId)` — 60-second undo window guard (bonus function)
- [x] Write unit tests for all engine functions (Vitest against test DB — `lib/queue/__tests__/engine.integration.test.ts`)
  - [x] 3-pool `callNext` ordering (ratio enforcement)
  - [x] Linked-pair hold/resume
  - [x] No-show re-queue → final no-show flow
  - [x] Break redistribution + manager alert path
  - [x] 60-second undo guard on `markDone`
  - [x] Transfer (normal + wrong_counter)
  - [x] Recall (state unchanged)
  - [x] Appointment check-in
  - [x] Token generation and wait estimation

---

## Phase 4 — Auth & Middleware
- [x] `middleware.ts` (root) — Supabase SSR session validation + role-based route protection
- [ ] `lib/auth/roles.ts` — `Role` enum + `requireRole(session, role)` helper
- [ ] `lib/auth/middleware.ts` — reusable guard for Server Actions and API routes
- [ ] `lib/auth/session.ts` — Supabase SSR session update helper (imported by middleware)
- [ ] `/auth/accept-invite` route — handles Supabase invite link; lets invited staff set their password on first login
- [ ] Rate limiting on public ticket creation (`/api/queue/issue-ticket`) — IP-based counter

---

## Phase 5 — Notification Service
- [ ] `lib/notifications/templates.ts` — trilingual message templates for all 10 event types:
  - `ticket_issued`, `appointment_confirmed`, `tickets_away`, `called`, `window_opening`, `expired`, `delay_alert`, `linked_pair_update`, `reroute_update`, `priority_interleave_notice`
- [ ] `lib/notifications/send.ts` — `sendNotification()` interface
  - [ ] Renders body from trilingual template (using ticket/appointment `language` field)
  - [ ] Writes to `notifications` table with `status = 'logged'`
  - [ ] Stub/mock: no real SMS gateway in v1

---

## Phase 6 — i18n Setup
- [x] `i18n/messages/en.json` — all customer and hall-facing strings
- [x] `i18n/messages/si.json` — Sinhala translations
- [x] `i18n/messages/ta.json` — Tamil translations
- [x] `i18n/request.ts` — `next-intl` config with language detection (browser pref → session cookie → `en`)
- [ ] Language switcher component (shared, used in customer app and display board)

---

## Phase 7A — Teller Console (`app/(staff)/teller/`)
- [ ] Auth guard — teller role only
- [ ] `CurrentTicketCard` — token, service, pool badge, wait duration, customer name (NIC masked), linked-pair indicator
- [ ] `UpcomingQueue` — next 3–5 tickets with pool labels; Realtime subscription on `counter_id`
- [ ] `ActionBar` — buttons:
  - [ ] Call Next (disabled until current resolved)
  - [ ] Mark Done (with 60s animated undo timer)
  - [ ] Transfer (destination service/counter picker modal)
  - [ ] No Show
  - [ ] Recall
- [ ] `BreakModal` — expected-duration input + `startBreak` trigger
- [ ] `LinkedPairHoldCard` — shows on-hold partner ticket; "Call Next Instead" action
- [ ] Counter status toggle — Available / On Break / Counter Closed

---

## Phase 7B — Branch Manager Dashboard (`app/(staff)/manager/`)
- [ ] Auth guard — branch_manager role only
- [ ] `TopBar` — total waiting, avg wait, open counters, active SLA alert count; Realtime updates
- [ ] `QueueStatusPanel` — per service category: queue depth bar + count + SLA color (green/amber/red) + inline SLA alerts
- [ ] `CounterStatusPanel` — per counter: teller name, current ticket, service, time-in-service, status badge
- [ ] `BreakOverrideModal` — approve override when no alternative counter exists (triggered by engine alert)
- [ ] `RebalanceAction` — one-click ticket rebalance across open counters post-break
- [ ] "Open Additional Counter" action
- [ ] "Send Alert to Teller" action

---

## Phase 7C — Customer Web App (`app/(customer)/`)
- [ ] Landing page `/` — `BranchFinder`
  - [ ] Geolocation → sort branches by proximity
  - [ ] Fallback: all branches listed + search-by-city text filter
  - [ ] Live crowd level / wait time per branch (derived from queue depth)
- [ ] `/branch/[id]` — `ServiceSelector`
  - [ ] Service categories with icons, trilingual labels
  - [ ] "Not sure" guided flow
- [ ] `/branch/[id]/join` — `JoinNowFlow`
  - [ ] Standard / Priority selector
  - [ ] **Priority path**: declaration checkbox + statement before proceeding (e.g. "I confirm I qualify for priority service as a senior citizen, person with disability, or pregnant individual")
  - [ ] Multi-service (linked-pair) selection — issues two linked tickets shown together
  - [ ] Customer details form (name, phone, NIC with SI/TA/EN format validation — 9 and 12-digit)
  - [ ] NIC field required/optional per service config
  - [ ] Confirmation screen (wait estimate, position) + mocked SMS
- [ ] `/branch/[id]/book` — `BookLaterFlow`
  - [ ] **15-minute** slot time picker
  - [ ] Real-time greyed-out unavailable/full slots
  - [ ] Earliest-available slot suggestion
  - [ ] Customer details form
  - [ ] Confirmation screen (window start/end + booking code) + mocked SMS
- [ ] `/branch/[id]/book/[appointmentId]/arrive` — `ArrivalConfirm`
  - [ ] "I Have Arrived" button — disabled with countdown until `window_start - 10 min`
  - [ ] Fallback: booking code / NIC entry for manual check-in
- [ ] `/track/[ticketId]` — `TicketTracker`
  - [ ] Token number, pool label, position, live wait estimate
  - [ ] Status updates incl. priority-interleave quiet notice
  - [ ] Linked-pair twin ticket shown together
  - [ ] Realtime subscription on `ticket_id`
  - [ ] Auto-transition to feedback form when ticket marked done
- [ ] `/track/[ticketId]/feedback` — `FeedbackForm`
  - [ ] 1–5 star rating
  - [ ] Tag selection (predefined)
  - [ ] Optional comment field

---

## Phase 7D — Hall Display Board (`app/display/[branchId]/`)
- [ ] Public, no-auth; designed for fullscreen kiosk mode (`?branchId=` query param)
- [ ] `NowServingGrid` — per active counter: token + pool-type visual indicator (color/icon)
- [ ] `ComingNextList` — 2–3 upcoming tokens
- [ ] `PriorityNotice` — static trilingual explanation of priority interleaving (always-visible or rotating)
- [ ] Realtime subscription on Supabase `tickets` channel filtered by `branch_id`
- [ ] `AudioAnnouncer` — browser SpeechSynthesis API
  - [ ] Cycles SI → TA → EN per ticket call event
  - [ ] Queue multiple calls (don't drop concurrent call events)
- [ ] Language switcher (SI/TA/EN) for display text (separate from audio cycling)

---

## Phase 7E — Head Office Admin Portal (`app/(admin)/admin/`)
- [ ] Auth guard — head_office_admin role only
- [ ] `CrossBranchAnalytics` — avg wait times, SLA compliance %, throughput/hour; filterable by branch/service/date range
- [ ] `PeakHourCharts` — historical peak-pattern charts (by hour of day, by day of week)
- [ ] `BranchConfigEditor`
  - [ ] Priority ratio sliders (standard:priority)
  - [ ] Appointment caps per service category per hour (4 slots/hr at 15-min intervals)
  - [ ] SLA thresholds per service category
  - [ ] Active service categories per branch toggle
- [ ] `NICRestrictionManager` — view flagged NICs, manually clear restrictions
- [ ] `StaffManagement`
  - [ ] List staff (tellers, managers) per branch
  - [ ] **Staff invite UI**: email input + role selector → triggers Supabase `inviteUserByEmail()` with role metadata
  - [ ] Counter/teller assignment
- [ ] `SMSOutboxViewer` — notification log with event type, phone (masked), message body, status, timestamp

---

## Phase 8 — Cron Sweep Endpoint
- [ ] `app/api/cron/sweep/route.ts`
  - [ ] Secure with `CRON_SECRET` header check
  - [ ] Job 1 — **Appointment expiry**: `now > window_end AND status = 'pending'` → set `expired`, free slot, send (mocked) SMS
  - [ ] Job 2 — **Break reminders**: at `break_started_at + expected_minutes` → notify teller; at `+10 min` overdue → alert manager
  - [ ] Job 3 — **Re-estimation**: for pending appointments, recompute if window still holds; if at risk → send delay-alert SMS, update `window_start`/`window_end`
  - [ ] Job 4 — **SLA checks**: tickets waiting > `sla_thresholds` for their service category → trigger manager alert
  - [ ] All jobs are idempotent (safe to run every minute)
- [ ] Add cron config to `vercel.json`

---

## Phase 9 — API Routes (`app/api/queue/`)
- [ ] `POST /api/queue/issue-ticket` — public, rate-limited, Zod-validated
- [ ] `POST /api/queue/check-in-appointment` — public, Zod-validated
- [ ] `POST /api/queue/call-next` — auth: teller
- [ ] `POST /api/queue/mark-done` — auth: teller
- [ ] `POST /api/queue/transfer` — auth: teller
- [ ] `POST /api/queue/no-show` — auth: teller
- [ ] `POST /api/queue/recall` — auth: teller
- [ ] `POST /api/queue/start-break` — auth: teller
- [ ] `POST /api/queue/end-break` — auth: teller
- [ ] Zod input schemas for all endpoints in `lib/queue/schemas.ts`

---

## Phase 10 — Realtime & Row Level Security
- [ ] Enable Supabase Realtime on `tickets` and `counters` tables
- [ ] Define RLS policies:
  - [ ] `tickets` — customers read own row only (by `ticket_id`), tellers read branch-scoped, display board read-only branch-scoped
  - [ ] `counters` — tellers and managers read branch-scoped
  - [ ] `notifications` — head_office_admin read-only
  - [ ] `audit_log` — head_office_admin + branch_manager read-only
- [ ] Verify Supabase Realtime subscriptions are correctly scoped per-branch (no cross-tenant leakage)

---

## Phase 11 — i18n Pass (Customer & Hall Surfaces)
- [ ] Audit all customer-facing strings in `app/(customer)/` for hardcoded English text → replace with `next-intl` keys
- [ ] Audit all hall-facing strings in `app/display/` similarly
- [ ] Verify Sinhala and Tamil translations are complete and accurate for all keys
- [ ] NIC format validation messages trilingual
- [ ] Error and loading state messages trilingual
- [ ] Appointment time slot labels and confirmation messages trilingual

---

## Phase 12 — Accessibility Pass
- [ ] Verify minimum 60px touch targets on all customer and kiosk UI interactive elements
- [ ] Add high-contrast theme toggle (customer app + display board)
- [ ] Add font-size toggle (small / default / large) for elderly users
- [ ] Keyboard navigation for teller console
- [ ] ARIA labels on all icon-only buttons (Call Next, Mark Done, etc.)
- [ ] Sufficient color contrast ratios (WCAG AA minimum) on SLA color indicators

---

## Phase 13 — Vercel Deployment
- [ ] Connect GitHub repo to Vercel project
- [ ] Configure environment variables in Vercel dashboard:
  - [ ] `DATABASE_URL` (Supabase pooled connection — PgBouncer/Transaction mode)
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - [ ] `CRON_SECRET`
- [ ] Verify `vercel.json` cron job is recognized and active
- [ ] Test Realtime subscriptions work in production (anon key + RLS)
- [ ] Smoke test all 5 surfaces on production URL
- [ ] Verify display board can be bookmarked per branch (`?branchId=XXX`)
