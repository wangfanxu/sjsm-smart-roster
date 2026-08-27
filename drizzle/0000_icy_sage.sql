CREATE TYPE "public"."assignment_source" AS ENUM('solver', 'manual');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'unavailable', 'preferred');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."planning_period_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."replacement_status" AS ENUM('open', 'approved', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role_proficiency" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('volunteer', 'team_leader', 'administrator');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"source" "assignment_source" DEFAULT 'solver' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_exact_unique" UNIQUE("candidate_id","service_id","role_id","user_id"),
	CONSTRAINT "assignment_one_role_per_service_user" UNIQUE("candidate_id","service_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"user_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"status" "availability_status" NOT NULL,
	"note" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_user_id_service_date_pk" PRIMARY KEY("user_id","service_date")
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assignment_id" uuid,
	"event_type" text NOT NULL,
	"channel" "notification_channel" DEFAULT 'email' NOT NULL,
	"recipient_email" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "notification_attempt_count_nonnegative" CHECK ("notification_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planning_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" "planning_period_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_period_valid_dates" CHECK ("planning_periods"."starts_on" <= "planning_periods"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "replacement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"replacement_user_id" uuid,
	"status" "replacement_status" DEFAULT 'open' NOT NULL,
	"reason" text,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "roster_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_period_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "candidate_status" DEFAULT 'draft' NOT NULL,
	"hard_constraints_satisfied" boolean NOT NULL,
	"objective_score" numeric(12, 4),
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"explanation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_period_version_unique" UNIQUE("planning_period_id","version"),
	CONSTRAINT "candidate_version_positive" CHECK ("roster_candidates"."version" > 0),
	CONSTRAINT "published_candidate_satisfies_hard_constraints" CHECK ("roster_candidates"."status" <> 'published' OR "roster_candidates"."hard_constraints_satisfied")
);
--> statement-breakpoint
CREATE TABLE "scheduling_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_period_id" uuid,
	"key" text NOT NULL,
	"is_hard" boolean DEFAULT false NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constraint_period_key_unique" UNIQUE("planning_period_id","key"),
	CONSTRAINT "constraint_weight_nonnegative" CHECK ("scheduling_constraints"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_role_requirements" (
	"service_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"required_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "service_role_requirements_service_id_role_id_pk" PRIMARY KEY("service_id","role_id"),
	CONSTRAINT "service_role_required_count_positive" CHECK ("service_role_requirements"."required_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_period_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_period_start_title_unique" UNIQUE("planning_period_id","starts_at","title")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"proficiency" "role_proficiency" DEFAULT 'secondary' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"system_role" "system_role" DEFAULT 'volunteer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_candidate_id_roster_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."roster_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_periods" ADD CONSTRAINT "planning_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_requests_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_requests_replacement_user_id_users_id_fk" FOREIGN KEY ("replacement_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_planning_period_id_planning_periods_id_fk" FOREIGN KEY ("planning_period_id") REFERENCES "public"."planning_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_constraints" ADD CONSTRAINT "scheduling_constraints_planning_period_id_planning_periods_id_fk" FOREIGN KEY ("planning_period_id") REFERENCES "public"."planning_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_role_requirements" ADD CONSTRAINT "service_role_requirements_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_role_requirements" ADD CONSTRAINT "service_role_requirements_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_planning_period_id_planning_periods_id_fk" FOREIGN KEY ("planning_period_id") REFERENCES "public"."planning_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_published_candidate_per_period" ON "roster_candidates" USING btree ("planning_period_id") WHERE "roster_candidates"."status" = 'published';