import { ComfyDeploy } from "comfydeploy"
import { NextResponse } from "next/server"
import { db } from "@/db/drizzle"
import { videoGenerations } from "@/db/schema"
import { eq } from "drizzle-orm"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

// In-memory storage for video URLs (replace with a database in production)
const videoStore: { [key: string]: string } = {}

function findVideoUrl(outputs: any): string | undefined {
  if (!outputs || !Array.isArray(outputs)) return undefined;
  
  for (const output of outputs) {
    if (Array.isArray(output.data?.files) && output.data.files.length > 0) {
      // Check if any of the files have .gif or .mp4 extension
      const videoFile = output.data.files.find((file: any) => 
        file.filename?.endsWith('_forDisplay_00001.gif') || file.filename?.endsWith('_forDisplay_00001.mp4')
      );
      
      // Return the URL of the first matching file, or fall back to the first file if no match
      return videoFile?.url || undefined;
    }
  }
  
  return undefined;
}

function findLastFrameUrl(outputs: any): string | undefined {
  const outputWithLastFrame = outputs.find((output: any) => 
    Array.isArray(output.data?.images) && output.data.images.length > 0
  );

  return outputWithLastFrame?.data.images[0]?.url;
}

export async function POST(request: Request) {
  try {
    const data = await cd.validateWebhook({ request })

    const { status, runId, outputs } = data

    console.log("Webhook received:", { status, runId, outputs })

    console.log(JSON.stringify(outputs, null, 2))

    const videoUrl = findVideoUrl(outputs)

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
      
      console.log(`Updated video generation ${runId} to success with URL ${videoUrl}`)
    } else if (status === "failed") {
      await db.update(videoGenerations)
        .set({ 
          status: "error",
          updatedAt: new Date()
        })
        .where(eq(videoGenerations.runId, runId))
      
      console.log(`Updated video generation ${runId} to error status`)
    }

    // Return success to ComfyDeploy
    return NextResponse.json({ message: "success" }, { status: 200 })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 })
  }
}

// API route to get the video URL
export async function GET(request: Request) {
  const url = new URL(request.url)
  const runId = url.searchParams.get("runId")

  if (!runId) {
    return NextResponse.json({ error: "No runId provided" }, { status: 400 })
  }

  if (videoStore[runId]) {
    return NextResponse.json({ status: "success", videoUrl: videoStore[runId] })
  } else {
    return NextResponse.json({ status: "pending" })
  }
}
