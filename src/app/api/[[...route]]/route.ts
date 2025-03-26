import { Context, Hono } from "hono";
import { handle } from "hono/vercel";
import { AuthConfig, initAuthConfig } from "@hono/auth-js";

// import ai from "./ai";
import users from "./users";
import images from "./images";
import projects from "./projects";
import creditPurchases from "./credit-purchases";
import videoGenerations from "./video-generations";
import imageGenerations from "./image-generations";

import authConfig from "@/auth.config";
import segmentedObjects from "./segmented-objects";
import videoExports from "./video-exports";

// Revert to "edge" if planning on running on the edge
export const runtime = "nodejs";

function getAuthConfig(c: Context): AuthConfig {
  return {
    secret: process.env.AUTH_SECRET,
    session: authConfig.session,
    pages: authConfig.pages,
    callbacks: authConfig.callbacks,
    providers: authConfig.providers
  };
}

const app = new Hono().basePath("/api");

app.use("*", initAuthConfig(getAuthConfig));

const routes = app
  // .route("/ai", ai)
  .route("/users", users)
  .route("/images", images)
  .route("/projects", projects)
  .route("/credit-purchases", creditPurchases)
  .route("/video-generations", videoGenerations)
  .route("/segmented-objects", segmentedObjects)
  .route("/video-exports", videoExports)
  .route("/image-generations", imageGenerations);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
