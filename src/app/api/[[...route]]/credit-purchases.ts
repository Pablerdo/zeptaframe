import Stripe from "stripe";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { verifyAuth } from "@hono/auth-js";

import { checkIsActive } from "@/features/subscriptions/lib";
import { generationPrices } from "@/features/subscriptions/utils";

import { stripe } from "@/lib/stripe";
import { db } from "@/db/drizzle";
import { subscriptions, users } from "@/db/schema";

const app = new Hono()
  // .post("/billing", verifyAuth(), async (c) => {
  //   const auth = c.get("authUser");

  //   if (!auth.token?.id) {
  //     return c.json({ error: "Unauthorized" }, 401);
  //   }

  //   const [subscription] = await db
  //     .select()
  //     .from(subscriptions)
  //     .where(eq(subscriptions.userId, auth.token.id));

  //   if (!subscription) {
  //     return c.json({ error: "No subscription found" }, 404);
  //   }

  //   const session = await stripe.billingPortal.sessions.create({
  //     customer: subscription.customerId,
  //     return_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
  //   });

  //   if (!session.url) {
  //     return c.json({ error: "Failed to create session" }, 400);
  //   }

  //   return c.json({ data: session.url });
  // })
  // .get("/current", verifyAuth(), async (c) => {
  //   const auth = c.get("authUser");

  //   if (!auth.token?.id) {
  //     return c.json({ error: "Unauthorized" }, 401);
  //   }

  //   const [subscription] = await db
  //     .select()
  //     .from(subscriptions)
  //     .where(eq(subscriptions.userId, auth.token.id));

  //   const active = checkIsActive(subscription);

  //   return c.json({
  //     data: {
  //       ...subscription,
  //       active,
  //     },
  //   });
  // })
  // .post("/checkout", verifyAuth(), async (c) => {
  //   const auth = c.get("authUser");

  //   if (!auth.token?.id) {
  //     return c.json({ error: "Unauthorized" }, 401);
  //   }

  //   const session = await stripe.checkout.sessions.create({
  //     success_url: `${process.env.NEXT_PUBLIC_APP_URL}?success=1`,
  //     cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}?canceled=1`,
  //     payment_method_types: ["card"],
  //     mode: "subscription",
  //     billing_address_collection: "auto",
  //     customer_email: auth.token.email || "",
  //     line_items: [
  //       {
  //         price: process.env.STRIPE_500_CREDITS_PRICE_ID,
  //         quantity: 1,
  //       },
  //     ],
  //     metadata: {
  //       userId: auth.token.id,
  //     },
  //   });

  //   const url = session.url;
    
  //   if (!url) {
  //     return c.json({ error: "Failed to create session" }, 400);
  //   }

  //   return c.json({ data: url });
  // })
  .post(
    "/webhook",
    async (c) => {
      const body = await c.req.text();
      const signature = c.req.header("Stripe-Signature") as string;

      console.log("inside stripe webhook")
      console.log(body)

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
      } catch (error) {
        return c.json({ error: "Invalid signature" }, 400);
      }

      const session = event.data.object as Stripe.Checkout.Session;

      console.log("session", session)

      console.log("credits amount", session?.metadata?.creditsAmount)

      if (event.type === "checkout.session.completed") {
        // Check if this is a credits purchase
        if (session?.metadata?.type === "credits") {
          // Handle credits purchase
          if (!session?.metadata?.userId || !session?.metadata?.creditsAmount) {
            return c.json({ error: "Invalid session" }, 400);
          }

          const userId = session.metadata.userId;
          const creditsAmount = parseInt(session.metadata.creditsAmount);

          try {
            // Get the current user from the database
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, userId));

            if (!user) {
              return c.json({ error: "User not found" }, 404);
            }

            // Calculate new credits amount following the same logic as the users/[userId]/credits endpoint
            const newCredits = (user.credits || 0) + creditsAmount;

            // Update user credits in database
            await db
              .update(users)
              .set({ credits: newCredits })
              .where(eq(users.id, userId));

            // Log success
            console.log(`Added ${creditsAmount} credits to user ${userId}, new balance: ${newCredits}`);
          } catch (error) {
            console.error("Error processing credits:", error);
            return c.json({ error: "Failed to process credits" }, 500);
          }
          
          return c.json(null, 200);
        }
      }

      if (event.type === "invoice.payment_succeeded") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        if (!session?.metadata?.userId) {
          return c.json({ error: "Invalid session" }, 400);
        }

      }

      return c.json(null, 200);
    },
  )
  .post("/credits", verifyAuth(), async (c) => {
    const auth = c.get("authUser");

    if (!auth.token?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get return_url from the request body if provided
    const body = await c.req.json();
    const projectId = body.projectId;
    // Fixed price for credits (500 credits for $5)
    const creditsAmount = 500;

    let success_url = "";
    let cancel_url = "";

    if (!projectId) {
      success_url = `${process.env.NEXT_PUBLIC_APP_URL}?credits_success=1`;
      cancel_url = `${process.env.NEXT_PUBLIC_APP_URL}?credits_canceled=1`;
    } else {
      success_url = `${process.env.NEXT_PUBLIC_APP_URL}/editor/${projectId}?credits_success=1`;
      cancel_url = `${process.env.NEXT_PUBLIC_APP_URL}/editor/${projectId}?credits_canceled=1`;
    }

    const session = await stripe.checkout.sessions.create({
      success_url,
      cancel_url,
      payment_method_types: ["card"],
      mode: "payment",
      billing_address_collection: "auto",
      customer_email: auth.token.email || "",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${creditsAmount} Credits`,
              description: `Credits for Zeptaframe`,
            },
            unit_amount: generationPrices.fiveHundredCreditsPrice * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: auth.token.id,
        creditsAmount: creditsAmount.toString(),
        type: "credits",
      },
    });

    const url = session.url;
    
    if (!url) {
      return c.json({ error: "Failed to create session" }, 400);
    }

    return c.json({ data: url });
  });

export default app;
