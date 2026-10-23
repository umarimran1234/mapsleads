CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"keywords" jsonb NOT NULL,
	"city" text NOT NULL,
	"depth" integer NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"lead_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"job_id" text,
	"title" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"emails" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"rating" real,
	"reviews" integer,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_job_idx" ON "leads" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");