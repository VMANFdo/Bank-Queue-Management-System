CREATE TABLE "appointment_caps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"service_category" text NOT NULL,
	"hour_of_day" integer NOT NULL,
	"max_bookings" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"branch_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"booking_code" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"arrival_confirmed_at" timestamp with time zone,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"nic" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"ticket_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_config" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"priority_ratio_standard" integer DEFAULT 3 NOT NULL,
	"priority_ratio_priority" integer DEFAULT 1 NOT NULL,
	"appointment_buffer_minutes" integer DEFAULT 15 NOT NULL,
	"appointment_window_minutes" integer DEFAULT 20 NOT NULL,
	"arrival_confirmation_lead_minutes" integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"phone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter_services" (
	"counter_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "counter_services_counter_id_service_id_pk" PRIMARY KEY("counter_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assigned_teller_id" uuid,
	"status" text DEFAULT 'closed' NOT NULL,
	"current_ticket_id" uuid,
	"break_started_at" timestamp with time zone,
	"break_expected_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"tags" text[] NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nic_records" (
	"nic" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"restricted_until" timestamp with time zone,
	"last_visit_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nic_records_nic_branch_id_pk" PRIMARY KEY("nic","branch_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"appointment_id" uuid,
	"phone" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"event_type" text NOT NULL,
	"message_body" text NOT NULL,
	"status" text DEFAULT 'logged' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_si" text NOT NULL,
	"name_ta" text NOT NULL,
	"icon" text NOT NULL,
	"category" text NOT NULL,
	"avg_service_time_minutes" integer NOT NULL,
	"nic_required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"service_category" text NOT NULL,
	"threshold_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"token_number" text NOT NULL,
	"service_id" uuid NOT NULL,
	"pool" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"nic" text,
	"language" text NOT NULL,
	"linked_ticket_id" uuid,
	"counter_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"service_started_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"original_wait_estimate_minutes" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_caps" ADD CONSTRAINT "appointment_caps_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_config" ADD CONSTRAINT "branch_config_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_services" ADD CONSTRAINT "counter_services_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."counters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_services" ADD CONSTRAINT "counter_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counters" ADD CONSTRAINT "counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nic_records" ADD CONSTRAINT "nic_records_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_thresholds" ADD CONSTRAINT "sla_thresholds_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_counter_id_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."counters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_branch_window_status_idx" ON "appointments" USING btree ("branch_id","window_start","status");--> statement-breakpoint
CREATE INDEX "audit_log_ticket_idx" ON "audit_log" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_branch_status_pool_idx" ON "tickets" USING btree ("branch_id","status","pool","counter_id");--> statement-breakpoint
CREATE INDEX "tickets_branch_created_at_idx" ON "tickets" USING btree ("branch_id","created_at");