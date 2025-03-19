import * as dotenv from 'dotenv';
dotenv.config(); // This loads environment variables from .env file

// import { db } from "../src/db/drizzle";
import { videoGenerations, projects } from "../src/db/schema";
import { eq, isNull } from "drizzle-orm";

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

// Replace with your actual connection string (NEVER commit this to git)
const DATABASE_URL = ""
const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function backfillVideoGenerationUserIds() {
  console.log("Starting userId backfill for video_generation table...");
  
  // Get all video generations without userId
  const generations = await db
    .select()
    .from(videoGenerations)
    .where(isNull(videoGenerations.userId));
  
  console.log(`Found ${generations.length} video generations without userId`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Update each record with the userId from its project
  for (const generation of generations) {
    try {
      // Get the project to find its userId
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, generation.projectId));
      
      if (project) {
        // Update the video generation with the project's userId
        await db
          .update(videoGenerations)
          .set({ userId: project.userId })
          .where(eq(videoGenerations.id, generation.id));
        
        successCount++;
        console.log(`Updated generation ${generation.id} with userId ${project.userId}`);
      } else {
        errorCount++;
        console.error(`Could not find project for generation ${generation.id}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error updating generation ${generation.id}:`, error);
    }
  }
  
  console.log(`Backfill completed. Success: ${successCount}, Errors: ${errorCount}`);
}

// Run the function
backfillVideoGenerationUserIds()
  .then(() => {
    console.log("Backfill process finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  });
