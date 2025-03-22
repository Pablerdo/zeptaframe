import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { VideoExport, VideoGeneration } from "@/features/editor/types";

interface CollapsibleVideoViewerProps {
  timelineCollapsed: boolean;
  workbenchIds: string[];
  videoGenerations: VideoGeneration[];
  isGenerating: boolean;
  workbenchCount: number;
  activeWorkbenchIndex: number;
  projectId: string;
  videoExports: VideoExport[];
}

const CollapsibleVideoViewer = ({
  timelineCollapsed,
  workbenchIds,
  videoGenerations,
  isGenerating,
  workbenchCount,
  activeWorkbenchIndex,
  projectId,
  videoExports
}: CollapsibleVideoViewerProps) => {
  return (
    <div className={cn(
      "modern-timeline rounded-tr-lg rounded-bl-lg rounded-br-lg flex-col transition-all duration-0 shadow-lg",
      timelineCollapsed ? "h-[0px]" : "h-[430px]",
      "mx-2 mb-2 flex-shrink-0 self-end w-[calc(100%-1rem)]"
    )}>

      <div className={cn(
        "flex-1 overflow-x-auto border-zinc-700 transition-all",
        timelineCollapsed && "h-0"
      )}>
        <div className="min-w-[830px] h-full p-1">
          <VideoTimeline 
            videoGenerations={videoGenerations}
            workbenchIds={workbenchIds}
            activeWorkbenchIndex={activeWorkbenchIndex}
            projectId={projectId}
            videoExports={videoExports}
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleVideoViewer; 