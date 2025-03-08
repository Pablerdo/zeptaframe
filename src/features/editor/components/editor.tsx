"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";

import { 
  ActiveTool, 
  selectionDependentTools,
  SegmentedMask,
  VideoGeneration,
  Editor as EditorType
} from "@/features/editor/types";
import { Navbar } from "@/features/editor/components/navbar";
import { Footer } from "@/features/editor/components/footer";
import { Sidebar } from "@/features/editor/components/sidebar";
import { Toolbar } from "@/features/editor/components/toolbar";
import { ShapeSidebar } from "@/features/editor/components/shape-sidebar";
import { FillColorSidebar } from "@/features/editor/components/fill-color-sidebar";
import { StrokeColorSidebar } from "@/features/editor/components/stroke-color-sidebar";
import { StrokeWidthSidebar } from "@/features/editor/components/stroke-width-sidebar";
import { OpacitySidebar } from "@/features/editor/components/opacity-sidebar";
import { TextSidebar } from "@/features/editor/components/text-sidebar";
import { FontSidebar } from "@/features/editor/components/font-sidebar";
import { ImageSidebar } from "@/features/editor/components/image-sidebar";
import { FilterSidebar } from "@/features/editor/components/filter-sidebar";
import { DrawSidebar } from "@/features/editor/components/draw-sidebar";
import { TemplateSidebar } from "@/features/editor/components/template-sidebar";
import { SettingsSidebar } from "@/features/editor/components/settings-sidebar";
import { SegmentationSidebar } from "@/features/editor/components/segmentation-sidebar";
import { PromptSidebar } from "@/features/editor/components/prompt-sidebar";
import { cn } from "@/lib/utils";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { Button } from "@/components/ui/button";
import { dataUrlToFile, uploadToUploadThingResidual } from "@/lib/uploadthing";
import { Workspace } from "@/features/editor/components/workspace";

interface EditorProps {
  initialData: ResponseType["data"];
}

export const Editor = ({ initialData }: EditorProps) => {
  const { mutate } = useUpdateProject(initialData.id);
  const [videoGenerations, setVideoGenerations] = useState<VideoGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  
  // Use workspace IDs array instead of just a count
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  
  // Track active workspace index
  const [activeWorkspaceIndex, setActiveWorkspaceIndex] = useState(0);
  
  // Store the current active editor instance
  const [activeEditor, setActiveEditor] = useState<EditorType | undefined>(undefined);
  
  // Ref for the scrollable container
  const editorsContainerRef = useRef<HTMLDivElement>(null);
  
  // Save callback with debounce
  const debouncedSave = useCallback(
    debounce(
      (values: { 
        json: string,
        height: number,
        width: number,
      }) => {
        mutate(values);
      },
      500
    ), 
    [mutate]
  );
  
  const onClearSelection = useCallback(() => {
    if (selectionDependentTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [activeTool]);

  // Handle setting active editor when a workspace becomes active
  const handleSetActiveEditor = useCallback((editor: EditorType, index: number) => {
    setActiveEditor(editor);
    setActiveWorkspaceIndex(index);
    console.log(`Editor from workspace ${index + 1} is now active`);
  }, []);

  // Add a new workspace
  const handleAddWorkspace = useCallback(() => {
    // Generate a unique ID for the new workspace
    const newId = `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setWorkspaceIds(prev => [...prev, newId]);
    
    // Set the new workspace as active after it's created
    const newIndex = workspaceIds.length;
    setActiveWorkspaceIndex(newIndex);
  }, [workspaceIds.length]);

  // Create initial workspace on mount
  useEffect(() => {
    if (workspaceIds.length === 0) {
      const initialId = `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setWorkspaceIds([initialId]);
    }
  }, []);

  // Handle scrolling between workspaces
  useEffect(() => {
    const container = editorsContainerRef.current;
    if (!container) return;
    
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      // Clear previous timeout
      clearTimeout(scrollTimeout);
      
      // Set a new timeout - this will only execute when scrolling stops
      scrollTimeout = setTimeout(() => {
        if (!container) return;
        
        // Calculate which workspace is most visible based on scroll position
        const scrollLeft = container.scrollLeft;
        const workspaceWidth = container.clientWidth;
        
        const visibleIndex = Math.round(scrollLeft / workspaceWidth);
        if (visibleIndex !== activeWorkspaceIndex && visibleIndex < workspaceIds.length) {
          setActiveWorkspaceIndex(visibleIndex);
          console.log(`Workspace ${visibleIndex + 1} is now active after scroll`);
        }
      }, 150); // Short delay to ensure scrolling has stopped
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeWorkspaceIndex, workspaceIds.length]);

  // Scroll to active workspace when activeWorkspaceIndex changes
  useEffect(() => {
    const container = editorsContainerRef.current;
    if (!container) return;
    
    container.scrollTo({
      left: activeWorkspaceIndex * container.clientWidth,
      behavior: 'smooth'
    });
  }, [activeWorkspaceIndex]);

  const onChangeActiveTool = useCallback((tool: ActiveTool) => {
    if (tool === activeTool) {
      return setActiveTool("select");
    }
    setActiveTool(tool);
  }, [activeTool]);

  // Check the status of the video generations
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    console.log("setting up video status check intervals");

    // Only create intervals for pending generations that don't have one yet
    videoGenerations.forEach((gen, index) => {
      if (gen.status === 'pending') {
        console.log(`Setting up interval for video generation ${gen.runId}`);
        
        const intervalId = setInterval(async () => {
          console.log(`Checking status for video generation ${gen.runId}`);
          try {
            const response = await fetch(`/api/comfydeploy/webhook-video?runId=${gen.runId}`);
            const data = await response.json();
            
            if (data.status === "success") {
              console.log(`Video generation ${gen.runId} completed successfully`);
              setVideoGenerations(prev => prev.map((g, i) => 
                i === index ? {
                  ...g,
                  status: 'success',
                  videoUrl: data.videoUrl,
                  progress: 100
                } : g
              ));
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error(`Error checking status for video ${gen.runId}:`, error);
          }
        }, 5000);
        
        intervals.push(intervalId);
      }
    });

    // Cleanup function to clear all intervals when component unmounts or dependencies change
    return () => {
      console.log(`Cleaning up ${intervals.length} status check intervals`);
      intervals.forEach(id => clearInterval(id));
    };
  }, [videoGenerations.map(gen => gen.runId).join(',')]); // Only depend on the runIds

  const handleGenerateVideo = async () => {
    if (!activeEditor) return;
    
    try {
      setIsGenerating(true);
      
      const validMasks = activeEditor.segmentedMasks.filter(mask => mask.id && mask.id.trim() !== '');
      
      const trajectories = validMasks.map(mask => mask.trajectory?.points || []);
      const rotations = validMasks.map(mask => mask.rotation || 0);
      
      // Upload the workspace image to UploadThing
      let workspaceImageUrl = "";
      if (activeEditor.workspaceURL) {
        const workspaceFile = await dataUrlToFile(activeEditor.workspaceURL, "workspace.png");
        workspaceImageUrl = await uploadToUploadThingResidual(workspaceFile);
        console.log("Workspace image uploaded:", workspaceImageUrl);
      } else {
        throw new Error("No workspace image available");
      }
      
      // Upload all mask images to UploadThing
      const maskUploadPromises = validMasks.map(async (mask, index) => {
        if (!mask.binaryUrl) return "";
        
        const maskFile = await dataUrlToFile(mask.binaryUrl, `mask-${index}.png`);
        return uploadToUploadThingResidual(maskFile);
      });
      
      const uploadedMaskUrls = await Promise.all(maskUploadPromises);
      console.log("Masks uploaded:", uploadedMaskUrls);
      
      // Now construct the videoGenData with the uploaded URLs
      const videoGenData = {
        "input_image": JSON.stringify([workspaceImageUrl]),
        "input_masks": JSON.stringify(uploadedMaskUrls),
        "input_prompt": activeEditor.prompt,
        "input_trajectories": JSON.stringify(trajectories),
        "input_rotations": JSON.stringify(rotations)
      };
      
      console.log("videoGenData", videoGenData);

      const response = await fetch("/api/comfydeploy/generate-video", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(videoGenData),
      });
      
      const data = await response.json();
      console.log(data);
      
      if (data.runId) {
        // Add new video generation to array
        setVideoGenerations(prev => [...prev, {
          runId: data.runId,
          status: 'pending',
          progress: 0
        }]);
        
        // Start the progress animation for this generation
        const duration = 7 * 60 * 1000;
        const interval = 100;
        const steps = duration / interval;
        let currentStep = 0;
        
        const progressInterval = setInterval(() => {
          currentStep++;
          const progress = (currentStep / steps) * 100;
          
          setVideoGenerations(prev => prev.map(gen => 
            gen.runId === data.runId ? {
              ...gen,
              progress: Math.min(progress, 100)
            } : gen
          ));
          
          if (currentStep >= steps) {
            clearInterval(progressInterval);
          }
        }, interval);
        
        console.log("Video generation started. Please wait...");
      } else {
        throw new Error("No video runId received");
      }
    } catch (error) {
      console.error("Error:", error);
      console.log("Error generating video");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle deleting a workspace
  const handleDeleteWorkspace = useCallback((indexToDelete: number) => {
    // Don't allow deleting if it's the last workspace
    if (workspaceIds.length <= 1) return;
    
    // Create a new array without the deleted workspace
    setWorkspaceIds(prev => prev.filter((_, i) => i !== indexToDelete));
    
    // If deleting the active workspace, set the previous one as active
    // If deleting the first workspace, set the new first one as active
    if (indexToDelete === activeWorkspaceIndex) {
      const newActiveIndex = indexToDelete === 0 ? 0 : indexToDelete - 1;
      setActiveWorkspaceIndex(newActiveIndex);
    } 
    // If deleting a workspace before the active one, shift the active index
    else if (indexToDelete < activeWorkspaceIndex) {
      setActiveWorkspaceIndex(prev => prev - 1);
    }
  }, [workspaceIds.length, activeWorkspaceIndex]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-editor-bg dark:bg-editor-bg-dark">
      <Navbar
        id={initialData.id}
        editor={activeEditor}
        activeTool={activeTool}
        onChangeActiveTool={onChangeActiveTool}
      />
      <div className="absolute h-[calc(100%-68px)] w-full top-[68px] flex p-2">
        <Sidebar
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <SegmentationSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={setActiveTool}
        />
        <ShapeSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FillColorSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeColorSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeWidthSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <OpacitySidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TextSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FontSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <ImageSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TemplateSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FilterSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <DrawSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <PromptSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <SettingsSidebar
          editor={activeEditor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <main className="bg-editor-bg dark:bg-editor-bg-dark flex-1 overflow-hidden relative flex flex-col rounded-xl mx-2">
          <Toolbar
            editor={activeEditor}
            activeTool={activeTool}
            onChangeActiveTool={onChangeActiveTool}
          />
          <div className="flex flex-row h-full w-full mb-4 relative overflow-hidden">
            {/* Scrollable container for workspaces */}
            <div 
              ref={editorsContainerRef}
              className="flex-1 overflow-x-auto mt-2 mx-2 scroll-smooth" 
              style={{
                scrollSnapType: "x mandatory",
                display: "flex",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* Render workspaces based on workspace IDs array */}
              {workspaceIds.map((id, index) => (
                <Workspace
                  key={id}
                  index={index}
                  isActive={index === activeWorkspaceIndex}
                  onActive={handleSetActiveEditor}
                  onDelete={handleDeleteWorkspace}
                  canDelete={workspaceIds.length > 1}
                  defaultState={index === 0 ? initialData.json : undefined}
                  defaultWidth={index === 0 ? initialData.width : undefined}
                  defaultHeight={index === 0 ? initialData.height : undefined}
                  clearSelectionCallback={onClearSelection}
                  saveCallback={debouncedSave}
                  activeTool={activeTool}
                />
              ))}
            </div>
            
            {/* Add workspace button */}
            <div className="w-16 flex items-center justify-center">
              <button
                onClick={handleAddWorkspace}
                className={cn("bg-editor-sidebar rounded-xl p-2")}
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </button>
            </div>
          </div>
          
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
                onClick={handleGenerateVideo}
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
              <div className="flex items-center justify-between">
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
                  onGenerateVideo={handleGenerateVideo}
                  workspaceCount={workspaceIds.length}
                  activeWorkspaceIndex={activeWorkspaceIndex}
                />
              </div>
            </div>
          </div>
          
          <Footer editor={activeEditor} />
        </main>
      </div>
    </div>
  );
}
