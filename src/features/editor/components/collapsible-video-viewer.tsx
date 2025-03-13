import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { VideoGeneration } from "@/features/editor/types";

interface CollapsibleVideoViewerProps {
  videoGenerations: VideoGeneration[];
  isGenerating: boolean;
  workbenchCount: number;
  activeWorkbenchIndex: number;
}

const CollapsibleVideoViewer = ({
  videoGenerations,
  isGenerating,
  workbenchCount,
  activeWorkbenchIndex
}: CollapsibleVideoViewerProps) => {
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("CogVideoX");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn(
      "modern-timeline rounded-xl flex flex-col transition-all duration-300 shadow-lg",
      timelineCollapsed ? "h-[40px]" : "h-[580px]",
      "mx-2 mb-2 flex-shrink-0 self-end w-[calc(100%-1rem)]"
    )}>
      <div 
        className="flex items-center justify-between pt-2 px-4 pb-1 border-gray-700 cursor-pointer hover:bg-zinc-750 transition-colors duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setTimelineCollapsed(!timelineCollapsed);
          }
        }}
      > 
        <span className="font-bold">Timeline</span>
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
      <div className={cn(
        "flex-1 overflow-x-auto border-zinc-700 transition-all",
        timelineCollapsed && "h-0"
      )}>
        <div className="min-w-[830px] h-full p-4">
          <VideoTimeline 
            videoGenerations={videoGenerations} 
            workbenchCount={workbenchCount}
            activeWorkbenchIndex={activeWorkbenchIndex}
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleVideoViewer; 