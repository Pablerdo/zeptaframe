import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { VideoGeneration } from "@/features/editor/types";

interface CollapsibleVideoViewerProps {
  videoGenerations: VideoGeneration[];
  onGenerateVideo: () => void;
  isGenerating: boolean;
  workspaceCount: number;
  activeWorkspaceIndex: number;
}

const CollapsibleVideoViewer = ({
  videoGenerations,
  onGenerateVideo,
  isGenerating,
  workspaceCount,
  activeWorkspaceIndex
}: CollapsibleVideoViewerProps) => {
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  return (
    <div className={cn(
      "modern-timeline rounded-xl flex flex-col transition-all duration-300",
      timelineCollapsed ? "h-[70px]" : "h-[650px]",
      "mx-2 mb-1 flex-shrink-0 self-end w-[calc(100%-1rem)]"
    )}>
      <div 
        className="flex items-center justify-between pt-4 px-4 pb-1 border-gray-700 cursor-pointer hover:bg-zinc-750"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setTimelineCollapsed(!timelineCollapsed);
          }
        }}
      > 
        <Button 
          className="bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2 rounded-xl"
          onClick={onGenerateVideo}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Video'
          )}
        </Button>
        <div 
          className="flex items-center justify-between"
          onClick={() => setTimelineCollapsed(!timelineCollapsed)}
        >
          <span className="text-zinc-300 text-m font-medium tracking-wide">
            Timeline
          </span>
          <ChevronDown 
            className={cn(
              "h-6 w-6 text-zinc-300 transition-all",
              timelineCollapsed && "rotate-180"
            )}
          />
        </div>
      </div>
      <div className={cn(
        "flex-1 overflow-x-auto border-zinc-700 transition-all",
        timelineCollapsed && "h-0"
      )}>
        <div className="min-w-[830px] h-full p-4">
          <VideoTimeline 
            videoGenerations={videoGenerations} 
            onGenerateVideo={onGenerateVideo}
            workspaceCount={workspaceCount}
            activeWorkspaceIndex={activeWorkspaceIndex}
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleVideoViewer; 