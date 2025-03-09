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
  workspaceCount: number;
  activeWorkspaceIndex: number;
}

const VideoTimeline = ({ 
  onGenerateVideo, 
  videoGenerations, 
  workspaceCount,
  activeWorkspaceIndex 
}: VideoTimelineProps) => {
  const [videoBoxes, setVideoBoxes] = useState<(string | null)[]>([]);
  
  useEffect(() => {
    setVideoBoxes(Array(workspaceCount).fill(null));
  }, [workspaceCount]);
  
  useEffect(() => {
    if (videoGenerations.length > 0) {
      setVideoBoxes(prevBoxes => {
        const newVideoBoxes = [...prevBoxes];
        
        videoGenerations.forEach((gen, idx) => {
          if (gen.status === 'success' && gen.videoUrl && idx < workspaceCount) {
            newVideoBoxes[idx] = gen.videoUrl;
          }
        });
        
        return newVideoBoxes;
      });
    }
  }, [videoGenerations, workspaceCount]);

  return (
    <div className="w-full overflow-x-auto px-6">
      <div className="flex items-center space-x-4">
        {videoBoxes.map((videoUrl, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className="flex items-center">
              <div className="relative">
                <VideoBox
                  video={videoUrl}
                  onGenerateVideo={() => onGenerateVideo(index)}
                />
                <div 
                  className={cn(
                    "h-2 mt-2 w-full absolute -bottom-3 rounded-md transition-colors duration-300",
                    index === activeWorkspaceIndex ? "bg-blue-500" : "bg-transparent"
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
              Workspace {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoTimeline;
