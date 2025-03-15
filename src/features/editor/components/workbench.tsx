"use client";

import { fabric } from "fabric";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Crosshair, MessageSquare, Trash2, Video, Film, ArrowRightSquare, PlayCircle, ArrowRightCircle, Loader2, ArrowRight, CornerUpRight } from "lucide-react";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { ActiveTool, ActiveWorkbenchTool, BaseVideoModel, Editor as EditorType, JSON_KEYS, SegmentedMask, SupportedVideoModelId, VideoGeneration } from "@/features/editor/types";
import { cn } from "@/lib/utils";
import { SidebarItem } from "@/features/editor/components/sidebar-item";
import { RightSidebarItem } from "./right-sidebar-item";
import { AnimateRightSidebar } from "./right-sidebar/animate-right-sidebar";
import { CameraControlRightSidebar } from "./right-sidebar/camera-control-right-sidebar";
import { TextPromptRightSidebar } from "./right-sidebar/text-prompt-right-sidebar";
import { ModelRightSidebar } from "./right-sidebar/model-right-sidebar";
import { uploadToUploadThingResidual } from "@/lib/uploadthing";
import { dataUrlToFile } from "@/lib/uploadthing";
import { 
  sliceTensor, 
  float32ArrayToCanvas, 
  float32ArrayToBinaryMask, 
  resizeCanvas,
  canvasToFloat32Array,
  resizeAndPadBox
} from "@/app/sam/lib/imageutils";
import debounce from "lodash/debounce";
import { db } from "@/db/drizzle";
import { videoGenerations } from "@/db/schema";
import { defaultVideoModelId, videoModels } from "../utils/videoModels";
import { precisionReplacer } from "../utils/json-helpers";

interface WorkbenchProps {
  projectId: string;
  defaultState?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultPromptData?: string;
  clearSelectionCallback?: () => void;
  debouncedSave?: (values: { 
    json: string;
    height: number;
    width: number;
    promptData: string;
  }) => void;
  isActive: boolean;
  index: number;
  workbenchId: string;
  onActive: (editor: EditorType, index: number) => void;
  activeTool: ActiveTool;
  onDelete: (index: number) => void;
  canDelete: boolean;
  onChangeActiveTool: (tool: ActiveTool) => void;
  samWorker: React.RefObject<Worker | null>;
  samWorkerLoading: boolean;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
  setAllowEncodeWorkbenchImage: (allowEncodeWorkbenchImage: boolean) => void;
}

export const Workbench = ({
  projectId,
  defaultState,
  defaultWidth,
  defaultHeight,
  defaultPromptData,
  clearSelectionCallback,
  debouncedSave,
  isActive,
  index,
  workbenchId,
  onActive,
  activeTool,
  onDelete,
  canDelete,
  samWorker,
  samWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
  setAllowEncodeWorkbenchImage,
}: WorkbenchProps) => {
  // Create refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const isActiveNotifiedRef = useRef(false);
  const [activeWorkbenchTool, setActiveWorkbenchTool] = useState<ActiveWorkbenchTool>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New state - promptData elements owned by workbench
  const [generalTextPrompt, setGeneralTextPrompt] = useState<string>("");
  const [segmentedMasks, setSegmentedMasks] = useState<SegmentedMask[]>([]);
  const [selectedModel, setSelectedModel] = useState<BaseVideoModel>(videoModels[defaultVideoModelId]);
  const [cameraControl, setCameraControl] = useState<Record<string, any>>({});

  const [canImportPreviousLastFrame, setCanImportPreviousLastFrame] = useState(true);
  // Initialize from defaultPromptData if available
  useEffect(() => {
    if (typeof defaultPromptData === 'string') {
      try {
        const parsed = JSON.parse(defaultPromptData);
        if (parsed) {
          console.log("parsed", parsed);
          // Look for either textPrompt or generalTextPrompt in the parsed data
          setGeneralTextPrompt(parsed.generalTextPrompt || "");

          if (parsed.segmentedMasks && parsed.segmentedMasks.length > 0) {
            setSegmentedMasks(parsed.segmentedMasks || []);
          }
          
          // For model, find the correct object based on ID
          if (parsed.selectedModelId) {
            const foundModel = Object.values(videoModels).find(
              model => model.id === parsed.selectedModelId
            );
            if (foundModel) setSelectedModel(foundModel);
          }
          
          setCameraControl(parsed.cameraControl || {});
        }
      } catch (e) {
        console.error("Failed to parse promptData:", e);
      }
    }
  }, [defaultPromptData]);

  // Initialize the editor with useEditor hook (without promptData)
  const { init, editor } = useEditor({
    defaultState,
    defaultWidth,
    defaultHeight,
    // defaultPromptData: parsedPromptData,
    clearSelectionCallback,
    saveCallback: debouncedSave,
  });

  // Save promptData whenever it changes
  useEffect(() => {
    if (debouncedSave && editor?.canvas) {
      const workspace = editor.canvas.getObjects().find(obj => obj.name === "clip");
      const height = workspace?.height || defaultHeight || 0;
      const width = workspace?.width || defaultWidth || 0;
      
      // Get JSON from canvas with precision
      const json = JSON.stringify(editor.canvas.toJSON(JSON_KEYS), precisionReplacer);      

      // Create promptData JSON with consistently named keys
      const promptData = JSON.stringify({
        segmentedMasks,
        cameraControl,
        generalTextPrompt,  // Save as textPrompt in JSON
        selectedModelId: selectedModel.id
      });
      
      // Save everything
      debouncedSave({ json, height, width, promptData });
    }
  }, [segmentedMasks, generalTextPrompt, selectedModel, cameraControl, editor?.canvas]);

  // Initialize canvas when component mounts
  useEffect(() => {
    if (canvasRef.current && containerRef.current && !isInitializedRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        controlsAboveOverlay: true,
        preserveObjectStacking: true,
      });
      
      init({
        initialCanvas: canvas,
        initialContainer: containerRef.current,
      });
      
      isInitializedRef.current = true;
    }
  }, [init]);

  useEffect(() => {
    if (editor) {
      if (activeWorkbenchTool === "animate") {
        setAllowEncodeWorkbenchImage(false);
      } else {
        setAllowEncodeWorkbenchImage(true);
      }
    }
  }, [activeWorkbenchTool, editor]);

  // Handle tool changes when this workbench is active
  useEffect(() => {
    if (isActive && editor) {
      if (activeTool === "draw") {
        editor.enableDrawingMode();
      } else if (activeTool === "segment") {
        editor.enableSegmentationMode();
      } else {
        // Disable special modes when not active
        editor.disableDrawingMode();
        editor.disableSegmentationMode();
      }
    }
  }, [isActive, activeTool, editor]);

  // Prevent canvas from being reset or losing content
  const handleContainerClick = (e: React.MouseEvent) => {
    // Prevent default only if clicking directly on the container (not canvas elements)
    if (e.target === containerRef.current) {
      e.preventDefault();
    }
  };

  // Handle delete button click
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent container click
    if (canDelete) {
      onDelete(index);
    }
  };

  const handleGenerateVideo = async (modelId?: SupportedVideoModelId) => {
    if (!editor) return;

    if (modelId === "cogvideox") {
      try {
        setIsGenerating(true);
        
        const validMasks = segmentedMasks.filter(mask => mask.id && mask.id.trim() !== '');
          
        const trajectories = validMasks.map(mask => mask.trajectory?.points || []);
        const rotations = validMasks.map(mask => mask.rotation || 0);
        
        // Upload the workbench image to UploadThing
        let workbenchImageUrl = "";
        if (editor.workspaceURL) {
          const workbenchFile = await dataUrlToFile(editor.workspaceURL, "workspace.png");
          workbenchImageUrl = await uploadToUploadThingResidual(workbenchFile);
        } else {
          throw new Error("No workbench image available");
        }
        
        // Upload all mask images to UploadThing
        const maskUploadPromises = validMasks.map(async (mask, index) => {
          if (!mask.binaryUrl) return "";
          
          const maskFile = await dataUrlToFile(mask.binaryUrl, `mask-${index}.png`);
          return uploadToUploadThingResidual(maskFile);
        });
        
        const uploadedMaskUrls = await Promise.all(maskUploadPromises);
        
        // Now construct the videoGenData with the uploaded URLs
        const videoGenData = {
          "input_image": JSON.stringify([workbenchImageUrl]),
          "input_masks": JSON.stringify(uploadedMaskUrls),
          "input_prompt": generalTextPrompt,
          "input_trajectories": JSON.stringify(trajectories),
          "input_rotations": JSON.stringify(rotations)
        };
        
        console.log("videoGenData", videoGenData);

        // STEP 1: Call ComfyDeploy to start the generation
        const response = await fetch("/api/comfydeploy/generate-video", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(videoGenData),
        });
        
        const data = await response.json();
        
        if (data.runId) {
          // STEP 2: Store the generation information in our database
          const dbResponse = await fetch("/api/video-generations", {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: projectId,
              workbenchId: workbenchId,
              runId: data.runId,
              status: "pending",
              modelId: modelId,
            }),
          });
          
          const dbData = await dbResponse.json();
          
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
    } else if (modelId === "hunyuanvideo") {
      console.log("HunyuanVideo model selected, but not implemented yet");
    } else {
      console.log("Model not yet implemented");
    } 
  }

  function handleDecodingResults(decodingResults: { 
    masks: { dims: number[]; }; 
    iou_predictions: { cpuData: number[]; }; 
  }) {
    
    // SAM2 returns 3 mask along with scores -> select best one
    const maskTensors = decodingResults.masks;
    const [bs, noMasks, width, height] = maskTensors.dims;
    const maskScores = decodingResults.iou_predictions.cpuData;
    const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
    const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx)
    let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
    let bestMaskBinary = float32ArrayToBinaryMask(bestMaskArray, width, height)

    bestMaskCanvas = resizeCanvas(bestMaskCanvas, { w: 720, h: 480 });
    bestMaskBinary = resizeCanvas(bestMaskBinary, { w: 720, h: 480 });
    setMask(bestMaskCanvas);
    setMaskBinary(bestMaskBinary);
    setPrevMaskArray(bestMaskArray);

    // We have direct access to activeWorkbenchTool and editor within the workbench component

    
    // Add mask to canvas if in animate mode
    if (activeWorkbenchTool === "animate" && editor?.canvas) {
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get workspace dimensions with type assertion since we know these are fabric.Object properties
      const workspaceWidth = (workspace as fabric.Object).width as number || 720;
      const workspaceHeight = (workspace as fabric.Object).height as number || 480;

      // Create a temporary canvas to properly scale the mask
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = workspaceWidth;  // Original workspace width
      tempCanvas.height = workspaceHeight; // Original workspace height
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) return;

      // Draw the mask centered and scaled
      tempCtx.drawImage(
        bestMaskCanvas,
        0,
        0,
        bestMaskCanvas.width,
        bestMaskCanvas.height,
      );

      // Convert the properly scaled mask canvas to a Fabric image
      fabric.Image.fromURL(tempCanvas.toDataURL(), (maskImage) => {
        // Position the mask at the workspace coordinates
        maskImage.set({
          left: workspace.left || 0,
          top: workspace.top || 0,
          width: workspaceWidth,  // Original workspace width
          height: workspaceHeight, // Original workspace height
          selectable: false,
          evented: false,
          opacity: 0.9,
        });

        // Remove any existing mask before adding the new one
        const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
        existingMasks.forEach(mask => editor.canvas.remove(mask));

        // Add metadata to identify this as a mask
        maskImage.data = { isMask: true };
        
        editor.canvas.add(maskImage);
        editor.canvas.renderAll();
      });
    }
  }

  const handleWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, data } = event.data;

    if (type === "decodeMaskResult" && isActive) {
      // Only process mask results if this workbench is active
      handleDecodingResults(data);
    }
  }, [isActive, activeWorkbenchTool, editor, setMask, setMaskBinary, setPrevMaskArray]);

  useEffect(() => {
    if (isActive && samWorker.current) {
      // Only add listener when workbench is active
      samWorker.current.addEventListener("message", handleWorkerMessage);
      
      return () => {
        if (samWorker.current) {
          samWorker.current.removeEventListener("message", handleWorkerMessage);
        }
      };
    }
  }, [isActive, samWorker, handleWorkerMessage]);

  // Add this function to handle encoding the workbench image
  const encodeWorkbenchImage = useCallback(async () => {
    if (!samWorker.current || !editor?.canvas) return;
    
    const workspace = editor?.getWorkspace();
    if (!workspace) return;

    // Get the workspace dimensions and position
    const workspaceWidth = workspace.width || 720;
    const workspaceHeight = workspace.height || 480;
    const workspaceLeft = workspace.left || 0;
    const workspaceTop = workspace.top || 0;
    
    // Create a temporary canvas with the workspace content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = workspaceWidth;
    tempCanvas.height = workspaceHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Save current viewport transform and ensure it's not undefined
    const currentViewportTransform = editor.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    
    // Reset viewport transform temporarily to get accurate image
    editor.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    // Draw the workspace content onto the temp canvas
    const workspaceImage = editor.canvas.toDataURL({
      format: 'png',  
      quality: 1,
      left: workspaceLeft,
      top: workspaceTop,
      width: workspaceWidth,
      height: workspaceHeight
    });

    editor.setWorkspaceURL(workspaceImage);

    // Restore viewport transform
    editor.canvas.setViewportTransform(currentViewportTransform);

    const img = new Image();
    img.onload = () => {
      const imageSize = { w: 1024, h: 1024 }; // Add this constant or make it a state/prop
      const largestDim = Math.max(workspaceWidth, workspaceHeight);

      const box = resizeAndPadBox(
        { h: workspaceHeight, w: workspaceWidth },
        { h: largestDim, w: largestDim }
      );
      
      tempCtx?.drawImage(img, 0, 0, 720, 480, box?.x || 0, 0, box?.w, box?.h);
    
      samWorker.current?.postMessage({
        type: "encodeImage",
        data: canvasToFloat32Array(resizeCanvas(tempCanvas, imageSize)),
      });
    };

    img.src = workspaceImage;
  }, [editor, samWorker]);

    // Notify parent component ONLY when this workbench BECOMES active,
  // not on every editor change
  useEffect(() => {
    // Only call onActive when the workbench becomes active and has an editor
    if (editor && isActive) {
      // Use a ref to track if we've already notified for this active state
      if (!isActiveNotifiedRef.current) {
        onActive(editor, index);
        isActiveNotifiedRef.current = true;
        
        // Encode the current workbench image when it becomes active
        // This ensures the SAM worker has the correct image for the currently visible workbench
        if (samWorker.current && editor.canvas) {
          encodeWorkbenchImage();
        }
      }
    } else {
      // Reset the flag when the workbench becomes inactive
      isActiveNotifiedRef.current = false;
    }
  }, [isActive, editor, index, onActive, encodeWorkbenchImage, samWorker]);
  
  // Add this effect to handle canvas changes
  useEffect(() => {
    if (editor?.canvas && activeTool !== "segment" && isActive) {
      // Create a debounced version of the canvas change handler
      const debouncedHandleCanvasChange = debounce(() => {
        encodeWorkbenchImage();
      }, 500);
      
      // Add event listeners for all object changes
      editor.canvas.on('object:added', debouncedHandleCanvasChange);
      editor.canvas.on('object:modified', debouncedHandleCanvasChange);
      editor.canvas.on('object:removed', debouncedHandleCanvasChange);
      
      // Cleanup all listeners and cancel any pending debounced calls
      return () => {
        editor.canvas.off('object:added', debouncedHandleCanvasChange);
        editor.canvas.off('object:modified', debouncedHandleCanvasChange);
        editor.canvas.off('object:removed', debouncedHandleCanvasChange);
        debouncedHandleCanvasChange.cancel(); // Important: cancel any pending executions
      };
    }
  }, [editor?.canvas, activeTool, isActive, encodeWorkbenchImage]);

  // When models or other sidebar data changes, sync with the editor state

  // TODO: This is not working, need to fix it
  // useEffect(() => {
  //   if (editor && selectedModel) {
  //     editor.setSelectedModelId(selectedModel.id);
  //   }
  // }, [editor, selectedModel]);

  return (
    <div className="grid h-full" style={{
      gridTemplateColumns: activeWorkbenchTool !== "select" 
        ? "minmax(0, 1fr) 350px 100px" 
        : "minmax(0, 1fr) 0px 100px",
      transition: "grid-template-columns 0s ease-in-out" // TODO: Figure out how to not make canvas flicker when adding a non-zero transition.
    }}>

      {/* Left column - canvas area */}
      <div className="flex flex-col h-full overflow-hidden">
        <div 
          ref={containerRef}
          className={cn("modern-canvas relative flex-shrink-0 h-full shadow-soft overflow-hidden")}
          style={{
            scrollSnapAlign: "start",
            opacity: isActive ? 1 : 0.98,
            // background: `radial-gradient(circle at center, rgba(128, 128, 128, 0.15) 0%, rgba(128, 128, 128, 0.03) 0%)`,
            // background: `radial-gradient(ellipse closest-side at 50% 50%, #ffffff 0%, #e0e0e0 100%  )`,
          }}
          onClick={handleContainerClick}
        >
          <canvas 
            ref={canvasRef} 
            className={cn(
              activeTool === "segment" ? "cursor-crosshair" : "cursor-default"
            )}
          />
          {/* workbench number indicator */}
          <div className="absolute top-2 left-2 flex items-center space-x-2">
            <div className="bg-blue-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {index + 1}
            </div>

            <button
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 px-1 rounded-full transition-colors duration-200"
              title="Delete workbench"
              disabled={!canDelete}
              style={{
                opacity: canDelete ? 1 : 0.5,
                cursor: canDelete ? 'pointer' : 'not-allowed'
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute bottom-2 left-2 flex items-center space-x-2">
            <button 
              className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-2 rounded-full transition-colors duration-200 flex items-center"
              onClick={() => {
                // TODO: Implement import previous last frame
              }}
              disabled={!canImportPreviousLastFrame}
            >
              <CornerUpRight className="h-4 w-4 mr-1" />
              Import Previous Last Frame
            </button>
          </div>
        </div>
      </div>

      {/* Middle sidebar content column - with overflow hidden */}
      <div className="h-full overflow-hidden">
        <div className="h-full w-[350px]"> {/* Fixed width container */}
          <AnimateRightSidebar 
            editor={editor}
            activeWorkbenchTool={activeWorkbenchTool}
            onChangeActiveWorkbenchTool={setActiveWorkbenchTool}
            segmentedMasks={segmentedMasks}
            setSegmentedMasks={setSegmentedMasks}
            samWorker={samWorker}
            samWorkerLoading={samWorkerLoading}
            prevMaskArray={prevMaskArray}
            setPrevMaskArray={setPrevMaskArray}
            mask={mask}
            setMask={setMask}
            maskBinary={maskBinary}
            setMaskBinary={setMaskBinary}
          />
          <CameraControlRightSidebar 
            editor={editor}
            activeWorkbenchTool={activeWorkbenchTool}
            onChangeActiveWorkbenchTool={setActiveWorkbenchTool}
            cameraControl={cameraControl}
            setCameraControl={setCameraControl}
          />
          <TextPromptRightSidebar
            activeWorkbenchTool={activeWorkbenchTool}
            onChangeActiveWorkbenchTool={setActiveWorkbenchTool}
            generalTextPrompt={generalTextPrompt}
            onGeneralTextPromptChange={setGeneralTextPrompt}
          />
          <ModelRightSidebar
            editor={editor}
            activeWorkbenchTool={activeWorkbenchTool}
            onChangeActiveWorkbenchTool={setActiveWorkbenchTool}
            selectedModel={selectedModel}
            onSelectModel={(model: BaseVideoModel) => setSelectedModel(model)}
          />
        </div>
      </div>

      {/* Right buttons column - fixed width */}
      <div className="flex flex-col w-[100px] h-full">
        <aside className="modern-right-sidebar flex flex-col py-3 px-2 border-l h-full justify-between">
          <ul className="flex flex-col space-y-2">
            <RightSidebarItem
              icon={ArrowRightCircle}
              label="Animate"
              isActive={activeWorkbenchTool === "animate"}
              onClick={() => setActiveWorkbenchTool("animate")}
            />
            <RightSidebarItem
              icon={Video}
              label="Camera"
              isActive={activeWorkbenchTool === "camera-control"}
              onClick={() => setActiveWorkbenchTool("camera-control")}
            />
            <RightSidebarItem
              icon={MessageSquare}
              label="Prompt"
              isActive={activeWorkbenchTool === "prompt"}
              onClick={() => setActiveWorkbenchTool("prompt")}
            />
            <RightSidebarItem
              icon={Film}
              label="Model"
              isActive={activeWorkbenchTool === "model"}
              onClick={() => setActiveWorkbenchTool("model")}
            />
          </ul>
          
          {/* Generate Video Submit Button */}
          <div className="mt-auto">
            <button 
              className="w-full aspect-square bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 flex flex-col items-center justify-center gap-1 px-2 py-1"
              onClick={() => handleGenerateVideo(selectedModel.id)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Sending request...</span>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <ArrowRightSquare className="h-6 w-6" />
                  <span className="text-xs font-medium mt-1">Submit</span>
                  <span className="text-xs text-blue-200/80 mt-0.5">CogVideoX</span>
                </div>
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}; 