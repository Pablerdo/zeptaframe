'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Download, Loader2 } from 'lucide-react';
import { VideoGeneration } from '@/features/editor/types';
import { cn } from '@/lib/utils';
import WorkbenchGenerations from './workbench-generations';

interface VideoTimelineProps {
  videoGenerations: VideoGeneration[];
  workbenchIds: string[];
  activeWorkbenchIndex: number;
}

const VideoTimeline = ({ 
  videoGenerations, 
  workbenchIds,
  activeWorkbenchIndex 
}: VideoTimelineProps) => {
  const [isExporting, setIsExporting] = useState(false);
  
  // Add custom scrollbar style in useEffect
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(100, 100, 100, 0.5);
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(120, 120, 120, 0.8);
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // This is wrong, we need to get the currently selected video from each workbench
  // 
  // // Get currently selected videos from each workbench
  // const selectedVideoUrls = useMemo(() => {
  //   return workbenchIds.map(workbenchId => {
  //     // Find the selected video for this workbench
  //     const workbenchVideoGenerations = videoGenerations
  //       .filter(gen => gen.workbenchId === workbenchId)
  //       .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
  //     // Return the URL of the most recent successful generation
  //     const successfulGeneration = workbenchVideoGenerations.find(gen => gen.status === 'success');
  //     return successfulGeneration?.videoUrl || null;
  //   }).filter(Boolean); // Filter out null/undefined values
  // }, [workbenchIds, videoGenerations]);

  // Handle export of video timeline
  // const handleExportTimeline = async () => {
  //   // Make sure we have at least one video to export
  //   if (selectedVideoUrls.length === 0) {
  //     alert('No videos available to export');
  //     return;
  //   }

  //   try {
  //     setIsExporting(true);
      
  //     // In a real implementation, you would call a backend API to combine the videos
  //     const response = await fetch('/api/video-export', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         videoUrls: selectedVideoUrls,
  //       }),
  //     });
      
  //     if (!response.ok) {
  //       throw new Error('Failed to export video timeline');
  //     }
      
  //     // Get the exported video URL
  //     const data = await response.json();
      
  //     // Create a download link for the combined video
  //     const downloadLink = document.createElement('a');
  //     downloadLink.href = data.exportedVideoUrl;
  //     downloadLink.download = `video-timeline-${new Date().toISOString().slice(0, 10)}.mp4`;
  //     document.body.appendChild(downloadLink);
  //     downloadLink.click();
  //     document.body.removeChild(downloadLink);
      
  //   } catch (error) {
  //     console.error('Error exporting video timeline:', error);
  //     alert('Failed to export video timeline. Please try again later.');
  //   } finally {
  //     setIsExporting(false);
  //   }
  // };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {workbenchIds.map((workbenchId, index) => (
            <div key={workbenchId} className="flex flex-col items-center">
              <div className="flex items-center">
                <WorkbenchGenerations
                  workbenchId={workbenchId}
                  videoGenerations={videoGenerations}
                  isActiveWorkbench={index === activeWorkbenchIndex}
                  workbenchIndex={index}
                />
                
                {index < workbenchIds.length - 1 && (
                  <div className="flex items-center mx-2">
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          ))}
                    {/* Export button container */}
          <div className="px-4 flex items-center">
            <div className="pointer-events-none">
              <svg width="96" height="48" viewBox="0 0 96 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Top funnel line with arrow */}
                <path d="M8 14L80 22L88 22" stroke="white" strokeWidth="1.5" strokeOpacity="0.7"/>
                <path d="M88 22L82 18" stroke="white" strokeWidth="1.5" strokeOpacity="0.7"/>
                
                {/* Bottom funnel line with arrow */}
                <path d="M8 34L80 26L88 26" stroke="white" strokeWidth="1.5" strokeOpacity="0.7"/>
                <path d="M88 26L82 30" stroke="white" strokeWidth="1.5" strokeOpacity="0.7"/>
              </svg>
            </div>
            <button 
              className={cn(
                "inline-flex items-center justify-center gap-2 text-white rounded-lg px-6 py-3 font-semibold transition-all duration-300 shadow-xl",
                "bg-blue-600",
                "hover:scale-103 hover:shadow-blue-500/20 hover:from-blue-800 hover:to-blue-950", 
                "active:scale-95 active:shadow-inner",
                "border border-blue-600/20",
                "backdrop-blur-sm",
                "w-fit",
                isExporting ? "opacity-80 cursor-not-allowed grayscale" : "animate-pulse-subtle"
              )}
              onClick={() => {
                console.log('Export Timeline');
              }}
              disabled={isExporting}
            >
              {isExporting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-200" />
                  <span className="text-blue-100 whitespace-nowrap">Exporting Timeline...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-200" />
                  <span className="text-blue-100 whitespace-nowrap">Download Current Timeline</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
