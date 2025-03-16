import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/db/drizzle";
import { videoExports } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    // Get video URLs from the request body
    const { videoUrls, projectId } = await req.json();

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty video URLs array' }, 
        { status: 400 }
      );
    }

    // Create a record in our database to track this export
    const [exportRecord] = await db.insert(videoExports)
      .values({
        projectId: projectId || '00000000-0000-0000-0000-000000000000', // Default if not provided
        status: 'pending',
      })
      .returning();

    // Create elements array for Creatomate
    const elements = videoUrls.reverse().map((url, index) => ({
      type: "video",
      track: 1,
      source: url
    }));

    // Generate the webhook URL (absolute URL)
    const baseUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL_NGROK || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/creatomate/webhook`;

    console.log('Using webhook URL:', webhookUrl); // Add this for debugging

    // Make request to Creatomate API
    const response = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: {
          output_format: "mp4",
          width: 720,
          height: 480,
          elements: elements
        },
        webhook_url: webhookUrl,
        metadata: exportRecord.id // This is crucial - it's how we identify our export in the webhook
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creatomate API error:', errorText);
      
      // Update our record with the error
      await db.update(videoExports)
        .set({
          status: 'error',
          error: errorText,
          completedAt: new Date()
        })
        .where(eq(videoExports.id, exportRecord.id));
        
      return NextResponse.json(
        { error: 'Failed to create video with Creatomate' }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Update our record with the job ID
    await db.update(videoExports)
      .set({
        jobId: data.id || data[0]?.id,
      })
      .where(eq(videoExports.id, exportRecord.id));
    
    return NextResponse.json({
      success: true,
      exportId: exportRecord.id,
      jobId: data.id || data[0]?.id,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error in video export:', error);
    return NextResponse.json(
      { error: 'Failed to process video export request' }, 
      { status: 500 }
    );
  }
}

// curl -s -X POST https://api.creatomate.com/v1/renders \
//   -H 'Authorization: Bearer YOUR_API_KEY' \
//   -H 'Content-Type: application/json' \
//   --data-binary @- << EOF
// {
//   "source": {
//     "output_format": "mp4",
//     "width": 1920,
//     "height": 1080,
//     "elements": [
//       {
//         "type": "video",
//         "track": 1,
//         "source": "https://cdn.creatomate.com/demo/drone.mp4"
//       },
//       {
//         "type": "video",
//         "track": 1,
//         "source": "https://cdn.creatomate.com/demo/river.mp4",
//         "animations": [
//           {
//             "time": "start",
//             "duration": 1,
//             "transition": true,
//             "type": "fade"
//           }
//         ]
//       }
//     ]
//   }
// }