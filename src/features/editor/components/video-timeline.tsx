'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Download, Loader2 } from 'lucide-react';
import { VideoExport, VideoGeneration } from '@/features/editor/types';
import { cn } from '@/lib/utils';
import WorkbenchGenerations from './workbench-generations';
import { exportVideoTimeline } from '@/features/editor/services/video-timeline-service';
import VideoExportsList from './video-exports-list';
import { toast } from 'sonner';

interface VideoTimelineProps {
  videoGenerations: VideoGeneration[];
  workbenchIds: string[];
  activeWorkbenchIndex: number;
  projectId: string;
  videoExports: VideoExport[];
}

const VideoTimeline = ({ 
  videoGenerations, 
  workbenchIds,
  activeWorkbenchIndex,
  projectId,
  videoExports
}: VideoTimelineProps) => {
  // Use the export context instead of local state
  
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

  const [isExporting, setIsExporting] = useState(false);

  const [selectedVideoUrls, setSelectedVideoUrls] = useState<Record<string, string>>({});

  // Initialize selectedVideoUrls with the first successful generation for each workbench
  useEffect(() => {
    const initialSelectedUrls: Record<string, string> = {};
    
    workbenchIds.forEach(workbenchId => {
      const workbenchVideoGenerations = videoGenerations
        .filter(gen => gen.workbenchId === workbenchId && gen.status === 'success')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (workbenchVideoGenerations.length > 0 && workbenchVideoGenerations[0].videoUrl) {
        initialSelectedUrls[workbenchId] = workbenchVideoGenerations[0].videoUrl;
      }
    });
    
    // Only update if we found videos and the current state is empty
    if (Object.keys(initialSelectedUrls).length > 0 && Object.keys(selectedVideoUrls).length === 0) {
      setSelectedVideoUrls(initialSelectedUrls);
    }
  }, [videoGenerations, workbenchIds, selectedVideoUrls]);

  // Handle export of video timeline
  const handleExportTimeline = async () => {
    // Get the selected videos from our state
    setIsExporting(true);

    const selectedVideos = Object.values(selectedVideoUrls).filter(Boolean);

    console.log('selectedVideos', selectedVideos);
    
    if (selectedVideos.length === 0) {
      alert('No videos selected to export');
      return;
    }

    try {
      // Get the selected generations based on the selected URLs
      const selectedGenerations = videoGenerations.filter(gen => 
        selectedVideos.includes(gen.videoUrl as string) && gen.status === 'success'
      );
      
      // Use our service to export the video timeline
      const newExportId = await exportVideoTimeline(selectedVideos, projectId);
      
      console.log('newExportId', newExportId);
      // Update the export context
      setIsExporting(false);
      
    } catch (error) {
      console.error('Error exporting video timeline:', error);
      alert('Failed to export video timeline. Please try again later.');
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar px-6 pt-2">
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
                  setSelectedVideoUrls={setSelectedVideoUrls}
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
          <div className="px-4 flex flex-col items-start">
            <div className="flex items-center">
              <div className="pointer-events-none pr-2">
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
              <button 
                className={cn(
                  "inline-flex items-center justify-center gap-2 text-white rounded-lg px-6 py-3 font-semibold transition-all duration-300 shadow-xl",
                  "bg-blue-700",
                  "hover:scale-103 hover:shadow-blue-500/20 hover:from-blue-800 hover:to-blue-950", 
                  "active:scale-95 active:shadow-inner",
                  "border border-blue-600/20",
                  "backdrop-blur-sm",
                  "w-fit",
                  isExporting ? "opacity-80 cursor-not-allowed grayscale" : "animate-pulse-subtle"
                )}
                onClick={() => 
                  handleExportTimeline()
                  //toast.info("Timeline export coming soon!")
                }
                disabled={isExporting}
              >
                {isExporting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-200" />
                    <span className="text-blue-100 whitespace-nowrap">
                      Exporting Timeline...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-200" />
                    <span className="text-blue-100 whitespace-nowrap">Export Current Timeline</span>
                  </div>
                )}
              </button>
            </div>
            
            {/* Video exports list */}
            <div className="w-full pl-7 mt-1">
              <VideoExportsList videoExports={videoExports} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
