import { VideoGeneration } from '@/features/editor/types';
import { comfyDeployWorkflows } from '../utils/comfy-deploy-workflows';

/**
 * Exports a video timeline by combining multiple videos into a single video
 * @param videoGenerations Array of video generations to combine
 * @param projectId Project ID for tracking
 * @returns Promise with the export ID for tracking status
 */
export async function exportVideoTimeline(
  // videoGenerations: VideoGeneration[], 
  videoUrls: string[],
  projectId?: string
): Promise<string> {
  
  // Filter to only selected generations for each workbench 
  // const validVideos = videoGenerations
  //   .filter(gen => gen.status === 'success' && gen.videoUrl)
  //   .map(gen => gen.videoUrl as string);
  
  // if (validVideos.length === 0) {
  //   throw new Error('No valid videos to export');
  // }

  try {
    // Call our API route to create the combined video
    const response = await fetch('/api/comfydeploy/join-video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoGenData: {
          videoUrls: videoUrls,// validVideos,
          projectId
        },
        workflowData: {
          workflow_id: comfyDeployWorkflows["MP4VideoJoiner"]
        }
      }),
    });

    const data = await response.json();

    // if (!response.ok) {
    //   const errorData = await response.json();
    //   throw new Error(errorData.error || 'Failed to export video timeline');
    // }
    
    console.log('data', data);

    // Return the export ID for status tracking
    // return data.exportId;
    return data.runId;
  } catch (error) {
    console.error('Error exporting video timeline:', error);
    throw error;
  }
}

/**
 * Downloads a video file from a URL to user's downloads folder
 * @param url URL of the video to download
 * @param filename Name to save the file as
 */
export async function downloadVideo(url: string, filename: string = 'video-timeline.mp4'): Promise<void> {
  try {
    // Fetch the video file
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch video');
    }
    
    // Get the video data as a blob
    const blob = await response.blob();
    
    // Create a local URL for the blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Create a download link with the local blob URL
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = filename;
    
    // Trigger the download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up the blob URL after download starts
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (error) {
    console.error('Error downloading video:', error);
    alert('Failed to download video. Please try again later.');
  }
} 