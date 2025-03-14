'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus } from 'lucide-react';
import { VideoBox } from './video-box';
import { VideoGeneration } from '@/features/editor/types';
import { cn } from '@/lib/utils';

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
  // Use useMemo to create a map of the latest video generation for each workbenchId
  const latestVideoGenerationsByWorkbench = useMemo(() => {
    // Create a Map to hold the latest video generation for each workbenchId
    const videoMap = new Map<string, VideoGeneration>();
    
    // Group video generations by workbenchId and keep only the most recent one
    videoGenerations.forEach(videoGen => {
      if (!videoGen.workbenchId) return;
      
      const existingGen = videoMap.get(videoGen.workbenchId);
      
      // If we don't have this workbenchId yet, or this generation is newer, update the map
      if (!existingGen || new Date(videoGen.createdAt) > new Date(existingGen.createdAt)) {
        videoMap.set(videoGen.workbenchId, videoGen);
      }
    });
    
    return videoMap;
  }, [videoGenerations]);

  return (
    <div className="w-full overflow-x-auto px-6">
      <div className="flex items-center space-x-4">
        {workbenchIds.map((workbenchId, index) => {
          // Find the video generation for this workbench ID
          const videoGen = latestVideoGenerationsByWorkbench.get(workbenchId);
          const isLoading = videoGen?.status === 'pending';
          const videoUrl = videoGen?.videoUrl || null;
          const modelName = videoGen?.modelId || "cogvideox";
          
          return (
            <div key={workbenchId} className="flex flex-col items-center">
              <div className="flex items-center">
                <div className="relative">
                  <VideoBox
                    video={videoUrl}
                    isLoading={isLoading}
                    model={modelName}
                  />
                  <div 
                    className={cn(
                      "h-2 mt-2 w-full absolute -bottom-3 rounded-md transition-colors duration-300",
                      index === activeWorkbenchIndex ? "bg-blue-500" : "bg-transparent"
                    )}
                  />
                </div>
                
                {index < workbenchIds.length - 1 && (
                  <div className="flex items-center mx-2">
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className="mt-5 text-xs font-medium text-gray-500">
                Workbench {index + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoTimeline;
