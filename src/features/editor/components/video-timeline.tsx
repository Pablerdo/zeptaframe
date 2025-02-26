'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Plus } from 'lucide-react';
import { VideoBox } from './video-box';
import { VideoGeneration } from '@/features/editor/types';

interface VideoTimelineProps {
  onGenerateVideo: (index: number) => void;
  videoGenerations: VideoGeneration[];
}

const VideoTimeline = ({ onGenerateVideo, videoGenerations }: VideoTimelineProps) => {
  const [videoBoxes] = useState(Array(5).fill(null));

  return (
    <div className="w-full overflow-x-auto p-6">
      <div className="flex items-center space-x-4">
        {videoBoxes.map((video, index) => (
          <div key={index} className="flex items-center">
            <VideoBox
              video={video}
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
