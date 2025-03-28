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
  ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/comfydeploy/webhook-video`
  : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}/api/comfydeploy/webhook-video`;

  
  try {
    let result;

    if (data.workflowData.mode === "text-only") {
      result = await cd.run.deployment.queue({
        deploymentId: data.workflowData.workflow_id,
        webhook: webhookUrl,
        inputs: {
          input_image: data.videoGenData.input_image,
          input_prompt: data.videoGenData.input_prompt,
        },
      })
    } else if (data.workflowData.mode === "animation") {
      result = await cd.run.deployment.queue({
        deploymentId: data.workflowData.workflow_id,
        webhook: webhookUrl,
        inputs: {
          input_image: data.videoGenData.input_image,
          input_masks: data.videoGenData.input_masks,
          input_prompt: data.videoGenData.input_prompt,
          input_trajectories: data.videoGenData.input_trajectories,
          input_rotations: data.videoGenData.input_rotations,
          input_camera: data.videoGenData.input_camera,
        },
      })
    }

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

