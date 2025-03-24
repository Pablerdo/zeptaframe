// import { NextRequest, NextResponse } from 'next/server';
// import { db } from "@/db/drizzle";
// import { videoExports } from "@/db/schema";
// import { eq } from "drizzle-orm";

// export async function POST(req: NextRequest) {
//   try {
//     // Get webhook data from Creatomate
//     const webhookData = await req.json();
    
//     // Log the webhook data for debugging
//     console.log('Received Creatomate webhook:', JSON.stringify(webhookData, null, 2));
    
//     // Verify this is a valid webhook payload with required fields
//     if (!webhookData.id || !webhookData.status) {
//       return NextResponse.json(
//         { error: 'Invalid webhook payload' },
//         { status: 400 }
//       );
//     }

//     // Get export ID from metadata (important: this is how we identify our export record)
//     const exportId = webhookData.metadata;
    
//     if (!exportId) {
//       console.error('No export ID found in webhook metadata');
//       return NextResponse.json({ error: 'No export ID in metadata' }, { status: 400 });
//     }

//     console.log(`Processing webhook for export ID: ${exportId}, status: ${webhookData.status}`);

//     // Update based on render status
//     if (webhookData.status === 'succeeded') {
//       // Update the database record with the completed video URL
//       const videoUrl = webhookData.url;
      
//       await db.update(videoExports)
//         .set({
//           status: 'success', // Map 'succeeded' to 'success' in our system
//           videoUrl: videoUrl,
//           completedAt: new Date()
//         })
//         .where(eq(videoExports.id, exportId));
      
//       console.log(`Updated export ${exportId} to success with URL ${videoUrl}`);
      
//       // Return success response
//       return NextResponse.json({ success: true });
//     } 
//     else if (webhookData.status === 'failed') {
//       // Handle failed render
//       await db.update(videoExports)
//         .set({
//           status: 'error',
//           error: webhookData.error_message || 'Export failed',
//           completedAt: new Date()
//         })
//         .where(eq(videoExports.id, exportId));
      
//       console.log(`Updated export ${exportId} to error status`);
//       return NextResponse.json({ success: true });
//     }
    
//     // For other statuses (like 'planned' or 'rendering'), just acknowledge
//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Error processing Creatomate webhook:', error);
//     return NextResponse.json(
//       { error: 'Failed to process webhook' },
//       { status: 500 }
//     );
//   }
// } 