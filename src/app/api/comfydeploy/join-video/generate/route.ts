import { NextRequest, NextResponse } from "next/server"
import { ComfyDeploy } from "comfydeploy"
import { db } from "@/db/drizzle";
import { videoExports } from "@/db/schema";

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {

    const data = await req.json();

    const videoUrls = data.videoGenData.videoUrls;
    const projectId = data.videoGenData.projectId;

    const workflowId = data.workflowData.workflow_id;

    // Log the received data for debugging
    console.log("Video URLs:", videoUrls)

    const webhookUrl = process.env.DEPLOYMENT_MODE === 'production' 
    ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/comfydeploy/join-video/webhook`
    : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}/api/comfydeploy/join-video/webhook`;

    // Calculate the total number of frames to join
    const input_number = videoUrls.length * 49

    const result = await cd.run.deployment.queue({
      deploymentId: workflowId,
      webhook: webhookUrl,
      inputs: {
        ...videoUrls.reduce((acc: any, url: any, index: any) => ({
          ...acc,
          [`input_video_${index + 1}`]: url
        }), {}),
        input_number: input_number
      },
    })

    if (result) {
      const runId = result.runId
      console.log("Run ID:", runId)

      // Create a record in our database to track this export
      await db.insert(videoExports)
        .values({
          projectId: projectId || null, // Default if not provided
          status: 'pending',
          runId: runId
        })
        

      return NextResponse.json({
        message: "Video generation started",
        runId: runId,
      })
    } else {
      throw new Error("Failed to start video generation")
    }
  } catch (error) {
    console.error("Error starting video generation:", error)
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 })
  }
}

