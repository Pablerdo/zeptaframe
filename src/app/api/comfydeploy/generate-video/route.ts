import { NextRequest, NextResponse } from "next/server"
import { ComfyDeploy } from "comfydeploy"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

export async function POST(req: NextRequest) {
  const data = await req.json()
 
  // Log the received data for debugging
  // console.log("Received data:", data)

  const webhookUrl = process.env.DEPLOYMENT_MODE === 'production' 
  ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/comfydeploy/webhook-video`
  : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}api/comfydeploy/webhook-video`;

  
  try {
    let result;

    if (data.workflowData.mode === "text-only") {
      result = await cd.run.deployment.queue({
        deploymentId: data.workflowData.workflow_id,
        webhook: webhookUrl,
        inputs: {
          input_num_frames: data.videoGenData.input_num_frames,
          input_image: data.videoGenData.input_image,
          input_prompt: data.videoGenData.input_prompt,
        },
      })
    } else if (data.workflowData.mode === "animation") {
      result = await cd.run.deployment.queue({
        deploymentId: data.workflowData.workflow_id,
        webhook: webhookUrl,
        inputs: {
          input_num_frames: data.videoGenData.input_num_frames,
          input_image: data.videoGenData.input_image,
          input_masks: data.videoGenData.input_masks,
          input_prompt: data.videoGenData.input_prompt,
          input_trajectories: data.videoGenData.input_trajectories,
          input_rotations: data.videoGenData.input_rotations,
          input_scalings: data.videoGenData.input_scalings,
          input_centroids: data.videoGenData.input_centroids,
          input_camera: data.videoGenData.input_camera,
          input_degradation: data.videoGenData.input_degradation,
          // input_boundary_degradation: data.videoGenData.input_boundary_degradation,
          // input_annulus_degradation: data.videoGenData.input_annulus_degradation,
          // input_degradation: data.videoGenData.input_degradation,
          // input_boundary_px1: data.videoGenData.input_boundary_px1,
          // input_boundary_px2: data.videoGenData.input_boundary_px2,
        },
      })
    }

    if (result) {
      const runId = result.runId
      // console.log("Run ID:", runId)

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

