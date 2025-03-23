import { ComfyDeploy } from "comfydeploy"
import { NextResponse } from "next/server"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

// In-memory storage for video URLs (replace with a database in production)
const videoStore: { [key: string]: string } = {}

function findVideoUrl(outputs: any): string | undefined {
  if (!outputs || !Array.isArray(outputs)) return undefined;
  
  for (const output of outputs) {
    if (Array.isArray(output.data?.images) && output.data.images.length > 0) {
      // Check if any of the files have .gif or .mp4 extension
      const imageFile = output.data.images.find((file: any) => 
        file.filename?.endsWith('.png') || file.filename?.endsWith('.jpg') || file.filename?.endsWith('.jpeg')
      );
      
      // Return the URL of the first matching file, or fall back to the first file if no match
      return imageFile?.url || undefined;
    }
  }
  
  return undefined;
}

export async function POST(request: Request) {
  try {
    console.log("hello")
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

