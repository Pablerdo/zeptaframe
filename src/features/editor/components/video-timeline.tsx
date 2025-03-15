'use client';

import { useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
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

  return (
    <div className="w-full overflow-x-auto custom-scrollbar px-6">
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
      </div>
    </div>
  );
};

export default VideoTimeline;
