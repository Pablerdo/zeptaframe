'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus } from 'lucide-react';
import { VideoBox } from './video-box';
import { VideoGeneration } from '@/features/editor/types';

interface VideoTimelineProps {
  onGenerateVideo: (index: number) => void;
  videoGenerations: VideoGeneration[];
}

const VideoTimeline = ({ onGenerateVideo, videoGenerations }: VideoTimelineProps) => {
  const [videoBoxes, setVideoBoxes] = useState<(string | null)[]>(Array(5).fill(null));
  
  // Update videoBoxes when videoGenerations changes
  useEffect(() => {
    if (videoGenerations.length > 0) {
      // Create a new array with successful videos first
      const newVideoBoxes = [...videoBoxes];
      
      // Update video boxes with successful video URLs
      videoGenerations.forEach((gen, idx) => {
        if (gen.status === 'success' && gen.videoUrl) {
          // Place each successful video in the array, starting from the first position
          newVideoBoxes[idx] = gen.videoUrl;
        }
      });
      
      setVideoBoxes(newVideoBoxes);
    }
  }, [videoGenerations]);

  return (
    <div className="w-full overflow-x-auto p-6">
      <div className="flex items-center space-x-4">
        {videoBoxes.map((videoUrl, index) => (
          <div key={index} className="flex items-center">
            <VideoBox
              video={videoUrl}
              onGenerateVideo={() => onGenerateVideo(index)}
            />
            
            {index < videoBoxes.length - 1 && (
              <div className="flex items-center mx-2">
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            )}
            
            {index === videoBoxes.length - 1 && (
              <div className="flex items-center ml-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="border-dashed border-2"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoTimeline;
