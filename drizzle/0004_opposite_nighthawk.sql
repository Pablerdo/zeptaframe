CREATE TABLE IF NOT EXISTS "video_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"workbenchId" text NOT NULL,
	"runId" text NOT NULL,
	"status" text NOT NULL,
	"videoUrl" text,
	"modelId" text NOT NULL,
	"startTime" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_generation_runId_unique" UNIQUE("runId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_generation" ADD CONSTRAINT "video_generation_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
