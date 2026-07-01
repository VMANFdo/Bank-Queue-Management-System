import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── 1. BRANCHES ─────────────────────────────────────────────────────────────
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  phone: text("phone").notNull(),
  bankCode: text("bank_code").default("BOC").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── 2. BRANCH CONFIGURATION ─────────────────────────────────────────────────
export const branchConfig = pgTable("branch_config", {
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .primaryKey(),
  priorityRatioStandard: integer("priority_ratio_standard").default(3).notNull(),
  priorityRatioPriority: integer("priority_ratio_priority").default(1).notNull(),
  appointmentBufferMinutes: integer("appointment_buffer_minutes")
    .default(15)
    .notNull(),
  appointmentWindowMinutes: integer("appointment_window_minutes")
    .default(20)
    .notNull(),
  arrivalConfirmationLeadMinutes: integer(
    "arrival_confirmation_lead_minutes"
  )
    .default(10)
    .notNull(),
});

// ─── 3. APPOINTMENT CAPACITY CAPS ─────────────────────────────────────────────
export const appointmentCaps = pgTable("appointment_caps", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  serviceCategory: text("service_category").notNull(), // e.g. "Cash Services", "Account Services"
  hourOfDay: integer("hour_of_day").notNull(), // 0 to 23
  maxBookings: integer("max_bookings").notNull(), // Hourly limit
});

// ─── 4. SLA THRESHOLDS ────────────────────────────────────────────────────────
export const slaThresholds = pgTable("sla_thresholds", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  serviceCategory: text("service_category").notNull(),
  thresholdMinutes: integer("threshold_minutes").notNull(),
});

// ─── 5. SERVICES ─────────────────────────────────────────────────────────────
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // English
  nameSi: text("name_si").notNull(), // Sinhala
  nameTa: text("name_ta").notNull(), // Tamil
  icon: text("icon").notNull(), // Icon identifier (Lucide name)
  category: text("category").notNull(), // e.g. "Cash Services", "Loans & Credit"
  avgServiceTimeMinutes: integer("avg_service_time_minutes").notNull(),
  nicRequired: boolean("nic_required").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// ─── 6. COUNTERS ─────────────────────────────────────────────────────────────
export const counters = pgTable("counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // e.g. "Counter 1", "Counter 2"
  assignedTellerId: uuid("assigned_teller_id"), // Refers to Supabase Auth user ID (auth.users)
  status: text("status", { enum: ["available", "on_break", "closed"] })
    .default("closed")
    .notNull(),
  // Note: Omit direct Postgres foreign key constraint to avoid circular reference with tickets table.
  // We manage the integrity inside our Queue Engine transactions instead.
  currentTicketId: uuid("current_ticket_id"),
  breakStartedAt: timestamp("break_started_at", { withTimezone: true }),
  breakExpectedMinutes: integer("break_expected_minutes"),
});

// ─── 7. COUNTER-SERVICES JOIN TABLE ──────────────────────────────────────────
export const counterServices = pgTable(
  "counter_services",
  {
    counterId: uuid("counter_id")
      .references(() => counters.id, { onDelete: "cascade" })
      .notNull(),
    serviceId: uuid("service_id")
      .references(() => services.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.counterId, table.serviceId] }),
  })
);

// ─── 8. TICKETS ──────────────────────────────────────────────────────────────
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    tokenNumber: text("token_number").notNull(), // e.g. A-101, P-003, S-044
    serviceId: uuid("service_id")
      .references(() => services.id, { onDelete: "cascade" })
      .notNull(),
    pool: text("pool", { enum: ["appointment", "priority", "standard"] }).notNull(),
    status: text("status", {
      enum: [
        "waiting",
        "called",
        "in_service",
        "done",
        "no_show",
        "transferred",
        "cancelled",
        "on_hold",
      ],
    })
      .default("waiting")
      .notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    nic: text("nic"), // PII - masked in UI where appropriate
    language: text("language", { enum: ["en", "si", "ta"] }).notNull(),
    // Linked pair support for multi-service tickets
    linkedTicketId: uuid("linked_ticket_id"),
    counterId: uuid("counter_id").references(() => counters.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    serviceStartedAt: timestamp("service_started_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    noShowCount: integer("no_show_count").default(0).notNull(),
    originalWaitEstimateMinutes: integer("original_wait_estimate_minutes").notNull(),
  },
  (table) => ({
    branchStatusPoolIdx: index("tickets_branch_status_pool_idx").on(
      table.branchId,
      table.status,
      table.pool,
      table.counterId
    ),
    branchCreatedAtIdx: index("tickets_branch_created_at_idx").on(
      table.branchId,
      table.createdAt
    ),
  })
);

// ─── 9. APPOINTMENTS ─────────────────────────────────────────────────────────
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id").references(() => tickets.id, {
      onDelete: "set null",
    }), // Created/linked upon check-in
    branchId: uuid("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    serviceId: uuid("service_id")
      .references(() => services.id, { onDelete: "cascade" })
      .notNull(),
    bookingCode: text("booking_code").notNull(), // Unique confirmation reference
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    status: text("status", {
      enum: ["pending", "checked_in", "expired", "cancelled", "completed"],
    })
      .default("pending")
      .notNull(),
    arrivalConfirmedAt: timestamp("arrival_confirmed_at", {
      withTimezone: true,
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    nic: text("nic").notNull(),
  },
  (table) => ({
    branchWindowStatusIdx: index("appointments_branch_window_status_idx").on(
      table.branchId,
      table.windowStart,
      table.status
    ),
  })
);

// ─── 10. NIC VISITS AND RESTRICTIONS ─────────────────────────────────────────
export const nicRecords = pgTable(
  "nic_records",
  {
    nic: text("nic").notNull(),
    branchId: uuid("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    noShowCount: integer("no_show_count").default(0).notNull(),
    restrictedUntil: timestamp("restricted_until", { withTimezone: true }),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.nic, table.branchId] }),
  })
);

// ─── 11. NOTIFICATIONS OUTBOX LOG ────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").references(() => tickets.id, {
    onDelete: "set null",
  }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, {
    onDelete: "set null",
  }),
  phone: text("phone").notNull(),
  channel: text("channel").default("sms").notNull(),
  eventType: text("event_type").notNull(), // e.g. ticket_issued, called
  messageBody: text("message_body").notNull(),
  status: text("status", { enum: ["logged", "sent", "failed"] })
    .default("logged")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── 12. FEEDBACK LOG ────────────────────────────────────────────────────────
export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .references(() => tickets.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating").notNull(), // 1 to 5 stars
  tags: text("tags").array().notNull(), // Pre-defined feedback tags
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── 13. AUDIT LOGS ──────────────────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorType: text("actor_type", { enum: ["teller", "system", "manager"] }).notNull(),
    actorId: uuid("actor_id").notNull(), // Refers to teller/manager user ID or system service
    action: text("action").notNull(), // e.g. "call_next", "start_break"
    ticketId: uuid("ticket_id").references(() => tickets.id, {
      onDelete: "set null",
    }),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ticketIdx: index("audit_log_ticket_idx").on(table.ticketId),
  })
);
