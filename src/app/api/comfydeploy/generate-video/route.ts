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
    const result = await cd.run.deployment.queue({
      deploymentId: "8b87168f-3dba-4af0-8aaa-c1e1c8658719", // hooked up to ZEPTA 3 (AutoPrompt)
      webhook: webhookUrl,
      inputs: {
        input_image: data.input_image,
        input_masks: data.input_masks,
        input_prompt: data.input_prompt,
        input_trajectories: data.input_trajectories,
        input_rotations: data.input_rotations,
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

