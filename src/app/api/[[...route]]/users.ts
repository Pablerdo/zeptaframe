import { z } from "zod";
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq, count } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { verifyAuth } from "@hono/auth-js";

import { db } from "@/db/drizzle";
import { users } from "@/db/schema";

const app = new Hono()
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6).max(30),
        conferenceCode: z.string().optional(),
      })
    ),
    async (c) => {
      const { name, email, password, conferenceCode } = c.req.valid("json");

      const hashedPassword = await bcrypt.hash(password, 12);

      const query = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (query[0]) {
        return c.json({ error: "Email already in use" }, 400);
      }

      // Check CVPR2025 account limit
      let credits = 5; // Default credits
      let finalConferenceCode = conferenceCode || null;
      
      if (conferenceCode === "CVPR2025") {
        // Count existing CVPR2025 users
        const cvprUserCount = await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.conferenceCode, "CVPR2025"));
        
        if (cvprUserCount[0].count >= 250) {  // Hard limiting at 250 accounts for CVPR2025
          return c.json({ 
            error: "CVPR2025 account limit reached. Maximum 400 accounts allowed." 
          }, 400);
        }
        
        credits = 50; // 100 free credits for CVPR attendees
      }

      await db.insert(users).values({
        email,
        name,
        password: hashedPassword,
        credits,
        conferenceCode: finalConferenceCode,
      });
      
      // Fetch the newly created user to get their ID
      const newUser = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name
        })
        .from(users)
        .where(eq(users.email, email));
      
      if (!newUser[0]) {
        return c.json({ error: "Failed to create user" }, 500);
      }
      
      // Return the user data with ID
      return c.json({ 
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name 
      }, 200);
    },
  )
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        email: z.string().email(),
      })
    ),
    async (c) => {
      const { email } = c.req.valid("query");
      const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name
      })
      .from(users)
      .where(eq(users.email, email));

      if (!user[0]) {
        return c.json({ error: "User not found" }, 404);
      }
    
      return c.json({ 
        id: user[0].id,
        email: user[0].email,
        name: user[0].name 
      }, 200);
    }
  )
  // Credits management endpoint
  .post(
    "/:userId/credits",
    verifyAuth(),
    zValidator(
      "json",
      z.object({
        action: z.enum(['add', 'deduct']),
        amount: z.number().positive(),
      })
    ),
    async (c) => {
      const auth = c.get("authUser");
      const userId = c.req.param("userId");

      // Only allow authenticated users to modify their own credits
      // or admins to modify anyone's credits (not implemented here)
      if (!auth.token?.id || (auth.token.id !== userId)) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { action, amount } = c.req.valid("json");

      // Get current user data
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Calculate new credits amount
      let newCredits = user.credits || 0;
      
      if (action === 'add') {
        newCredits += amount;
      } else if (action === 'deduct') {
        newCredits = Math.max(0, newCredits - amount);
      }

      // Update user credits in database
      await db
        .update(users)
        .set({ credits: newCredits })
        .where(eq(users.id, userId));

      return c.json({ credits: newCredits });
    }
  )
  // Get user credits endpoint
  .get(
    "/:userId/credits",
    verifyAuth(),
    async (c) => {
      const auth = c.get("authUser");
      const userId = c.req.param("userId");

      // Only allow authenticated users to see their own credits
      if (!auth.token?.id || (auth.token.id !== userId)) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Get user data
      const [user] = await db
        .select({
          credits: users.credits
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      return c.json({ credits: user.credits || 0 });
    }
  );

export default app;
