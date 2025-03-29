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
  ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/comfydeploy/webhook-image`
  : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}/api/comfydeploy/webhook-image`;

  try {
    const result = await cd.run.deployment.queue({
      deploymentId: data.workflowData.workflow_id,
      webhook: webhookUrl,
      inputs: {
        input_prompt: data.imageGenData.input_prompt,
        input_steps: data.imageGenData.input_steps,
      },
    })

    if (result) {
      const runId = result.runId
      // console.log("Run ID:", runId)

      return NextResponse.json({
        message: "Image generation started",
        runId: runId,
      })
    } else {
      throw new Error("Failed to start image generation")
    }
  } catch (error) {
    console.error("Error starting image generation:", error)
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 })
  }
}

