'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus } from 'lucide-react';
import { VideoBox } from './video-box';
import { VideoGeneration } from '@/features/editor/types';
import { cn } from '@/lib/utils';

interface VideoTimelineProps {
  onGenerateVideo: (index: number) => void;
  videoGenerations: VideoGeneration[];
  workbenchCount: number;
  activeWorkbenchIndex: number;
}

const VideoTimeline = ({ 
  onGenerateVideo, 
  videoGenerations, 
  workbenchCount,
  activeWorkbenchIndex 
}: VideoTimelineProps) => {
  const [videoBoxes, setVideoBoxes] = useState<(string | null)[]>([]);
  
  useEffect(() => {
    setVideoBoxes(Array(workbenchCount).fill(null));
  }, [workbenchCount]);
  
  useEffect(() => {
    if (videoGenerations.length > 0) {
      setVideoBoxes(prevBoxes => {
        const newVideoBoxes = [...prevBoxes];
        
        videoGenerations.forEach((gen) => {
          if (gen.status === 'success' && gen.videoUrl && gen.workbenchIndex !== undefined) {
            newVideoBoxes[gen.workbenchIndex] = gen.videoUrl;
          }
        });
        
        return newVideoBoxes;
      });
    }
  }, [videoGenerations, workbenchCount]);

  // Helper function to check if a workbench has a loading video
  const getVideoGeneration = (index: number) => {
    return videoGenerations.find(
      gen => gen.workbenchIndex === index && gen.status === 'pending'
    );
  };

  return (
    <div className="w-full overflow-x-auto px-6">
      <div className="flex items-center space-x-4">
        {videoBoxes.map((videoUrl, index) => {
          const pendingGen = getVideoGeneration(index);
          const isLoading = !!pendingGen;
          const progress = pendingGen?.progress || 0;
          
          return (
            <div key={index} className="flex flex-col items-center">
              <div className="flex items-center">
                <div className="relative">
                  <VideoBox
                    video={videoUrl}
                    onGenerateVideo={() => onGenerateVideo(index)}
                    isLoading={isLoading}
                    progress={progress}
                  />
                  <div 
                    className={cn(
                      "h-2 mt-2 w-full absolute -bottom-3 rounded-md transition-colors duration-300",
                      index === activeWorkbenchIndex ? "bg-blue-500" : "bg-transparent"
                    )}
                  />
                </div>
                
                {index < videoBoxes.length - 1 && (
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
