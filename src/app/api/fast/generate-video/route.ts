import { NextRequest, NextResponse } from "next/server";
import { ComfyDeploy } from "comfydeploy";
import { db } from "@/db/drizzle";
import { videoGenerations } from "@/db/schema";

const cd = new ComfyDeploy({
  bearer: process.env.COMFY_DEPLOY_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Log the received data for debugging
    console.log("Fast generate-video received data:", data);

    // Validate required data structure
    if (!data.workflowData?.workflow_id || !data.videoGenData?.input_video) {
      return NextResponse.json({ 
        error: "Missing required workflowData.workflow_id or videoGenData.input_video" 
      }, { status: 400 });
    }

    // Webhook URL for fast subdomain
    const webhookUrl = process.env.DEPLOYMENT_MODE === 'production' 
      ? `${process.env.NEXT_PUBLIC_WEBHOOK_URL_PROD}/api/fast/webhook-video`
      : `${process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK}/api/fast/webhook-video`;

    let result;

    // Handle V2V tasks mode for fast subdomain
    if (data.workflowData.mode === "ffe" || !data.workflowData.mode) {
      if (data.videoGenData.input_image) {
        result = await cd.run.deployment.queue({
          deploymentId: data.workflowData.workflow_id,
          webhook: webhookUrl,
          inputs: {
            input_num_frames: data.videoGenData.input_num_frames,
            input_video: data.videoGenData.input_video,
            input_image: data.videoGenData.input_image,
            input_degradation: data.videoGenData.input_degradation,
            input_prompt: data.videoGenData.input_prompt || "High quality video",
            input_nth_frame: data.videoGenData.input_nth_frame,
            input_fps: data.videoGenData.input_fps,
          },
        });
      } else {
        result = await cd.run.deployment.queue({
          deploymentId: data.workflowData.workflow_id,
          webhook: webhookUrl,
          inputs: {
            input_num_frames: data.videoGenData.input_num_frames,
            input_video: data.videoGenData.input_video,
            input_degradation: data.videoGenData.input_degradation,
            input_prompt: data.videoGenData.input_prompt || "High quality video",
            input_nth_frame: data.videoGenData.input_nth_frame,
            input_fps: data.videoGenData.input_fps,
          },
        });
      }
    } else {
      // For future extensibility, could add other modes here
      throw new Error(`Unsupported workflow mode: ${data.workflowData.mode}`);
    }

    if (!result?.runId) {
      throw new Error("Failed to get runId from ComfyDeploy");
    }

    console.log("Fast video generation started with runId:", result.runId);

    // Store in database for tracking (no authentication required)
    await db.insert(videoGenerations).values({
      projectId: "fast-project", // Special project ID
      userId: "fast-user", // Special user ID
      workbenchId: "fast-workbench",
      runId: result.runId,
      status: "pending",
      modelId: data.videoGenData.modelId || "cogvideox",
      computeMode: data.videoGenData.computeMode || "normal",
      startTime: new Date(),
    });

    return NextResponse.json({
      message: "Video generation started",
      runId: result.runId,
    });

  } catch (error) {
    console.error("Error starting fast video generation:", error);
    return NextResponse.json({ 
      error: "Failed to generate video" 
    }, { status: 500 });
  }
} 