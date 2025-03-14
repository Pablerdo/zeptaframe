import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { VideoGeneration } from "@/features/editor/types";

interface CollapsibleVideoViewerProps {
  workbenchIds: string[];
  videoGenerations: VideoGeneration[];
  isGenerating: boolean;
  workbenchCount: number;
  activeWorkbenchIndex: number;
}

const CollapsibleVideoViewer = ({
  workbenchIds,
  videoGenerations,
  isGenerating,
  workbenchCount,
  activeWorkbenchIndex
}: CollapsibleVideoViewerProps) => {
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  return (
    <div className={cn(
      "modern-timeline rounded-xl flex flex-col transition-all duration-200 shadow-lg",
      timelineCollapsed ? "h-[35px]" : "h-[580px]",
      "mx-2 mb-2 flex-shrink-0 self-end w-[calc(100%-1rem)]"
    )}>
      <div 
        className="flex items-center justify-between px-4 pt-1 pb-1 border-gray-700 cursor-pointer hover:bg-zinc-750 transition-colors duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setTimelineCollapsed(!timelineCollapsed);
          }
        }}
      > 
        <span className="font-bold">Timeline</span>
        <div className="flex items-center">
          {/* Dot indicators for workbenches */}
          <div className="flex items-center gap-2 flex-grow justify-center px-4">
            <div className="flex items-center gap-1">
              {workbenchIds.map((id, index) => (
                <div
                  key={id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors duration-200",
                    index === activeWorkbenchIndex 
                      ? "bg-blue-500" 
                      : "bg-zinc-500/50 hover:bg-zinc-400"
                  )}
                />
              ))}
            </div>
          </div>

          <div 
            className="flex items-center justify-between gap-2 px-3 py-1 rounded-full hover:bg-zinc-700/50 transition-colors duration-200"
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
          >
            <ChevronDown 
              className={cn(
                "h-5 w-5 text-zinc-300 transition-transform duration-200",
                timelineCollapsed && "rotate-180"
              )}
            />
          </div>
        </div> 
      </div>
      <div className={cn(
        "flex-1 overflow-x-auto border-zinc-700 transition-all",
        timelineCollapsed && "h-0"
      )}>
        <div className="min-w-[830px] h-full p-4">
          <VideoTimeline 
            videoGenerations={videoGenerations}
            workbenchIds={workbenchIds}
            activeWorkbenchIndex={activeWorkbenchIndex}
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleVideoViewer; 