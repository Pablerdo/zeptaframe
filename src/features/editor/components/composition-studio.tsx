"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { ThemeProvider } from "next-themes";

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
import { dataUrlToFile, uploadToUploadThingResidual } from "@/lib/uploadthing";
import { Workspace } from "@/features/editor/components/workspace";
import { CameraControlSidebar } from "./camera-control-sidebar";
import CollapsibleVideoViewer from "@/features/editor/components/collapsible-video-viewer";

interface CompositionStudioProps {
  initialData: ResponseType["data"];
}

export const CompositionStudio = ({ initialData }: CompositionStudioProps) => {
  const { mutate } = useUpdateProject(initialData.id);
  const [videoGenerations, setVideoGenerations] = useState<VideoGeneration[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  
  // Add a ref to store the latest initialData.json
  const initialDataJsonRef = useRef(initialData.json);
  
  // Update the ref when initialData.json changes
  useEffect(() => {
    initialDataJsonRef.current = initialData.json;
  }, [initialData.json]);
  
  // Use workspace IDs array instead of just a count
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  
  // Track active workspace index
  const [activeWorkspaceIndex, setActiveWorkspaceIndex] = useState(0);
  
  // Store the current active editor instance
  const [activeEditor, setActiveEditor] = useState<EditorType | undefined>(undefined);
  
  // Ref for the scrollable container
  const editorsContainerRef = useRef<HTMLDivElement>(null);
  
  // Create ref outside the effect
  const isWorkspacesInitialized = useRef(false);
  
  // Save callback with debounce - FIXED to prevent infinite update loop
  const debouncedSave = useCallback(
    debounce(
      (values: { 
        json: string,
        height: number,
        width: number,
        workspaceIndex: number,
      }) => {
        // Use the ref instead of directly accessing initialData.json
        const currentJson = initialDataJsonRef.current;
        
        // Create a structured object to store multiple workspaces
        const currentWorkspaces = JSON.parse(currentJson || '{"workspaces":[]}');
        let workspaces = currentWorkspaces.workspaces || [];
        
        // Update the workspace at the given index, or add a new one
        const workspaceData = {
          json: values.json,
          height: values.height,
          width: values.width,
        };
        
        if (workspaces[values.workspaceIndex]) {
          workspaces[values.workspaceIndex] = workspaceData;
        } else {
          // Fill any gaps with empty workspaces if needed
          while (workspaces.length < values.workspaceIndex) {
            workspaces.push(null);
          }
          workspaces.push(workspaceData);
        }
        
        const updatedJson = JSON.stringify({ workspaces });
        
        // Save the entire workspaces array to the project
        mutate({
          json: updatedJson,
          height: values.height,
          width: values.width,
        });
      },
      500
    ), 
    [mutate] // Remove initialData.json from the dependency array
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
    const newIndex = workspaceIds.length;
    
    setWorkspaceIds(prev => [...prev, newId]);
    setActiveWorkspaceIndex(newIndex);
    
    // Update the stored data to include the new workspace
    try {
      const data = JSON.parse(initialData.json || '{"workspaces":[]}');
      if (!data.workspaces) data.workspaces = [];
      
      // Add a placeholder for the new workspace
      data.workspaces.push({
        json: null,
        width: 720,  // Default width
        height: 480, // Default height
      });
      
      // Save the updated workspaces array
      mutate({
        json: JSON.stringify(data),
        height: initialData.height,
        width: initialData.width,
      });
    } catch (error) {
      console.error("Error adding new workspace to stored data:", error);
    }
  }, [workspaceIds.length, initialData, mutate]);

  // Create initial workspaces on mount - with more restrictive dependencies
  useEffect(() => {
    if (workspaceIds.length === 0 && !isWorkspacesInitialized.current) {
      isWorkspacesInitialized.current = true;
      
      try {
        // Parse the initialData to get stored workspaces
        const data = JSON.parse(initialData.json || '{"workspaces":[]}');
        if (data.workspaces && Array.isArray(data.workspaces)) {
          // Filter out any null entries
          const validWorkspaces = data.workspaces.filter((ws: any) => ws !== null);
          
          if (validWorkspaces.length > 0) {
            // Generate IDs for each workspace found in data
            const timestamp = Date.now();
            const ids = validWorkspaces.map((_: any, i: number) => 
              `workspace-${timestamp}-${i}-${Math.random().toString(36).substring(2, 9)}`
            );
            setWorkspaceIds(ids);
            return;
          }
        }
      } catch (error) {
        console.error("Error parsing initial workspace data:", error);
      }
      
      // Fallback: create a single workspace if none exist
      const initialId = `workspace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setWorkspaceIds([initialId]);
    }
  }, [initialData.json]); // Only depend on initialData.json, not workspaceIds.length

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
    
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      container.scrollTo({
        left: activeWorkspaceIndex * container.clientWidth,
        behavior: 'smooth'
      });
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
    const visibilityListeners: (() => void)[] = [];
    const rafIds: number[] = [];
    
    console.log("setting up video status check intervals");

    // Only create intervals for pending generations
    videoGenerations.forEach((gen, index) => {
      if (gen.status === 'pending') {
        console.log(`Setting up interval for video generation ${gen.runId}`);
        
        // Status check interval
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
              
              // Clean up all timers and listeners for this generation
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error(`Error checking status for video ${gen.runId}:`, error);
          }
        }, 5000);
        
        intervals.push(intervalId);
      }
    });

    // Cleanup function to clear all intervals and listeners
    return () => {
      console.log(`Cleaning up ${intervals.length} status check intervals`);
      intervals.forEach(id => clearInterval(id));
      rafIds.forEach(id => cancelAnimationFrame(id));
      visibilityListeners.forEach(listener => 
        document.removeEventListener('visibilitychange', listener)
      );
    };
  }, [videoGenerations.map(gen => gen.runId).join(',')]); // Only depend on the runIds

  const handleGenerateVideo = async (model?: string) => {
    if (!activeEditor) return;
    
    if (model === "CogVideoX") {
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
          // Add new video generation to array with current workspace index
          const startTime = Date.now();
          const estimatedDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
          
          setVideoGenerations(prev => [...prev, {
            runId: data.runId,
            status: 'pending',
            progress: 0,
            workspaceIndex: activeWorkspaceIndex,
            startTime: startTime, // Store when we started
            estimatedDuration: estimatedDuration // Store how long we expect it to take
          }]);
          
          // Create a function to update progress based on elapsed time
          const updateProgress = () => {
            const elapsedTime = Date.now() - startTime;
            const calculatedProgress = Math.min((elapsedTime / estimatedDuration) * 100, 99);
            
            setVideoGenerations(prev => prev.map(gen => 
              gen.runId === data.runId ? {
                ...gen,
                progress: calculatedProgress
              } : gen
            ));
          };
          
          // Use requestAnimationFrame when visible and setInterval as fallback
          let progressInterval: number | NodeJS.Timeout;
          let rafId: number;
          
          const handleVisibilityChange = () => {
            if (document.hidden) {
              // Tab is hidden, use setInterval (will be throttled but still runs occasionally)
              cancelAnimationFrame(rafId);
              progressInterval = setInterval(updateProgress, 2000);
            } else {
              // Tab is visible, use requestAnimationFrame for smooth updates
              clearInterval(progressInterval as NodeJS.Timeout);
              
              const updateWithRAF = () => {
                updateProgress();
                rafId = requestAnimationFrame(updateWithRAF);
              };
              rafId = requestAnimationFrame(updateWithRAF);
            }
          };
          
          // Set up initial state based on current visibility
          document.addEventListener('visibilitychange', handleVisibilityChange);
          handleVisibilityChange();
          
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
    } else if (model === "HunyuanVideo") {
      console.log("HunyuanVideo model selected");
    } else {
      console.log("Model not yet implemented");
    } 
  }
  

  // Handle deleting a workspace
  const handleDeleteWorkspace = useCallback((indexToDelete: number) => {
    // Don't allow deleting if it's the last workspace
    if (workspaceIds.length <= 1) return;
    
    // Create a new array without the deleted workspace
    setWorkspaceIds(prev => prev.filter((_, i) => i !== indexToDelete));
    
    // Also remove the workspace from the stored data
    try {
      const data = JSON.parse(initialData.json || '{"workspaces":[]}');
      if (data.workspaces && Array.isArray(data.workspaces)) {
        data.workspaces = data.workspaces.filter((_: any, i: number) => i !== indexToDelete);
        
        // Save the updated workspaces array
        mutate({
          json: JSON.stringify(data),
          height: initialData.height,
          width: initialData.width,
        });
      }
    } catch (error) {
      console.error("Error removing workspace from stored data:", error);
    }
    
    // Update active workspace index
    if (indexToDelete === activeWorkspaceIndex) {
      const newActiveIndex = indexToDelete === 0 ? 0 : indexToDelete - 1;
      setActiveWorkspaceIndex(newActiveIndex);
    } 
    else if (indexToDelete < activeWorkspaceIndex) {
      setActiveWorkspaceIndex(prev => prev - 1);
    }
  }, [workspaceIds.length, activeWorkspaceIndex, initialData, mutate]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
          <CameraControlSidebar
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
                {workspaceIds.map((id, index) => {
                  // Parse workspace data for this index
                  let workspaceState, workspaceWidth, workspaceHeight;
                  
                  try {
                    const data = JSON.parse(initialData.json || '{"workspaces":[]}');
                    if (data.workspaces && data.workspaces[index]) {
                      const workspace = data.workspaces[index];
                      workspaceState = workspace.json;
                      workspaceWidth = workspace.width;
                      workspaceHeight = workspace.height;
                    } else if (index === 0) {
                      // Fallback for first workspace if in old format
                      workspaceState = initialData.json;
                      workspaceWidth = initialData.width;
                      workspaceHeight = initialData.height;
                    }
                  } catch (error) {
                    console.error(`Error parsing workspace data for index ${index}:`, error);
                    if (index === 0) {
                      // Fallback for first workspace
                      workspaceState = initialData.json;
                      workspaceWidth = initialData.width;
                      workspaceHeight = initialData.height;
                    }
                  }
                  
                  return (
                    <Workspace
                      key={id}
                      index={index}
                      isActive={index === activeWorkspaceIndex}
                      onActive={handleSetActiveEditor}
                      onDelete={handleDeleteWorkspace}
                      canDelete={workspaceIds.length > 1}
                      defaultState={workspaceState}
                      defaultWidth={workspaceWidth}
                      defaultHeight={workspaceHeight}
                      clearSelectionCallback={onClearSelection}
                      saveCallback={debouncedSave}
                      activeTool={activeTool}
                    />
                  );
                })}
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
            
            <CollapsibleVideoViewer
              videoGenerations={videoGenerations}
              onGenerateVideo={handleGenerateVideo}
              isGenerating={isGenerating}
              workspaceCount={workspaceIds.length}
              activeWorkspaceIndex={activeWorkspaceIndex}
            />
            
            <Footer editor={activeEditor} />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
