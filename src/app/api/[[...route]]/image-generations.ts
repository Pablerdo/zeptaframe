import { z } from "zod";
import { Hono } from "hono";
import { verifyAuth } from "@hono/auth-js";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, and } from "drizzle-orm";
import { ComfyDeploy } from "comfydeploy";
import { db } from "@/db/drizzle";
import { imageGenerations } from "@/db/schema";

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
});

const app = new Hono()
  // Get all or filtered image generations for a project
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
            .from(imageGenerations)
            .where(and(
              eq(imageGenerations.projectId, projectId),
              eq(imageGenerations.status, status)
            ));
        } else {
          query = db.select()
            .from(imageGenerations)
            .where(eq(imageGenerations.projectId, projectId));
        }

        const results = await query.orderBy(desc(imageGenerations.createdAt));
        
        return c.json({ imageGenerations: results });
      } catch (error) {
        console.error("Error fetching image generations:", error);
        return c.json({ error: "Failed to fetch image generations" }, 500);
      }
    }
  )
  // Create a new image generation
  .post(
    "/",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        status: z.enum(["pending", "success", "error"]).default("pending"),
        imageUrl: z.string().optional(),
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
        const inserted = await db.insert(imageGenerations).values({
          projectId: data.projectId,
          userId: auth.token.id,
          status: data.status,
          imageUrl: data.imageUrl,
        }).returning();
        
        return c.json({ 
          success: true, 
          imageGeneration: inserted[0]
        });
      } catch (error) {
        console.error("Error storing image generation:", error);
        return c.json({ error: "Failed to store image generation" }, 500);
      }
    }
  )
  // Update an image generation status
  .patch(
    "/:runId",
    verifyAuth(),
    zValidator("param", z.object({ runId: z.string() })),
    zValidator(
      "json",
      z.object({
        status: z.enum(["pending", "success", "error"]).optional(),
        progress: z.number().optional(),
        imageUrl: z.string().optional(),
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
        const data = await db.update(imageGenerations)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(imageGenerations.runId, runId))
          .returning();

        if (data.length === 0) {
          return c.json({ error: "Image generation not found" }, 404);
        }

        return c.json({ data: data[0] });
      } catch (error) {
        console.error("Error updating image generation:", error);
        return c.json({ error: "Failed to update image generation" }, 500);
      }
    }
  );

export default app;
