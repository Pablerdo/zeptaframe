import { NextRequest, NextResponse } from "next/server"
import { ComfyDeploy } from "comfydeploy"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

export async function POST(req: NextRequest) {
  const data = await req.json()
 
  // Log the received data for debugging
  console.log("Received data:", data)

  const webhookUrl = process.env.DEPLOYMENT_MODE === 'production' 
  ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/comfydeploy/join-video/webhook`
  : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}/api/comfydeploy/join-video/webhook`;

  
  try {
    const result = await cd.run.deployment.queue({
      deploymentId: data.workflowData.workflow_id,
      webhook: webhookUrl,
      inputs: {
        input_video_1: data.videoGenData.input_video_1,
        input_video_2: data.videoGenData.input_video_2,
        input_video_3: data.videoGenData.input_video_3,
        input_video_4: data.videoGenData.input_video_4,
        input_video_5: data.videoGenData.input_video_5,
        input_video_6: data.videoGenData.input_video_6,
        input_video_7: data.videoGenData.input_video_7,
        input_video_8: data.videoGenData.input_video_8,
        input_video_9: data.videoGenData.input_video_9,
        input_video_10: data.videoGenData.input_video_10,
      },
    })

    if (result) {
      const runId = result.runId
      console.log("Run ID:", runId)

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

