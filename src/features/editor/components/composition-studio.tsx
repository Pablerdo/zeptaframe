"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import { Plus, ChevronDown } from "lucide-react";
import { ThemeProvider } from "next-themes";

import { ProjectJSON, ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";

import { 
  ActiveTool, 
  selectionDependentTools,
  VideoGeneration,
  Editor as EditorType,
  VideoExport
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
// import { TemplateSidebar } from "@/features/editor/components/template-sidebar";
import { SettingsSidebar } from "@/features/editor/components/settings-sidebar";
import { SegmentationSidebar } from "@/features/editor/components/segmentation-sidebar";
import { cn } from "@/lib/utils";
import CollapsibleVideoViewer from "@/features/editor/components/collapsible-video-viewer";
import { ScrollableWorkbenchViewer } from "@/features/editor/components/scrollable-workbench-viewer";
import { GenerateImageSidebar } from "./generate-image-sidebar";
import { LastFrameProvider } from '@/features/editor/contexts/last-frame-context';
import { WorkbenchNavigator } from "@/features/editor/components/workbench-navigator";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "./auth-modal";
import { toast } from "sonner";

interface CompositionStudioProps {
  initialData: ResponseType["data"];
  isTrial: boolean;
}

export const CompositionStudio = ({ initialData, isTrial }: CompositionStudioProps) => {
  
  const { mutate } = useUpdateProject(initialData.id);
  const [videoGenerations, setVideoGenerations] = useState<VideoGeneration[]>([]);
  const [videoExports, setVideoExports] = useState<VideoExport[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [allowEncodeWorkbenchImage, setAllowEncodeWorkbenchImage] = useState(true);
  const [projectName, setProjectName] = useState(initialData.name);
  
  const [currentPendingVideoRunIds, setCurrentPendingVideoRunIds] = useState<string[]>([]);

  // Add state for trial-related UI
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const trialInteractionTimer = useRef<NodeJS.Timeout | null>(null);
  const userInteractionCount = useRef(0);

  // Add a new function to parse the project JSON
  const parseProjectData = (jsonString: string): ProjectJSON => {
    try {
      // Try to parse as structured format
      const parsed = JSON.parse(jsonString);
      
      // Check if it has the expected structure
      if (parsed.workbenches && typeof parsed.workbenches === 'object') {
        return parsed;
      }
      
      // If not, it's an older format - create a structure with one workbench
      const defaultId = `workbench-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return {
        metadata: { 
          version: "1.0", 
          lastModified: new Date().toISOString() 
        },
        defaultSettings: {
          width: initialData.width || 960,
          height: initialData.height || 640
        },
        workbenches: {
          [defaultId]: {
            json: jsonString, // Original project JSON becomes the first workbench
            width: initialData.width || 960,
            height: initialData.height || 640
          }
        }
      };
    } catch (e) {
      // If parsing fails, return an empty structure
      const defaultId = `workbench-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return {
        metadata: { 
          version: "1.0", 
          lastModified: new Date().toISOString() 
        },
        defaultSettings: {
          width: initialData.width || 960,
          height: initialData.height || 640
        },
        workbenches: {
          [defaultId]: {
            json: "", 
            width: initialData.width || 960,
            height: initialData.height || 640
          }
        }
      };
    }
  };

  // In CompositionStudio:
  const [projectData, setProjectData] = useState<ProjectJSON>(() => 
    parseProjectData(initialData.json)
  );

  // Initialize workbench IDs from parsed project data
  const [workbenchIds, setWorkbenchIds] = useState<string[]>(() => 
    Object.keys(projectData.workbenches)
  );
  
  // Track active workbench index
  const [activeWorkbenchIndex, setActiveWorkbenchIndex] = useState(0);
  
  // Store the current active editor instance
  const [activeEditor, setActiveEditor] = useState<EditorType | undefined>(undefined);
  
  // Ref for the scrollable container
  const editorsContainerRef = useRef<HTMLDivElement>(null);
  
  // SAM worker and mask state
  const samWorker = useRef<Worker | null>(null);
  const [samWorkerLoading, setSamWorkerLoading] = useState(true);
  const [samWorkerStatus, setSamWorkerStatus] = useState("");
  const [samWorkerInitialized, setSamWorkerInitialized] = useState(false);
  const [samWorkerImageEncoded, setSamWorkerImageEncoded] = useState(false);
  const [samWorkerDevice, setSamWorkerDevice] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
  const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });
  const [prevMaskArray, setPrevMaskArray] = useState<Float32Array | null>(null);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [maskBinary, setMaskBinary] = useState<HTMLCanvasElement | null>(null);

  // Add these new state variables to composition-studio.tsx
  const [isDeletingIndex, setIsDeletingIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null);

  // Video timeline collapsed state
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);

  // Modify sign-up modal to have contextual messages
  const [signUpReason, setSignUpReason] = useState<string>("Save your work and access more features!");
  
  // Function to show sign-up modal with custom reason
  const showSignUpWithReason = useCallback((reason: string) => {
    setSignUpReason(reason);
    setShowSignUpModal(true);
  }, []);

  // Save callback with debounce - updated to standardize workbenchId
  const debouncedSave = useCallback(
    debounce(
      (values: { 
        workbenchId: string,
        json: string,
        height: number,
        width: number,
        promptData: string,
      }) => {
        if (!values.workbenchId) {
          console.error("Missing workbenchId in debouncedSave call");
          return;
        }
        
        // Update the project data state
        setProjectData(prev => {
          const updated = {
            ...prev,
            metadata: {
              ...prev.metadata,
              lastModified: new Date().toISOString()
            },
            workbenches: {
              ...prev.workbenches,
              [values.workbenchId]: {
                json: values.json,
                height: values.height,
                width: values.width,
                promptData: values.promptData
              }
            }
          };
          
          // Serialize the entire structure to JSON
          const serialized = JSON.stringify(updated);
          
          // For trial mode, only save to localStorage
          if (isTrial) {
            localStorage.setItem("trial_project", JSON.stringify({
              ...initialData,
              json: serialized
            }));
          } else {
            // Save to database - uses the existing json field
            mutate({ 
              json: serialized
            });
          }
          
          return updated;
        });
      },
      500
    ), 
    [mutate, isTrial, initialData, showSignUpModal]
  );
  
  const onClearSelection = useCallback(() => {
    if (selectionDependentTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [activeTool]);

  // Handle setting active editor when a workbench becomes active
  const handleSetActiveEditor = useCallback((editor: EditorType, index: number) => {
    setActiveEditor(editor);
    setActiveWorkbenchIndex(index);
  }, []);

  // Create initial workbenches on mount - with more restrictive dependencies
  useEffect(() => {
    if (workbenchIds.length === 0) {
      const initialId = `workbench-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setWorkbenchIds([initialId]);
    }
  }, [workbenchIds.length]); // Only depend on initialData.json, not workbenchIds.length

  // Handle scrolling between workbenches
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
        
        // Calculate which workbench is most visible based on scroll position
        const scrollLeft = container.scrollLeft;
        const workbenchWidth = container.clientWidth;
        
        const visibleIndex = Math.round(scrollLeft / workbenchWidth);
        if (visibleIndex !== activeWorkbenchIndex && visibleIndex < workbenchIds.length) {
          setActiveWorkbenchIndex(visibleIndex);
        }
      }, 150); // Short delay to ensure scrolling has stopped
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeWorkbenchIndex, workbenchIds.length]);

  // Scroll to active workbench when activeWorkbenchIndex changes
  useEffect(() => {
    const container = editorsContainerRef.current;
    if (!container) return;
    
    // Give a small delay to ensure DOM is fully updated
    const timeoutId = setTimeout(() => {
      const scrollTarget = activeWorkbenchIndex * container.clientWidth;
      container.scrollTo({
        left: scrollTarget,
        behavior: 'smooth'
      });
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [activeWorkbenchIndex]);

  const onChangeActiveTool = useCallback((tool: ActiveTool) => {
    if (tool === activeTool) {
      return setActiveTool("select");
    }
    setActiveTool(tool);
  }, [activeTool]);
  
  // Handle adding a new workbench
  const handleAddWorkbench = useCallback(() => {

    if (workbenchIds.length >= 10) {
      toast.error("Ten workbenches is the maximum limit");
      return;
    }

    // In trial mode, limit to 2 workbenches and show signup for more
    if (isTrial && workbenchIds.length >= 2) {
      setShowSignUpModal(true);
      return;
    }
    
    // Generate a unique ID for the new workbench
    const newId = `workbench-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Update workbench IDs array
    setWorkbenchIds(prev => [...prev, newId]);
    
    // Update project data with new workbench
    setProjectData(prev => {
      // Use active workbench as template
      const activeId = workbenchIds[activeWorkbenchIndex];
      const templateWorkbench = // prev.workbenches[activeId] || {
      {  
        json: "",
        width: prev.defaultSettings?.width || 960,
        height: prev.defaultSettings?.height || 640
      };
      
      const updated = {
        ...prev,
        metadata: {
          ...prev.metadata,
          lastModified: new Date().toISOString()
        },
        workbenches: {
          ...prev.workbenches,
          [newId]: templateWorkbench
        }
      };
      
      // Save to database
      mutate({ json: JSON.stringify(updated) });
      
      return updated;
    });
    
    // Set as active
    setActiveWorkbenchIndex(workbenchIds.length);
  }, [workbenchIds, activeWorkbenchIndex, mutate, isTrial]);
  
  // Handle deleting a workbench
  const handleDeleteWorkbench = useCallback((indexToDelete: number) => {
    // Don't allow deleting if it's the last workbench
    if (workbenchIds.length <= 1) return;
    
    // Get the ID of the workbench to delete
    const idToDelete = workbenchIds[indexToDelete];
    
    // Set deleting state for animation
    setIsDeletingIndex(indexToDelete);
    
    // Use consistent transition direction
    setTransitionDirection('right');
    
    // Delay the actual state updates until animation completes
    setTimeout(() => {
      // Determine the new active index before modifying state
      let newActiveIndex: number;
      
      if (indexToDelete === activeWorkbenchIndex) {
        // If deleting active workbench, go to the next one, or previous if it's the last
        newActiveIndex = indexToDelete === workbenchIds.length - 1 
          ? indexToDelete - 1 
          : indexToDelete;
      } else if (indexToDelete < activeWorkbenchIndex) {
        // If deleting a workbench before the active one, adjust the index
        newActiveIndex = activeWorkbenchIndex - 1;
      } else {
        // If deleting a workbench after the active one, keep the same index
        newActiveIndex = activeWorkbenchIndex;
      }
      
      // Update workbench IDs first
      setWorkbenchIds(prev => prev.filter((_, i) => i !== indexToDelete));
      
      // Then set the active index
      setActiveWorkbenchIndex(newActiveIndex);
      
      // Update project data
      setProjectData(prev => {
        const { [idToDelete]: removed, ...remaining } = prev.workbenches;
        
        const updated = {
          ...prev,
          metadata: {
            ...prev.metadata,
            lastModified: new Date().toISOString()
          },
          workbenches: remaining
        };
        
        // Save to database
        mutate({ json: JSON.stringify(updated) });
        
        return updated;
      });
      
      // Reset animation states after changes are applied
      setIsDeletingIndex(null);
      setTransitionDirection(null);
      
    }, 300);
    
  }, [workbenchIds, activeWorkbenchIndex, mutate]);

  /*** SAM WORKER IMPLEMENTATION ***/
  // Add these refs at the component level to track current state
  const activeToolRef = useRef<ActiveTool>("select");
  const activeEditorRef = useRef<EditorType | undefined>(undefined);

  // Update refs whenever state changes
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    activeEditorRef.current = activeEditor;
  }, [activeEditor]);

  // Then modify your handleDecodingResults function to use the refs
  // function handleDecodingResults(decodingResults: { 
  //   masks: { dims: number[]; }; 
  //   iou_predictions: { cpuData: number[]; }; 
  // }) {
  //   console.log("inside handleDecodingResults", decodingResults);
  //   // SAM2 returns 3 mask along with scores -> select best one
  //   const maskTensors = decodingResults.masks;
  //   const [bs, noMasks, width, height] = maskTensors.dims;
  //   const maskScores = decodingResults.iou_predictions.cpuData;
  //   const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
  //   const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx)
  //   let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
  //   let bestMaskBinary = float32ArrayToBinaryMask(bestMaskArray, width, height)

  //   bestMaskCanvas = resizeCanvas(bestMaskCanvas, { w: 960, h: 640 });
  //   bestMaskBinary = resizeCanvas(bestMaskBinary, { w: 960, h: 640 });
  //   setMask(bestMaskCanvas);
  //   setMaskBinary(bestMaskBinary);
  //   setPrevMaskArray(bestMaskArray);

  //   // Use refs to get current values
  //   const currentActiveTool = activeToolRef.current;
  //   const currentEditor = activeEditorRef.current;

  //   console.log("currentActiveTool", currentActiveTool);
  //   console.log("currentEditor?.canvas", currentEditor?.canvas);
    
  //   // Add mask to canvas if in segment mode
  //   if (currentActiveTool === "segment" && currentEditor?.canvas) {
  //     console.log("inside handleDecodingResults, currentActiveTool === 'segment' && currentEditor?.canvas");
  //     const workspace = currentEditor.getWorkspace();
  //     if (!workspace) return;

  //     // Get workspace dimensions with type assertion since we know these are fabric.Object properties
  //     const workspaceWidth = (workspace as fabric.Object).width as number || 960;
  //     const workspaceHeight = (workspace as fabric.Object).height as number || 640;

  //     // Create a temporary canvas to properly scale the mask
  //     const tempCanvas = document.createElement('canvas');
  //     tempCanvas.width = workspaceWidth;  // Original workspace width
  //     tempCanvas.height = workspaceHeight; // Original workspace height
  //     const tempCtx = tempCanvas.getContext('2d');

  //     if (!tempCtx) return;

  //     // Draw the mask centered and scaled
  //     tempCtx.drawImage(
  //       bestMaskCanvas,
  //       0,
  //       0,
  //       bestMaskCanvas.width,
  //       bestMaskCanvas.height,
  //     );

  //     // Convert the properly scaled mask canvas to a Fabric image
  //     fabric.Image.fromURL(tempCanvas.toDataURL(), (maskImage) => {
  //       // Position the mask at the workspace coordinates
  //       maskImage.set({
  //         left: workspace.left || 0,
  //         top: workspace.top || 0,
  //         width: workspaceWidth,  // Original workspace width
  //         height: workspaceHeight, // Original workspace height
  //         selectable: false,
  //         evented: false,
  //         opacity: 0.9,
  //       });

  //       // Remove any existing mask before adding the new one
  //       const existingMasks = currentEditor.canvas.getObjects().filter(obj => obj.data?.isMask);
  //       existingMasks.forEach(mask => currentEditor.canvas.remove(mask));

  //       // Add metadata to identify this as a mask
  //       maskImage.data = { isMask: true };
        
  //       currentEditor.canvas.add(maskImage);
  //       currentEditor.canvas.renderAll();
  //     });
  //   }
  // }
  
  // Start encoding image
  
  // const encodeWorkbenchImage = async () => {
  //   if (!samWorker.current || !activeEditor?.canvas) return;
    
  //   const workspace = activeEditor?.getWorkspace();
  //   if (!workspace) return;

  //   // Get the workspace dimensions and position
  //   const workspaceWidth = workspace.width || 960;
  //   const workspaceHeight = workspace.height || 640;
  //   const workspaceLeft = workspace.left || 0;
  //   const workspaceTop = workspace.top || 0;
    
  //   // Create a temporary canvas with the workspace content
  //   const tempCanvas = document.createElement('canvas');
  //   tempCanvas.width = workspaceWidth;
  //   tempCanvas.height = workspaceHeight;
  //   const tempCtx = tempCanvas.getContext('2d');
    
  //   // Save current viewport transform and ensure it's not undefined
  //   const currentViewportTransform = activeEditor.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    
  //   // Reset viewport transform temporarily to get accurate image
  //   activeEditor.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
  //   // Draw the workspace content onto the temp canvas
  //   const workspaceImage = activeEditor.canvas.toDataURL({
  //     format: 'png',  
  //     quality: 1,
  //     left: workspaceLeft,
  //     top: workspaceTop,
  //     width: workspaceWidth,
  //     height: workspaceHeight
  //   });

  //   activeEditor.setWorkspaceURL(workspaceImage);

  //   // Restore viewport transform
  //   activeEditor.canvas.setViewportTransform(currentViewportTransform);

  //   const img = new Image();
  //   img.onload = () => {
  //       const largestDim = Math.max(workspaceWidth, workspaceHeight);

  //       const box = resizeAndPadBox(
  //         { h: workspaceHeight, w: workspaceWidth },
  //         { h: largestDim, w: largestDim }
  //       );
        
  //       tempCtx?.drawImage(img, 0, 0, 960, 640, box?.x || 0, 0, box?.w, box?.h);

  //       // tempCtx?.drawImage(img, 0, 0, workspaceWidth, workspaceHeight, box?.x || 0, box?.y || 0, box?.w, box?.h);
      
  //       samWorker.current?.postMessage({
  //         type: "encodeImage",
  //         data: canvasToFloat32Array(resizeCanvas(tempCanvas, imageSize)),
  //       });

  //       setSamWorkerLoading(true);
  //       setSamWorkerStatus("Encoding");
  //   };

  //   img.src = workspaceImage;
  // };

  // useEffect(() => {
  //   if (activeEditor?.canvas && activeTool !== "segment" && allowEncodeWorkbenchImage) {
  //     // Create a debounced version of the canvas change handler
  //     // This will wait 800ms after the last change before executing
  //     const debouncedHandleCanvasChange = debounce(() => {
  //       if (samWorker.current && samWorkerDevice) {
  //         console.log("encoding canvas from composition studio");
  //         encodeWorkbenchImage();
  //       }
  //     }, 500);
      
  //     // Add event listeners for all object changes
  //     activeEditor.canvas.on('object:added', debouncedHandleCanvasChange);
  //     activeEditor.canvas.on('object:modified', debouncedHandleCanvasChange);
  //     activeEditor.canvas.on('object:removed', debouncedHandleCanvasChange);

  //     // // Add text-specific event listeners
  //     // activeEditor.canvas.on('text:changed', debouncedHandleCanvasChange);
  //     // activeEditor.canvas.on('text:editing:exited', debouncedHandleCanvasChange);
    
  //     // Cleanup all listeners and cancel any pending debounced calls
  //     return () => {
  //       activeEditor.canvas.off('object:added', debouncedHandleCanvasChange);
  //       activeEditor.canvas.off('object:modified', debouncedHandleCanvasChange);
  //       activeEditor.canvas.off('object:removed', debouncedHandleCanvasChange);
  //       // activeEditor.canvas.off('text:changed', debouncedHandleCanvasChange);
  //       // activeEditor.canvas.off('text:editing:exited', debouncedHandleCanvasChange);
      
  //       debouncedHandleCanvasChange.cancel(); // Important: cancel any pending executions
  //     };
  //   }
  // }, [activeEditor?.canvas, samWorker.current, samWorkerDevice, encodeWorkbenchImage, activeTool, allowEncodeWorkbenchImage]);

  
  const onWorkerMessage = (event: MessageEvent) => {
    const { type, data } = event.data;

    if (type == "pong") {
      const { success, device } = data;

      if (success) {
        setSamWorkerLoading(false);
        setSamWorkerDevice(device);
        setSamWorkerStatus("Encode image");
        setSamWorkerInitialized(true);
      } else {
        setSamWorkerStatus("Error (check JS console)");
      }
    } else if (type == "downloadInProgress" || type == "loadingInProgress") {
      setSamWorkerLoading(true);
      setSamWorkerStatus("Loading model");
    } else if (type == "encodeImageDone") {
      // alert(data.durationMs)
      // console.log("Encode image done");
      setSamWorkerImageEncoded(true);
      setSamWorkerLoading(false);
      setSamWorkerStatus("Ready. Click on image to start new mask");
    } else if (type == "decodeMaskResult") {
      // The handleDecodingResults has been moved to the Workbench component
      // handleDecodingResults(data);
      // We just need to update the UI state here
      setSamWorkerLoading(false);
      setSamWorkerStatus("Ready. Click on image");
    }
  };

  const initializeSamWorker = useCallback(() => {
    if (!samWorker.current) {
      console.log("Initializing SAM worker");
      samWorker.current = new Worker(new URL("../../../app/sam/worker.js", import.meta.url), {
        type: "module",
      });
      samWorker.current.addEventListener("message", onWorkerMessage);
      samWorker.current.postMessage({ type: "ping" });
      console.log("Worker started");
      setSamWorkerLoading(true);
    }
  }, []);

  useEffect(() => {
    initializeSamWorker();
    
    // Clean up isAuthNavigating flag if it exists
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isAuthNavigating');
    }
  }, [initializeSamWorker]);

  useEffect(() => {
    // Cleanup worker when component unmounts
    return () => {
      if (samWorker.current) {
        samWorker.current.terminate();
        samWorker.current = null;
      }
    };
  }, []);

  // Add polling for video generations - only for signed-in users
  useEffect(() => {
    // First, fetch all video generations for this project
    const fetchAllVideoGenerations = async () => {
      try {
        const response = await fetch(`/api/video-generations?projectId=${initialData.id}`);
        if (!response.ok) throw new Error('Failed to fetch video generations');
        
        const data = await response.json();
        if (data.videoGenerations) {
          setVideoGenerations(data.videoGenerations);
          
          // Check if any are still pending
          const hasPending = data.videoGenerations.some((gen: any) => gen.status === 'pending');
          setIsGenerating(hasPending);
        }
      } catch (error) {
        console.error('Error fetching all video generations:', error);
      }
    };
    
    // Function to only fetch pending generations (for polling)
    const fetchPendingVideoGenerations = async () => {
      try {
        // Get a list of all current pending runIds
        const pendingRunIds = videoGenerations
          .filter(gen => gen.status === 'pending')
          .map(gen => gen.runId);

        // If we have no pending generations, just do a full refresh
        if (pendingRunIds.length === 0) {
          return fetchAllVideoGenerations();
        }
        
        // Get the current status of all previously pending generations
        const response = await fetch(
          `/api/video-generations?projectId=${initialData.id}`
        );
        if (!response.ok) throw new Error('Failed to fetch video generations');
        
        const data = await response.json();
        
        if (data.videoGenerations) {
          // Update our state by merging current with updated data
          setVideoGenerations(prev => {
            const updatedGenerations = [...prev];
            
            // Map of runIds to updated generation objects
            const generationsMap = new Map(
              (data.videoGenerations as VideoGeneration[]).map((gen) => [gen.runId, gen])
            );
            
            // Update each generation in our state
            for (let i = 0; i < updatedGenerations.length; i++) {
              const runId = updatedGenerations[i].runId;
              const updated = generationsMap.get(runId);
              
              if (updated) {
                updatedGenerations[i] = updated;
              }
            }
            
            return updatedGenerations;
          });
          
          // Check if any are still pending
          const stillPending = (data.videoGenerations as VideoGeneration[]).some((gen) => gen.status === 'pending');
          setIsGenerating(stillPending);
        }
      } catch (error) {
        console.error('Error fetching pending video generations:', error);
      }
    };
    
    // Initial fetch regardless of trial status
    fetchAllVideoGenerations();
    
    // Only set up polling for authenticated users
    let intervalId: NodeJS.Timeout | null = null;
    
    if (!isTrial) {
      // Set up polling for pending updates - only for signed-in users
      intervalId = setInterval(fetchPendingVideoGenerations, 10000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [initialData.id, isTrial]);

  // Add polling for video exports - only for signed-in users
  useEffect(() => {
    const fetchAllVideoExports = async () => {
      try {
        const response = await fetch(`/api/video-exports?projectId=${initialData.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch video exports');
        }
        
        const data = await response.json();
        
        if (data.videoExports) {
          setVideoExports(data.videoExports);
        }
      } catch (err) {
        console.error('Error fetching video exports:', err);
      }
    };
    
    // Initial fetch regardless of trial status
    fetchAllVideoExports();

    // Only set up polling for authenticated users
    let intervalId: NodeJS.Timeout | null = null;
    
    if (!isTrial) {
      intervalId = setInterval(fetchAllVideoExports, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [initialData.id, isTrial]);
  
  // Function to update project name (locally and on server)
  const updateProjectName = useCallback(async (name: string) => {
    // Update local state
    setProjectName(name);
    
    // Update on server
    try {
      await fetch(`/api/projects/${initialData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      // You could show a success toast here if you want
    } catch (error) {
      console.error('Failed to update project name:', error);
      // Optionally, revert to the old name if the server update fails
      // setProjectName(initialData.name);
      
      // You could show an error toast here
    }
  }, [initialData.id]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <UserStatusProvider 
        initialUserStatus={{
          isAuthenticated: !isTrial,
          userPlan: isTrial ? "trial" : "free", // Add pro plan to this logic as well
        }}
      >
        <LastFrameProvider videoGenerations={videoGenerations}>
          <div className="w-full h-full flex flex-col overflow-hidden bg-editor-bg dark:bg-editor-bg-dark">
            <Navbar
              projectName={projectName}
              setProjectName={updateProjectName}
              id={initialData.id}
              editor={activeEditor}
              activeTool={activeTool}
              onChangeActiveTool={onChangeActiveTool}
              isTrial={isTrial}
              setShowAuthModal={setShowAuthModal}
            />
            <div className="absolute h-[calc(100%-50px)] w-full top-[50px] flex p-2">
              <Sidebar
                activeTool={activeTool}
                onChangeActiveTool={onChangeActiveTool}
              />
              <SegmentationSidebar
                editor={activeEditor}
                activeTool={activeTool}
                onChangeActiveTool={onChangeActiveTool}
                samWorker={samWorker}
              />
              <GenerateImageSidebar
                editor={activeEditor}
                activeTool={activeTool}
                onChangeActiveTool={onChangeActiveTool}
                isTrial={isTrial}
                setShowAuthModal={setShowAuthModal}
                projectId={initialData.id}
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
              <SettingsSidebar
                editor={activeEditor}
                activeTool={activeTool}
                onChangeActiveTool={onChangeActiveTool}
              />
              <main className="bg-transparent flex-1 overflow-hidden relative flex flex-col rounded-xl mx-2">
                <Toolbar
                  editor={activeEditor}
                  activeTool={activeTool}
                  onChangeActiveTool={onChangeActiveTool}
                />


                <div className="flex flex-row h-full w-full mb-4 relative overflow-hidden">
                  <ScrollableWorkbenchViewer
                    editorsContainerRef={editorsContainerRef}
                    workbenchIds={workbenchIds}
                    activeWorkbenchIndex={activeWorkbenchIndex}
                    handleSetActiveEditor={handleSetActiveEditor}
                    handleDeleteWorkbench={handleDeleteWorkbench}
                    initialData={initialData}
                    debouncedSave={debouncedSave}
                    onClearSelection={onClearSelection}
                    activeTool={activeTool}
                    onChangeActiveTool={onChangeActiveTool}
                    samWorker={samWorker}
                    samWorkerLoading={samWorkerLoading}
                    setSamWorkerLoading={setSamWorkerLoading}
                    prevMaskArray={prevMaskArray}
                    setPrevMaskArray={setPrevMaskArray}
                    mask={mask}
                    setMask={setMask}
                    maskBinary={maskBinary}
                    setMaskBinary={setMaskBinary}
                    projectData={projectData}
                    isDeletingIndex={isDeletingIndex}
                    transitionDirection={transitionDirection}
                    setAllowEncodeWorkbenchImage={setAllowEncodeWorkbenchImage}
                    samWorkerInitialized={samWorkerInitialized}
                    isTrial={isTrial}
                    setShowAuthModal={setShowAuthModal}
                  />
                  
                  {/* Add workbench button */}
                  <div className="w-10 flex items-center justify-center">
                    <button
                      onClick={handleAddWorkbench}
                      className={cn("bg-editor-sidebar rounded-xl p-2")}
                    >
                      <Plus className="h-6 w-6" strokeWidth={3} />
                    </button>
                  </div>

                </div>
                <div className="flex w-full">
                  <div 
                    className="w-[41%] bg-editor-sidebar flex items-center px-4 ml-2 pb-1 border-gray-700 cursor-pointer hover:bg-zinc-750 transition-colors duration-200 pt-1 rounded-t-lg"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setTimelineCollapsed(!timelineCollapsed);
                      }
                    }}
                  > 
                    <div className="flex items-center">
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
                  </div>
                  <WorkbenchNavigator 
                    workbenchIds={workbenchIds}
                    activeWorkbenchIndex={activeWorkbenchIndex}
                    setActiveWorkbenchIndex={setActiveWorkbenchIndex}
                  />
                </div>
                <CollapsibleVideoViewer
                  timelineCollapsed={timelineCollapsed}
                  workbenchIds={workbenchIds}
                  videoGenerations={videoGenerations}
                  isGenerating={isGenerating}
                  workbenchCount={workbenchIds.length}
                  activeWorkbenchIndex={activeWorkbenchIndex}
                  projectId={initialData.id}
                  videoExports={videoExports}
                />
                
                {/* <Footer editor={activeEditor} /> */}
              </main>
            </div>
            
          </div>
        </LastFrameProvider>
      </UserStatusProvider>
      
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        projectId={initialData.id}
        isTrial={isTrial}
      />
    </ThemeProvider>
  );
}
