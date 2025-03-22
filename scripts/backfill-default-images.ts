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
    "name": "david-clode-nyvR6wbU1ho-unsplash (1).jpg",
    "key": "CAqhXLbXudM0JZFHQvRFfV52PBMGiyRt3IWc9hdrxHXpOjZA",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0JZFHQvRFfV52PBMGiyRt3IWc9hdrxHXpOjZA",
    "size": 585546,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "redcharlie-xtvo0ffGKlI-unsplash (1).jpg",
    "key": "CAqhXLbXudM0CMjtpFbXudM0gkxilIK6v2VWQH783hTN9GRe",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0CMjtpFbXudM0gkxilIK6v2VWQH783hTN9GRe",
    "size": 781983,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "joel-herzog-OWonUAgq33E-unsplash (1).jpg",
    "key": "CAqhXLbXudM0kZKJXbYXPh3Sa8iKMzIcNvJT105drVEZBelG",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0kZKJXbYXPh3Sa8iKMzIcNvJT105drVEZBelG",
    "size": 545280,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "hans-jurgen-mager-qQWV91TTBrE-unsplash (1).jpg",
    "key": "CAqhXLbXudM03AgZbVqcxOJqSIdaPZNmU05uzDeVWBHMX7g6",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM03AgZbVqcxOJqSIdaPZNmU05uzDeVWBHMX7g6",
    "size": 219315,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "fabien-bazanegue-dA-kSCn0K20-unsplash (1).jpg",
    "key": "CAqhXLbXudM0L6xCVeXmbaPVCNfzuR8IXFwhiODYWtjn2HJv",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0L6xCVeXmbaPVCNfzuR8IXFwhiODYWtjn2HJv",
    "size": 482652,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "ray-hennessy-R6ZlnE1zdS4-unsplash (1).jpg",
    "key": "CAqhXLbXudM0kvhJc1YXPh3Sa8iKMzIcNvJT105drVEZBelG",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0kvhJc1YXPh3Sa8iKMzIcNvJT105drVEZBelG",
    "size": 615325,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
  },
  {
    "name": "ronan-hello-u7w6Vo7v94k-unsplash (2).jpg",
    "key": "CAqhXLbXudM0FQ34COIfPFDXGYbz6xcm1LawNe38lsKjCJgi",
    "customId": null,
    "url": "https://f1itk9dd7g.ufs.sh/f/CAqhXLbXudM0FQ34COIfPFDXGYbz6xcm1LawNe38lsKjCJgi",
    "size": 576661,
    "uploadedAt": "2025-03-22T20:06:49.000Z"
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
