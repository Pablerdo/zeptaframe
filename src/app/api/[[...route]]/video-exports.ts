import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { db } from "@/db/drizzle";
import { videoExports } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono()
  .get(
    "/",
    verifyAuth(),
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
        status: z.enum(["pending", "success", "error"]).optional(),
      })
    ),
    async (c) => {
      const auth = c.get("authUser");
      const { projectId, status } = c.req.valid("query");

      if (!auth.token?.id) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        let query;

        // Add status filter if provided
        if (status !== undefined) {
          query = db.select()
            .from(videoExports)
            .where(and(
              eq(videoExports.projectId, projectId),
              eq(videoExports.status, status as "pending" | "success" | "error")
            ));
        } else {
          query = db.select()
            .from(videoExports)
            .where(eq(videoExports.projectId, projectId));
        }

        const results = await query.orderBy(desc(videoExports.createdAt));
        
        return c.json({ videoExports: results });
      } catch (error) {
        console.error("Error fetching video exports:", error);
        return c.json({ error: "Failed to fetch video exports" }, 500);
      }
    }
  )

export default app; 