import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";
import { auth } from "@/auth";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "8MB" } })
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
  residualUploader: f({ image: { maxFileSize: "8MB" } })
    .middleware(async ({ req }) => {
      const session = await auth();

      if (!session) throw new UploadThingError("Unauthorized");
      if (!session.user?.id) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return 
    }),
  videoUploader: f({ video: { maxFileSize: "32MB" } })
    .middleware(async ({ req }) => {
      const session = await auth();

      if (!session) throw new UploadThingError("Unauthorized");
      if (!session.user?.id) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {      
      return { url: file.url };
    }),
  fastVideoUploader: f({ video: { maxFileSize: "32MB" } })
    .middleware(async ({ req }) => {
      // No authentication required for fast subdomain
      // Check if request is from fast subdomain
      const hostname = req.headers.get('host') || '';
      const isFastSubdomain = hostname.startsWith('fast.');
      
      if (!isFastSubdomain) {
        throw new UploadThingError("This uploader is only for fast subdomain");
      }
      
      return { userId: "fast-user" }; // Placeholder user ID
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Store in uploads table for tracking
      await db.insert(uploads).values({
        url: file.url,
        name: file.name,
        userId: metadata.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return { url: file.url };
    }),
  fastImageUploader: f({ image: { maxFileSize: "16MB" } })
    .middleware(async ({ req }) => {
      // No authentication required for fast subdomain
      // Check if request is from fast subdomain
      const hostname = req.headers.get('host') || '';
      const isFastSubdomain = hostname.startsWith('fast.');
      
      if (!isFastSubdomain) {
        throw new UploadThingError("This uploader is only for fast subdomain");
      }
      
      return { userId: "fast-user" }; // Placeholder user ID
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return;
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
