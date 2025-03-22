import { useState, useMemo, useEffect } from "react";
import { VideoBox } from './video-box';
import { SupportedVideoModelId, VideoGeneration } from "../types";
import { cn } from "@/lib/utils";
import { Calendar, Check, ChevronDown, Loader2, X } from "lucide-react";
import { videoModels } from "../utils/videoModels";

interface WorkbenchGenerationsProps {
  workbenchId: string;
  videoGenerations: VideoGeneration[];
  isActiveWorkbench: boolean;
  workbenchIndex: number;
  setSelectedVideoUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const WorkbenchGenerations = ({
  workbenchId,
  videoGenerations,
  isActiveWorkbench,
  workbenchIndex,
  setSelectedVideoUrls
}: WorkbenchGenerationsProps) => {
  // Filter generations for this workbench only
  const workbenchVideoGenerations = useMemo(() => 
    videoGenerations
      .filter(gen => gen.workbenchId === workbenchId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workbenchId, videoGenerations]
  );

  // Find the latest video generation
  const latestGeneration = useMemo(() => 
    workbenchVideoGenerations.length > 0 ? workbenchVideoGenerations[0] : null,
    [workbenchVideoGenerations]
  );

  // State to track which video generation is currently displayed
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(
    latestGeneration?.id || null
  );

  // Update selected generation when latest changes (e.g. when a pending generation completes)
  useMemo(() => {
    if (latestGeneration && (!selectedGeneration || !workbenchVideoGenerations.find(gen => gen.id === selectedGeneration))) {
      setSelectedGeneration(latestGeneration.id);
    }
  }, [latestGeneration, selectedGeneration, workbenchVideoGenerations]);

  // Get the currently selected video generation
  const displayedGeneration = useMemo(() => 
    workbenchVideoGenerations.find(gen => gen.id === selectedGeneration) || latestGeneration,
    [workbenchVideoGenerations, selectedGeneration, latestGeneration]
  );

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Update the parent's selectedVideoUrls when selectedGeneration or its status changes
  useEffect(() => {
    if (selectedGeneration) {
      const currentGeneration = workbenchVideoGenerations.find(gen => gen.id === selectedGeneration);
      
      if (currentGeneration?.status === 'success' && currentGeneration?.videoUrl) {
        setSelectedVideoUrls(prev => ({
          ...prev,
          [workbenchId]: currentGeneration.videoUrl as string
        }));
      }
    }
  }, [selectedGeneration, workbenchVideoGenerations, workbenchId, setSelectedVideoUrls]);

  // If no generations, show empty state
  if (workbenchVideoGenerations.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center px-2 py-1 rounded-md transition-all h-[400px] mb-2 bg-gray-200 dark:bg-[hsl(222,47%,20%)]",
        isActiveWorkbench ? "border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "border border-transparent hover:border-gray-700"
      )}>
      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">Workbench {workbenchIndex + 1}</span>
        <VideoBox 
          videoStatus={null}
          videoUrl={null}
          isLoading={false}
          model="cogvideox"
        />
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center px-2 py-1 rounded-md transition-all h-[400px] mb-2 bg-gray-200 dark:bg-[hsl(222,47%,20%)] ",
      isActiveWorkbench ? "border-2 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" : "border border-transparent hover:border-gray-700"
    )}>
      {/* Fixed header - always visible */}
      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">Workbench {workbenchIndex + 1}</span>
      
      {/* Single scrollable container for all content */}
      <div className="w-full h-[calc(100%-30px)] overflow-y-auto custom-scrollbar">
        {/* VideoBox (scrolls with history) */}
        <VideoBox 
          videoStatus={displayedGeneration?.status || null}
          videoUrl={displayedGeneration?.status === 'success' ? displayedGeneration?.videoUrl || null : null}
          isLoading={displayedGeneration?.status === 'pending'}
          model={displayedGeneration?.modelId || "cogvideox"}
        />
        
        {/* Generation history (same scrollable context as VideoBox) */}
        <div className="w-full mt-2 bg-black/20 rounded-md p-1">
          <div className="text-xs font-medium text-gray-400 mb-1 flex items-center px-1 py-1 bg-black/40 sticky top-0 z-10">
            <Calendar className="w-3 h-3 mr-1" />
            <span>Generation History</span>
          </div>
          
          <div className="space-y-1">
            {workbenchVideoGenerations.map((gen) => (
              <div 
                key={gen.id}
                onClick={() => setSelectedGeneration(gen.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs",
                  gen.id === selectedGeneration 
                    ? "bg-blue-600/40 border border-blue-500/60" 
                    : "hover:bg-gray-700/40"
                )}
              >
                <div className="flex items-center">
                  {gen.status === 'success' && (
                    <Check className="w-3 h-3 mr-1 text-blue-400" />
                  )}
                  {gen.status === 'pending' && (
                    <Loader2 className="w-3 h-3 mr-1 text-blue-400 animate-spin" />
                  )}
                  {gen.status === 'error' && (
                    <X className="w-3 h-3 mr-1 text-red-400" />
                  )}
                  <span className={cn(
                    "font-medium",
                    gen.id === selectedGeneration ? "text-blue-200" : "text-gray-300"
                  )}>
                    {gen.status === 'pending' ? 'Processing...' : videoModels[gen.modelId as SupportedVideoModelId].name}
                  </span>
                </div>
                <div className="text-gray-400">
                  {formatTimestamp(gen.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkbenchGenerations;