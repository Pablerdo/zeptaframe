import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";

import { unsplash } from "@/lib/unsplash";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";


const DEFAULT_COUNT = 50;
const DEFAULT_COLLECTION_IDS = ["317099"];

const app = new Hono()
  .get("/", verifyAuth(), async (c) => {

    const auth = c.get("authUser");
    if (!auth?.token?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get user's uploaded unsplashImages
    const uploadedImages = await db
      .select()
      .from(uploads)
      .where(eq(uploads.userId, auth.token.id))
      .orderBy(desc(uploads.createdAt));

    const unsplashImages = await unsplash.photos.getRandom({
      collectionIds: DEFAULT_COLLECTION_IDS,
      count: DEFAULT_COUNT,
    });

    if (unsplashImages.errors) {
      return c.json({ error: "Something went wrong" }, 400);
    }

    let unsplashResponse = unsplashImages.response;

    if (!Array.isArray(unsplashResponse)) {
      unsplashResponse = [unsplashResponse];
    }

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
      ...unsplashResponse
    ];

    return c.json({ data: combinedImages });

  });

export default app;
