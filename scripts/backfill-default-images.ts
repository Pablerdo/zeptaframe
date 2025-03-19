import * as dotenv from 'dotenv';
dotenv.config(); // This loads environment variables from .env file

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { defaultImages } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Replace with your actual connection string (NEVER commit this to git)
const DATABASE_URL ="postgresql://neondb_owner:npg_KFAPcwt5rL2f@ep-tight-scene-a4hak8uh-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);
const db = drizzle(sql);

const images = [
    {
      "name": "ray-hennessy-R6ZlnE1zdS4-unsplash.jpg",
      "key": "CAqhXLbXudM0WtFfQnDipfsUIjzSckY7GZB6AnV4ar32NvRJ",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0WtFfQnDipfsUIjzSckY7GZB6AnV4ar32NvRJ",
      "size": 1618963,
      "uploadedAt": "2025-03-19T22:29:20.000Z"
    },
    {
      "name": "hans-jurgen-mager-qQWV91TTBrE-unsplash.jpg",
      "key": "CAqhXLbXudM0CSrlutbXudM0gkxilIK6v2VWQH783hTN9GRe",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0CSrlutbXudM0gkxilIK6v2VWQH783hTN9GRe",
      "size": 949221,
      "uploadedAt": "2025-03-19T22:29:20.000Z"
    },
    {
      "name": "ronan-hello-u7w6Vo7v94k-unsplash.jpg",
      "key": "CAqhXLbXudM0YqPQWjgiRfd4rtPiLyhuDw276GvSeOmlQBW9",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0YqPQWjgiRfd4rtPiLyhuDw276GvSeOmlQBW9",
      "size": 13069088,
      "uploadedAt": "2025-03-19T22:29:20.000Z"
    },
    {
      "name": "david-clode-nyvR6wbU1ho-unsplash.jpg",
      "key": "CAqhXLbXudM0JGkyNvRFfV52PBMGiyRt3IWc9hdrxHXpOjZA",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0JGkyNvRFfV52PBMGiyRt3IWc9hdrxHXpOjZA",
      "size": 5510128,
      "uploadedAt": "2025-03-19T22:29:20.000Z"
    },
    {
      "name": "joel-herzog-OWonUAgq33E-unsplash.jpg",
      "key": "CAqhXLbXudM0gytga6eN6y21hvWoZjUJKs5SfgiHmTBalbtr",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0gytga6eN6y21hvWoZjUJKs5SfgiHmTBalbtr",
      "size": 3166717,
      "uploadedAt": "2025-03-19T22:29:15.000Z"
    },
    {
      "name": "fabien-bazanegue-dA-kSCn0K20-unsplash.jpg",
      "key": "CAqhXLbXudM0fmo2BwxJxdDaHU5GY0lnQCkwoK8LvWrMbui1",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0fmo2BwxJxdDaHU5GY0lnQCkwoK8LvWrMbui1",
      "size": 2946743,
      "uploadedAt": "2025-03-19T22:29:15.000Z"
    },
    {
      "name": "redcharlie-xtvo0ffGKlI-unsplash.jpg",
      "key": "CAqhXLbXudM0D4apxRzZvfhb3pLnMi8XtH4OSg2FVsCBNla6",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0D4apxRzZvfhb3pLnMi8XtH4OSg2FVsCBNla6",
      "size": 4711345,
      "uploadedAt": "2025-03-19T22:29:15.000Z"
    },
    {
      "name": "bear_double.jpg",
      "key": "CAqhXLbXudM0HcACy3E7elECV0KFfyBdNhJTQZ28tcALW3uo",
      "customId": null,
      "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0HcACy3E7elECV0KFfyBdNhJTQZ28tcALW3uo",
      "size": 1402371,
      "uploadedAt": "2025-03-19T23:32:32.000Z"
    }
]

// Function to extract photographer name from filename
function extractPhotographerName(filename: string): string {
  // Example: "ray-hennessy-R6ZlnE1zdS4-unsplash.jpg" -> "Ray Hennessy"
  const parts = filename.split('-');
  if (parts.length >= 2) {
    // Capitalize first letter of each part of the name
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${firstName} ${lastName}`;
  }
  return "Unknown";
}

async function backfillDefaultImages() {
  console.log("Starting backfill for default_image table...");
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const image of images) {
    try {
      // Check if image with this URL already exists
      const existingImage = await db
        .select()
        .from(defaultImages)
        .where(eq(defaultImages.url, image.url));
      
      if (existingImage.length === 0) {
        // Extract photographer name from filename
        const photographerName = extractPhotographerName(image.name);
        
        // Insert new image
        await db.insert(defaultImages).values({
          id: crypto.randomUUID(),
          url: image.url,
          photographerName
        });
        
        insertedCount++;
        console.log(`Inserted image: ${image.name} by ${photographerName}`);
      } else {
        skippedCount++;
        console.log(`Skipped existing image: ${image.name}`);
      }
    } catch (error) {
      console.error(`Error processing image ${image.name}:`, error);
    }
  }
  
  console.log(`Backfill completed. Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
}

// Run the function
backfillDefaultImages()
  .then(() => {
    console.log("Backfill process finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  });
