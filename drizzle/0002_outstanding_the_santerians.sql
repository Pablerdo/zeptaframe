CREATE TABLE IF NOT EXISTS "segmented_object" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"coordinate_path" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "segmented_object" ADD CONSTRAINT "segmented_object_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
