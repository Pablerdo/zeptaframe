import { createRouteHandler } from "uploadthing/next";
 
import { ourFileRouter } from "./core";
 
// Export a Route Handler that uses the FileRouter
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
