import { NextResponse } from 'next/server';
import { replicate } from '@/lib/replicate';

export async function POST(request: Request) {
  try {
    const { prompt, inputImageUrl, aspectRatio, projectId } = await request.json();

    if (!prompt || !inputImageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Prepare input for Replicate
    const input = {
      prompt: prompt,
      input_image: inputImageUrl,
      aspect_ratio: "match_input_image"
    };

    // Run the model
    const output = await replicate.run(
      "black-forest-labs/flux-kontext-max",
      { input }
    );

    // Extract the URL from the output
    let outputUrl: string;
    if (typeof output === 'string') {
      outputUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      outputUrl = output[0];
    } else if (output && typeof output === 'object' && 'url' in output) {
      outputUrl = (output as any).url;
    } else {
      console.error('Unexpected output format:', output);
      return NextResponse.json(
        { error: 'Unexpected output format from model' },
        { status: 500 }
      );
    }

    return NextResponse.json({ outputUrl });
  } catch (error) {
    console.error('Error in Replicate inpaint-image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    );
  }
}

// const input = {
//   prompt: "Using this style, a panda astronaut riding a unicorn",
//   input_image: "https://replicate.delivery/pbxt/N5iD2uXxc8OibakbkRbDyqv329ftYq9qpgCIXViKR25tnvTp/van-gogh.jpeg",
//   aspect_ratio: "match_input_image"
// };

// const output = await replicate.run("black-forest-labs/flux-kontext-max", { input });

// // To access the file URL:
// console.log(output.url()); //=> "http://example.com"
