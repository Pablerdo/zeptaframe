import { ComfyDeploy } from "comfydeploy"
import { NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { videoGenerations } from "@/db/schema"
import { eq } from "drizzle-orm"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

// In-memory storage for video URLs (backup to database)
const videoStore: { [key: string]: string } = {}

function findOutputVideoUrl(outputs: any): string | undefined {
  if (!outputs || !Array.isArray(outputs)) return undefined;
  
  for (const output of outputs) {
    if (Array.isArray(output.data?.files) && output.data.files.length > 0) {
      // Check if any of the files have "forDisplay" in filename
      const videoFile = output.data.files.find((file: any) => 
        file.filename?.match(/forDisplay/)
      );
      
      // If found a matching file, return its URL
      if (videoFile) {
        return videoFile.url;
      }
    }
  }
  return undefined;
}

function findLastFrameUrl(outputs: any): string | undefined {
  if (!outputs || !Array.isArray(outputs)) return undefined;

  for (const output of outputs) {
    if (Array.isArray(output.data?.images) && output.data.images.length > 0) {
      // Check if any of the images have "lastFrame" in filename
      const lastFrame = output.data.images.find((image: any) => 
        image.filename?.match(/lastFrame/)
      );
      
      // If found a matching file, return its URL
      if (lastFrame) {
        return lastFrame.url;
      }
    }
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const data = await cd.validateWebhook({ request })

    const { status, runId, outputs } = data

    console.log("Fast webhook received:", { status, runId, outputs })

    console.log(JSON.stringify(outputs, null, 2))

    const videoUrl = findOutputVideoUrl(outputs)
    const lastFrameUrl = findLastFrameUrl(outputs)

    if (status === "success") {
      // Update in-memory store for GET requests
      videoStore[runId] = videoUrl || ""
      
      // Update database entry
      await db.update(videoGenerations)
        .set({ 
          status: "success", 
          videoUrl: videoUrl || "",
          lastFrameUrl: lastFrameUrl || "",
          updatedAt: new Date()
        })
        .where(eq(videoGenerations.runId, runId))
      
      console.log(`Fast video generation ${runId} completed successfully with URL: ${videoUrl}`);
    } else if (status === "failed") {
      await db.update(videoGenerations)
        .set({ 
          status: "error",
          updatedAt: new Date()
        })
        .where(eq(videoGenerations.runId, runId))
      
      console.log(`Fast video generation ${runId} failed`);
    }

    // Return success to ComfyDeploy
    return NextResponse.json({ message: "success" }, { status: 200 })
  } catch (error) {
    console.error("Error processing fast webhook:", error)
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 })
  }
}

// API route to get the video URL (status checking)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const runId = url.searchParams.get("runId")

  if (!runId) {
    return NextResponse.json({ error: "No runId provided" }, { status: 400 })
  }

  try {
    // First check in-memory store for quick access
    if (videoStore[runId]) {
      return NextResponse.json({ 
        status: "success", 
        videoUrl: videoStore[runId] 
      })
    }

    // If not in memory, check database
    const [videoGeneration] = await db
      .select()
      .from(videoGenerations)
      .where(eq(videoGenerations.runId, runId))
      .limit(1);

    if (!videoGeneration) {
      return NextResponse.json({ error: "Video generation not found" }, { status: 404 });
    }

    if (videoGeneration.status === "success" && videoGeneration.videoUrl) {
      // Cache in memory for future requests
      videoStore[runId] = videoGeneration.videoUrl;
      
      return NextResponse.json({
        status: "success",
        videoUrl: videoGeneration.videoUrl,
        lastFrameUrl: videoGeneration.lastFrameUrl,
        runId: videoGeneration.runId,
        startTime: videoGeneration.startTime,
        updatedAt: videoGeneration.updatedAt,
      });
    } else if (videoGeneration.status === "error") {
      return NextResponse.json({ 
        status: "error",
        runId: videoGeneration.runId,
        startTime: videoGeneration.startTime,
        updatedAt: videoGeneration.updatedAt,
      });
    } else {
      // Still pending
      return NextResponse.json({ 
        status: "pending",
        runId: videoGeneration.runId,
        startTime: videoGeneration.startTime,
        updatedAt: videoGeneration.updatedAt,
      });
    }

  } catch (error) {
    console.error("Error checking fast video generation status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
} 