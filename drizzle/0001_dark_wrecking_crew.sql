CREATE TABLE IF NOT EXISTS "upload" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"userId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upload" ADD CONSTRAINT "upload_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
