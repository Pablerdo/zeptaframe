import { z } from "zod";
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";

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
        password: z.string().min(3).max(20),
      })
    ),
    async (c) => {
      const { name, email, password } = c.req.valid("json");

      const hashedPassword = await bcrypt.hash(password, 12);

      const query = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (query[0]) {
        return c.json({ error: "Email already in use" }, 400);
      }

      await db.insert(users).values({
        email,
        name,
        password: hashedPassword,
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
  );

export default app;
