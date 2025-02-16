import { ComfyDeploy } from "comfydeploy";
import { NextResponse } from "next/server";

const cd = new ComfyDeploy();

// In-memory storage for image URLs (replace with a database in production)
const segmentedImageStore: { [key: string]: string } = {};
const resizedOriginalStore: { [key: string]: string } = {};
const cutoutStore: { [key: string]: string } = {};

function findMaskImageUrl(outputs: any): string | undefined {
  for (const output of outputs) {
    if (Array.isArray(output.data?.images)) {
      const maskImage = output.data.images.find((image: any) => image.filename.startsWith("mask"));
      if (maskImage) {
        return maskImage.url;
      }
    }
  }
  return undefined;
}

function findImageUrl(outputs: any): string | undefined {
  for (const output of outputs) {
    if (Array.isArray(output.data?.images)) {
      const originalImage = output.data.images.find((image: any) => image.filename.startsWith("original"));
      if (originalImage) {
        return originalImage.url;
      }
    }
  }
  return undefined;
}

function findCutoutUrl(outputs: any): string | undefined {
  for (const output of outputs) {
    if (Array.isArray(output.data?.images)) {
      const cutoutImage = output.data.images.find((image: any) => image.filename.startsWith("cutout"));
      if (cutoutImage) {
        return cutoutImage.url;
      }
    }
  }
  return undefined;
}


export async function POST(request: Request) {
  try {
    const data = await cd.validateWebhook({ request });

    const { status, runId, outputs } = data;

    console.log("Webhook received:", { status, runId, outputs });

    console.log(JSON.stringify(outputs, null, 2))
    
    if (status === 'success') {
      // Get the URL from the first output's url field
      const maskUrl = findMaskImageUrl(outputs)
      const imageUrl = findImageUrl(outputs)
      const cutoutUrl = findCutoutUrl(outputs)

      console.log("Image generated:", imageUrl);
      console.log("Mask generated:", maskUrl);
      console.log("Cutout generated:", cutoutUrl);
      // Store the image URL
      
      segmentedImageStore[runId] = maskUrl || "";
      resizedOriginalStore[runId] = imageUrl || "";
      cutoutStore[runId] = cutoutUrl || "";
    }

    // Return success to ComfyDeploy
    return NextResponse.json({ message: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

// API route to get the image URL
export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "'No runId provided'" }, { status: 400 });
  }

  console.log("Inside segmenter GET")
  console.log("segmentedImageStore[runId]: ", segmentedImageStore[runId])
  if (segmentedImageStore[runId]) {
    return NextResponse.json({ 
      status: "success", 
      segmentedImageUrl: segmentedImageStore[runId], 
      resizedOriginalUrl: resizedOriginalStore[runId],
      cutoutUrl: cutoutStore[runId]
    });
  } else {
    return NextResponse.json({ status: "pending" });
  }
}

//export { segmentedImageStore, resizedOriginalStore, cutoutStore };

