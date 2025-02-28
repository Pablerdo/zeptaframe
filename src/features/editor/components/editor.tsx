"use client";

import { fabric } from "fabric";
import debounce from "lodash.debounce";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";

import { 
  ActiveTool, 
  selectionDependentTools
} from "@/features/editor/types";
import { Navbar } from "@/features/editor/components/navbar";
import { Footer } from "@/features/editor/components/footer";
import { useEditor } from "@/features/editor/hooks/use-editor";
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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import VideoTimeline from "@/features/editor/components/video-timeline";
import { Button } from "@/components/ui/button";
import { SegmentedMask } from "@/features/editor/types";
import { dataUrlToFile, uploadToUploadThing, uploadToUploadThingResidual } from "@/lib/uploadthing";
import { VideoGeneration } from "@/features/editor/types";

interface EditorProps {
  initialData: ResponseType["data"];
};


export const Editor = ({ initialData }: EditorProps) => {
  const { mutate } = useUpdateProject(initialData.id);
  const [videoGenerations, setVideoGenerations] = useState<VideoGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // State for video generation
  const [prompt, setPrompt] = useState("");
  const [workspaceURL, setWorkspaceURL] = useState<string | null>(null);
  const [segmentedMasks, setSegmentedMasks] = useState<SegmentedMask[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  ), [mutate]);

  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");

  const onClearSelection = useCallback(() => {
    if (selectionDependentTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [activeTool]);

  const { init, editor } = useEditor({
    defaultState: initialData.json,
    defaultWidth: initialData.width,
    defaultHeight: initialData.height,
    clearSelectionCallback: onClearSelection,
    saveCallback: debouncedSave,
  });

  const onChangeActiveTool = useCallback((tool: ActiveTool) => {
    if (tool === "draw") {
      editor?.enableDrawingMode();
    }

    if (activeTool === "draw") {
      editor?.disableDrawingMode();
    }

    if (tool === "segment") {
      editor?.enableSegmentationMode();
    }

    if (activeTool === "segment") {
      // editor?.clearSegmentationPoints();
      editor?.disableSegmentationMode();

      // clearSegmentation();
    }

    if (tool === activeTool) {
      return setActiveTool("select");
    }

    setActiveTool(tool);
  }, [activeTool, editor]);

  const canvasRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      controlsAboveOverlay: true,
      preserveObjectStacking: true,
    });

    init({
      initialCanvas: canvas,
      initialContainer: containerRef.current!,
    });

    return () => {
      canvas.dispose();
    };
  }, [init]);

  const onAddButtonClick = () => {
    // TODO: Implement add functionality
    console.log("Add button clicked");
  };

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
    try {
      setIsGenerating(true);
      
      const validMasks = segmentedMasks.filter(mask => mask.id && mask.id.trim() !== '');
      
      const trajectories = validMasks.map(mask => mask.trajectory?.points || []);
      const rotations = validMasks.map(mask => mask.rotation || 0);
      
      // Upload the workspace image to UploadThing
      let workspaceImageUrl = "";
      if (workspaceURL) {
        const workspaceFile = await dataUrlToFile(workspaceURL, "workspace.png");
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
        "input_prompt": prompt,
        "input_trajectories": JSON.stringify(trajectories),
        "input_rotations": JSON.stringify(rotations)
      };
      
      console.log("videoGenData", videoGenData);

      // ARGS:
      // 1. Image
      // 2. Prompt
      // 3. Masks
      // 4. Trajectories
      // 5. Rotations

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

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-editor-bg">
      <Navbar
        id={initialData.id}
        editor={editor}
        activeTool={activeTool}
        onChangeActiveTool={onChangeActiveTool}
      />
      <div className="absolute h-[calc(100%-68px)] w-full top-[68px] flex p-2">
        <Sidebar
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <SegmentationSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
          workspaceURL={workspaceURL}
          setWorkspaceURL={setWorkspaceURL}
          segmentedMasks={segmentedMasks}
          setSegmentedMasks={setSegmentedMasks}
          // onCancelSegmentation={clearSegmentation}
        />
        <ShapeSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FillColorSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeColorSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeWidthSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <OpacitySidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TextSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FontSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <ImageSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TemplateSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FilterSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <DrawSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <PromptSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
          prompt={prompt}
          setPrompt={setPrompt}
        />
        <SettingsSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <main className="bg-editor-bg flex-1 overflow-hidden relative flex flex-col rounded-xl mx-2">
          <Toolbar
            editor={editor}
            activeTool={activeTool}
            onChangeActiveTool={onChangeActiveTool}
          />
          <div className="flex-1 bg-white rounded-xl shadow-soft relative mx-2 mt-2 mb-4 overflow-hidden" ref={containerRef}>
            <canvas 
              ref={canvasRef} 
              className={activeTool === "segment" ? "cursor-crosshair" : "cursor-default"}
            />
            <button
              onClick={onAddButtonClick}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-0 flex items-center justify-center bg-blue-600 shadow-lg hover:shadow-xl hover:scale-105 hover:bg-blue-700 transition-all duration-200 group"
            >
              <span className="text-4xl font-bold text-white group-hover:text-white transition-colors">+</span>
            </button>
          </div>
          
          <div className={cn(
            "bg-editor-timeline rounded-xl flex flex-col transition-all duration-300",
            timelineCollapsed ? "h-[70px]" : "h-[600px]",
            "mx-2 mb-2 flex-shrink-0 self-end w-[calc(100%-1rem)]"
          )}>
            <div 
              className="flex items-center justify-between p-4 border-gray-700 cursor-pointer hover:bg-zinc-750"
              onClick={(e) => {
                // Prevent timeline collapse when clicking the button
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
              <div className="min-w-[800px] h-full p-4">
                <VideoTimeline videoGenerations={videoGenerations} onGenerateVideo={handleGenerateVideo} />
              </div>
            </div>
          </div>
          
          <Footer editor={editor} />
        </main>
      </div>
    </div>
  );
}
