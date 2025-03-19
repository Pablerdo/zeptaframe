import { z } from "zod";
import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, and } from "drizzle-orm";
import { ComfyDeploy } from "comfydeploy";
import { db } from "@/db/drizzle";
import { videoGenerations } from "@/db/schema";

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
});

const app = new Hono()
  // Get all or filtered video generations for a project
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
            .from(videoGenerations)
            .where(and(
              eq(videoGenerations.projectId, projectId),
              eq(videoGenerations.status, status)
            ));
        } else {
          query = db.select()
            .from(videoGenerations)
            .where(eq(videoGenerations.projectId, projectId));
        }

        const results = await query.orderBy(desc(videoGenerations.createdAt));
        
        return c.json({ videoGenerations: results });
      } catch (error) {
        console.error("Error fetching video generations:", error);
        return c.json({ error: "Failed to fetch video generations" }, 500);
      }
    }
  )
  // Create a new video generation
  .post(
    "/",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        workbenchId: z.string(),
        runId: z.string(),
        status: z.enum(["pending", "success", "error"]).default("pending"),
        modelId: z.string(),
      })
    ),
    async (c) => {
      const auth = c.get("authUser");
      if (!auth.token?.id) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      try {
        const data = c.req.valid("json");
        
        // Simply save to database
        const inserted = await db.insert(videoGenerations).values({
          projectId: data.projectId,
          userId: auth.token.id,
          workbenchId: data.workbenchId,
          runId: data.runId,
          status: data.status,
          modelId: data.modelId,
          startTime: new Date(),
        }).returning();
        
        return c.json({ 
          success: true, 
          videoGeneration: inserted[0]
        });
      } catch (error) {
        console.error("Error storing video generation:", error);
        return c.json({ error: "Failed to store video generation" }, 500);
      }
    }
  )
  // Update a video generation status
  .patch(
    "/:runId",
    verifyAuth(),
    zValidator("param", z.object({ runId: z.string() })),
    zValidator(
      "json",
      z.object({
        status: z.enum(["pending", "success", "error"]).optional(),
        progress: z.number().optional(),
        videoUrl: z.string().optional(),
      })
    ),
    async (c) => {
      const auth = c.get("authUser");
      if (!auth.token?.id) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { runId } = c.req.valid("param");
      const updates = c.req.valid("json");

      try {
        const data = await db.update(videoGenerations)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(videoGenerations.runId, runId))
          .returning();

        if (data.length === 0) {
          return c.json({ error: "Video generation not found" }, 404);
        }

        return c.json({ data: data[0] });
      } catch (error) {
        console.error("Error updating video generation:", error);
        return c.json({ error: "Failed to update video generation" }, 500);
      }
    }
  );

export default app;
