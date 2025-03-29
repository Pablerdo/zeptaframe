import { NextResponse } from 'next/server';
// @ts-ignore
import { Runware, ITextToImage } from "@runware/sdk-js";

// Initialize Runware client
const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY as string });

export async function POST(request: Request) {
  try {
    const { positivePrompt, width = 512, height = 512, numberResults = 1, projectId } = await request.json();

    if (!positivePrompt) {
      return NextResponse.json(
        { error: 'Positive prompt is required' },
        { status: 400 }
      );
    }

    // Generate image
    const images = await runware.requestImages({
      positivePrompt,
      width,
      height,
      numberResults,
      model: "runware:100@1",
    });

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate images' },
        { status: 500 }
      );
    }

    // console.log("images", images);


    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}
