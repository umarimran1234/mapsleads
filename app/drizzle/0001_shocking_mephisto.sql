CREATE TABLE "search_tiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"idx" integer NOT NULL,
	"lat" text NOT NULL,
	"lon" text NOT NULL,
	"radius" integer NOT NULL,
	"zoom" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"engine_job_id" text,
	"rows" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" text PRIMARY KEY NOT NULL,
	"keywords" jsonb NOT NULL,
	"area" text NOT NULL,
	"grid_n" integer NOT NULL,
	"depth" integer NOT NULL,
	"find_emails" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"phase" text DEFAULT 'geocoding' NOT NULL,
	"bbox" jsonb,
	"tiles_total" integer DEFAULT 0 NOT NULL,
	"tiles_done" integer DEFAULT 0 NOT NULL,
	"tiles_failed" integer DEFAULT 0 NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"sites_total" integer DEFAULT 0 NOT NULL,
	"sites_checked" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "search_id" text;--> statement-breakpoint
ALTER TABLE "search_tiles" ADD CONSTRAINT "search_tiles_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_tiles_search_idx" ON "search_tiles" USING btree ("search_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;