import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { defaultImages, uploads } from "@/db/schema";


const DEFAULT_COUNT = 50;
const DEFAULT_COLLECTION_IDS = ["317099"];

// Create a middleware for optional authentication
const optionalAuth = () => async (c: any, next: any) => {
  try {
    await verifyAuth()(c, next);
  } catch (e) {
    // If auth fails, still continue but with no auth user
    await next();
  }
};

const app = new Hono()
  .get("/", optionalAuth(), async (c) => {
    const auth = c.get("authUser");
    let uploadedImages: any[] = [];
    
    // Only fetch user uploads if authenticated
    if (auth?.token?.id) {
      uploadedImages = await db
        .select()
        .from(uploads)
        .where(eq(uploads.userId, auth.token.id))
        .orderBy(desc(uploads.createdAt));
    }

    // Default images for unauthenticated users
    const defaultResponse = await db
      .select()
      .from(defaultImages)


    // Combine images - for unauthenticated users, uploadedImages will be empty
    const combinedImages = [
      ...uploadedImages.map(img => ({
        id: img.id,
        urls: {
          regular: img.url,
          small: img.url,
          thumb: img.url,
        },
        links: { html: img.url },
        user: { name: "My Upload" },
        alt_description: img.name || "Uploaded image"
      })),
      ...defaultResponse.map(img => ({
        id: img.id,
        urls: {
          regular: img.url,
          small: img.url,
          thumb: img.url,
        },
        links: { html: img.url },
        user: { name: img.photographerName || "Default Image" },
        alt_description: img.photographerName || "Default Image"
      }))
    ];

    return c.json({ data: combinedImages });
  });

export default app;
