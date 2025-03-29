import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { segmentedObjects } from "@/db/schema";


const DEFAULT_COUNT = 50;
const DEFAULT_COLLECTION_IDS = ["317099"];

const app = new Hono()
  .get("/", verifyAuth(), async (c) => {

    const auth = c.get("authUser");
    if (!auth?.token?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const uploadedSegmentedObjects = await db
      .select()
      .from(segmentedObjects)
      .where(eq(segmentedObjects.userId, auth.token.id))
      .orderBy(desc(segmentedObjects.createdAt));

    return c.json({ data: uploadedSegmentedObjects });

  });

export default app;
