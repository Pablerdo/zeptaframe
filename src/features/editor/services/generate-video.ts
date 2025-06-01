import { SupportedVideoModelId, ComputeMode } from "@/features/editor/types";

interface GenerateVideoParams {
  projectId: string;
  workbenchId: string;
  modelId: SupportedVideoModelId;
  computeMode: ComputeMode;
  comfyDeployData: any; // TODO: Type this properly based on your ComfyDeploy data structure
}

/**
 * Initiates a video generation process using ComfyDeploy and stores the generation information
 * @param params Parameters for video generation
 * @returns The runId from ComfyDeploy
 * @throws Error if video generation fails or database storage fails
 */
export async function comfyDeployGenerateVideo({
  projectId,
  workbenchId,
  modelId,
  comfyDeployData,
}: GenerateVideoParams): Promise<string> {

  // STEP 1: Call ComfyDeploy to start the generation
  const response = await fetch("/api/comfydeploy/generate-video", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(comfyDeployData),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to start video generation');
  }
  
  if (data.runId) {
    // STEP 2: Store the generation information in our database
    const dbResponse = await fetch("/api/video-generations", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        workbenchId,
        runId: data.runId,
        status: "pending",
        modelId,
        computeMode: "normal",
      }),
    });
    
    if (!dbResponse.ok) {
      const dbData = await dbResponse.json();
      throw new Error(dbData.error || 'Failed to store video generation data');
    }

    return data.runId;
  } else {
    throw new Error("No video runId received");
  }
} 