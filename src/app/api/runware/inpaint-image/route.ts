import { NextResponse } from 'next/server';
// @ts-ignore
import { Runware } from "@runware/sdk-js";

// Initialize Runware client
const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY as string });

export async function POST(request: Request) {
  try {
    const { 
      positivePrompt, 
      referenceImage, // base64 image
      width = 1248, 
      height = 832,
      projectId 
    } = await request.json();

    if (!positivePrompt) {
      return NextResponse.json(
        { error: 'Positive prompt is required' },
        { status: 400 }
      );
    }

    if (!referenceImage) {
      return NextResponse.json(
        { error: 'Reference image is required' },
        { status: 400 }
      );
    }

    // Request image inpainting
    const images = await runware.requestImages({
      positivePrompt,
      seedImage: referenceImage, // Use seedImage for the base64 reference
      width,
      height,
      model: "bfl:4@1",
      outputFormat: "JPG",
      includeCost: true,
      outputType: "URL",
      numberResults: 1
    });

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'Failed to inpaint image' },
        { status: 500 }
      );
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error inpainting image:', error);
    return NextResponse.json(
      { error: 'Failed to inpaint image' },
      { status: 500 }
    );
  }
}
