import { type NextRequest, NextResponse } from "next/server"
import { ComfyDeploy } from "comfydeploy"

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
})

export async function POST(req: NextRequest) {
  const request = await req.json()
  console.log(request)
  const imageUrl = request.imageUrl
  const coordinates = request.coordinates

  // Log the received data for debugging
  console.log("Received image url:", imageUrl)
  console.log("Received coordinates:", coordinates)

  try {
    const result = await cd.run.deployment.queue({
      deploymentId: "d4102d2f-1544-4d9c-95db-c50bcd56fee9",
      webhook: `https://${process.env.WEBHOOK_URL}/api/webhook-segment`,
      inputs: {
        input_image: imageUrl,
        input_pos_coordinates: JSON.stringify(coordinates),
      },
    })

    if (result) {
      const runId = result.runId
      console.log("Run ID:", runId)

      return NextResponse.json({
        message: "Segmentation started",
        runId: runId,
      })
    } else {
      throw new Error("Failed to start image segmentation")
    }
  } catch (error) {
    console.error("Error starting image segmentation:", error)
    return NextResponse.json({ error: "Failed to segment image" }, { status: 500 })
  }
}

