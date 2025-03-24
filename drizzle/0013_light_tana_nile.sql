ALTER TABLE "video_exports" RENAME COLUMN "job_id" TO "runId";--> statement-breakpoint
ALTER TABLE "video_exports" RENAME COLUMN "video_url" TO "videoUrl";--> statement-breakpoint
ALTER TABLE "video_exports" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "video_exports" ALTER COLUMN "runId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_exports" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "video_exports" DROP COLUMN IF EXISTS "error";--> statement-breakpoint
ALTER TABLE "video_exports" DROP COLUMN IF EXISTS "completed_at";--> statement-breakpoint
ALTER TABLE "video_exports" DROP COLUMN IF EXISTS "metadata";