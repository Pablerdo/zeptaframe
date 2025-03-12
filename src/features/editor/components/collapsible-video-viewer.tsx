import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { VideoGeneration } from "@/features/editor/types";

interface CollapsibleVideoViewerProps {
  videoGenerations: VideoGeneration[];
  onGenerateVideo: (model?: string) => void;
  isGenerating: boolean;
  workbenchCount: number;
  activeWorkbenchIndex: number;
}

const CollapsibleVideoViewer = ({
  videoGenerations,
  onGenerateVideo,
  isGenerating,
  workbenchCount,
  activeWorkbenchIndex
}: CollapsibleVideoViewerProps) => {
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("CogVideoX");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleGenerateVideoForTimeline = (index: number) => {
    onGenerateVideo();
  };

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
      timelineCollapsed ? "h-[70px]" : "h-[650px]",
      "mx-2 mb-1 flex-shrink-0 self-end w-[calc(100%-1rem)]"
    )}>
      <div 
        className="flex items-center justify-between pt-4 px-4 pb-1 border-gray-700 cursor-pointer hover:bg-zinc-750 transition-colors duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setTimelineCollapsed(!timelineCollapsed);
          }
        }}
      > 
        <div className="flex items-center relative" ref={dropdownRef}>
          <Button 
            className="bg-blue-500 text-white hover:bg-blue-600 flex gap-2 rounded-l-xl rounded-r-none transition-all duration-200 shadow-md w-[160px] justify-start pl-3"
            onClick={() => onGenerateVideo(selectedModel)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending request...</span>
              </>
            ) : (
              <div className="flex flex-col items-start text-left">
                <span>Generate Video</span>
                <span className="text-xs text-blue-200/80 -mt-0.5">using {selectedModel}</span>
              </div>
            )}
          </Button>
          <Button
            className="bg-blue-500 text-white hover:bg-blue-600 px-2 rounded-l-none rounded-r-xl border-l border-blue-400 transition-all duration-200 shadow-md"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isGenerating}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isDropdownOpen && "rotate-180")} />
          </Button>
          
          <div
            className={`absolute z-50 mb-1 bg-white dark:bg-zinc-800 shadow-lg rounded-md overflow-hidden bottom-full right-0 border border-zinc-700/30 backdrop-blur-sm w-40 transition-all duration-150 transform ${
              isDropdownOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <div className="py-1">
              {["CogVideoX", "HunyuanVideo"].map((model) => (
                <div
                  key={model}
                  className={cn(
                    "px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors duration-150",
                    selectedModel === model ? "bg-blue-100 dark:bg-zinc-700 font-medium" : ""
                  )}
                  onClick={() => {
                    setSelectedModel(model);
                    setIsDropdownOpen(false);
                  }}
                >
                  {model}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div 
          className="flex items-center justify-between gap-2 bg-zinc-800/50 px-3 py-1 rounded-full hover:bg-zinc-700/50 transition-colors duration-200"
          onClick={() => setTimelineCollapsed(!timelineCollapsed)}
        >
          <span className="text-zinc-300 text-m font-medium tracking-wide">
            Timeline
          </span>
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
            onGenerateVideo={handleGenerateVideoForTimeline}
            workbenchCount={workbenchCount}
            activeWorkbenchIndex={activeWorkbenchIndex}
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleVideoViewer; 