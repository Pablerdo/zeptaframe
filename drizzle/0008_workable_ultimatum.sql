CREATE TABLE IF NOT EXISTS "video_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"job_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"video_url" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_exports" ADD CONSTRAINT "video_exports_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
