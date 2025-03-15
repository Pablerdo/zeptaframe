import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";
import { auth } from "@/auth";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const session = await auth();

      if (!session) throw new UploadThingError("Unauthorized");
      if (!session.user?.id) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db.insert(uploads).values({
        url: file.url,
        name: file.name,
        userId: metadata.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return { url: file.url };
    }),
  residualUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const session = await auth();

      if (!session) throw new UploadThingError("Unauthorized");
      if (!session.user?.id) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return 
    }),

} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
