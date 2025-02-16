import { NextRequest, NextResponse } from "next/server"
import { ComfyDeploy } from "comfydeploy"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
 
  // Log the received data for debugging
  console.log("Received form data:", Object.fromEntries(formData))

  try {
    const result = await cd.run.deployment.queue({
      deploymentId: "f3ca5715-b3d1-440c-a348-511a90f17779",
      webhook: `https://${process.env.WEBHOOK_URL}/api/webhook-video`,
      inputs: {
        input_image: formData.get("input_image") as string,
        input_mask: formData.get("input_mask") as string,
        input_prompt: formData.get("input_prompt") as string,
        input_path: formData.get("input_path") as string,
        input_coords: formData.get("input_coords") as string,
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

