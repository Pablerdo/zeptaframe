"use client";

import { fabric } from "fabric";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MessageSquare, Trash2, Video, Film, ArrowRightSquare, ArrowRightCircle, Loader2, CornerUpRight, ChevronDown, X } from "lucide-react";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { ActiveTool, ActiveWorkbenchTool, BaseVideoModel, Editor as EditorType, JSON_KEYS, SegmentedMask, SupportedVideoModelId, VideoGeneration, WorkflowMode } from "@/features/editor/types";
import { cn } from "@/lib/utils";
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
  resizeAndPadBox,
  enhanceMaskEdges,
} from "@/app/sam/lib/imageutils";
import debounce from "lodash/debounce";
import { defaultVideoModelId, videoModels } from "../utils/video-models";
import { precisionReplacer } from "../utils/json-helpers";
import { useLastFrames } from '@/features/editor/contexts/last-frame-context';
import { toast } from "sonner";
import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "./auth-modal";
import { comfyDeployWorkflows } from "../utils/comfy-deploy-workflows";

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
  setSamWorkerLoading: (samWorkerLoading: boolean) => void;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
  setAllowEncodeWorkbenchImage: (allowEncodeWorkbenchImage: boolean) => void;
  samWorkerInitialized: boolean;
  isTrial: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
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
  onChangeActiveTool,
  activeTool,
  onDelete,
  canDelete,
  samWorker,
  samWorkerLoading,
  setSamWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
  setAllowEncodeWorkbenchImage,
  samWorkerInitialized,
  isTrial,
  setShowAuthModal,
}: WorkbenchProps) => {
  // Create refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const isActiveNotifiedRef = useRef(false);
  const [activeWorkbenchTool, setActiveWorkbenchTool] = useState<ActiveWorkbenchTool>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<"info" | "payment">("info");
  const [paymentOption, setPaymentOption] = useState<"monthly" | "yearly">("monthly");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [textOnlyMode, setTextOnlyMode] = useState(false);
  
  // Use the user status context
  const { userStatus, canGenerateVideo, incrementVideoUsage } = useUserStatus();
  
  // New state - promptData elements owned by workbench
  const [generalTextPrompt, setGeneralTextPrompt] = useState<string>("");
  const [segmentedMasks, setSegmentedMasks] = useState<SegmentedMask[]>([]);
  const [selectedModel, setSelectedModel] = useState<BaseVideoModel>(videoModels[defaultVideoModelId]);
  const [cameraControl, setCameraControl] = useState<Record<string, any>>({});

  
  const { lastFrameGenerations, importLastFrame, setActiveEditor } = useLastFrames();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from defaultPromptData if available
  useEffect(() => {
    if (typeof defaultPromptData === 'string') {
      try {
        const parsed = JSON.parse(defaultPromptData);
        if (parsed) {
          // console.log("parsed", parsed);
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
  }, []);

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

    // Check if text prompt is required but missing
    if (textOnlyMode && generalTextPrompt.trim() === "") {
      toast.error("Text prompt is required for Text-only generation");
      return;
    }

    // Check permissions based on user status
    if (!userStatus.isAuthenticated) {
      // Show authentication modal instead of redirecting
      setShowAuthModal(true);
      return;
    }
    
    // Check usage limits for free users
    if (!canGenerateVideo()) {
      // Show usage limit modal
      setShowUsageLimitModal(true);
      return;
    }

    try {
      setIsGenerating(true);
      
      // Upload the workbench image to UploadThing
      let workbenchImageUrl = "";
      if (editor.workspaceURL) {
        const workbenchFile = await dataUrlToFile(editor.workspaceURL, "workspace.png");
        workbenchImageUrl = await uploadToUploadThingResidual(workbenchFile);
      } else {
        throw new Error("No workbench image available");
      }


      const workflowData = {
        "mode": "",
        "workflow_id": "",
      }

      if (textOnlyMode) {
        if (selectedModel.id === "cogvideox") {
          workflowData.workflow_id = "";
        } else if (selectedModel.id === "hunyuanvideo") {
          workflowData.workflow_id = "";
        } else if (selectedModel.id === "skyreels") {
          workflowData.workflow_id = comfyDeployWorkflows["NOGWF-ZEPTA-SkyReels"] || "";
        }
        workflowData.mode = "text-only" as WorkflowMode;

        const videoGenData = {
          "input_image": JSON.stringify([workbenchImageUrl]),
          "input_prompt": generalTextPrompt,
        };
        
        console.log("videoGenData", videoGenData);
        
        const comfyDeployData = {
          workflowData,
          videoGenData
        }

        // STEP 1: Call ComfyDeploy to start the generation
        const response = await fetch("/api/comfydeploy/generate-video", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(comfyDeployData),
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
        } else {
            throw new Error("No video runId received");
        }
      } else {
        if (selectedModel.id === "cogvideox") {
          workflowData.workflow_id = comfyDeployWorkflows["GWF-ZEPTA-CogVideoX"];
        } else if (selectedModel.id === "hunyuanvideo") {
          workflowData.workflow_id = comfyDeployWorkflows["GWF-ZEPTA-HunyuanVideo"] || "";
        } else if (selectedModel.id === "skyreels") {
          workflowData.workflow_id = comfyDeployWorkflows["GWF-ZEPTA-SkyReels"] || "";
        } 

        const validMasks = segmentedMasks.filter(mask => mask.id && mask.id.trim() !== '');
        
        const trajectories = validMasks.map(mask => mask.trajectory?.points || []);
        const rotations = validMasks.map(mask => mask.rotation || 0);
        
        // Upload all mask images to UploadThing
        const maskUploadPromises = validMasks.map(async (mask, index) => {
          if (!mask.binaryUrl) return "";
          
          const maskFile = await dataUrlToFile(mask.binaryUrl, `mask-${index}.png`);
          return uploadToUploadThingResidual(maskFile);
        });
        
        const uploadedMaskUrls = await Promise.all(maskUploadPromises);
        
        const videoGenData = {
          "input_image": JSON.stringify([workbenchImageUrl]),
          "input_masks": JSON.stringify(uploadedMaskUrls),
          "input_prompt": generalTextPrompt,
          "input_trajectories": JSON.stringify(trajectories),
          "input_rotations": JSON.stringify(rotations)
        };
        
        console.log("videoGenData", videoGenData);
        workflowData.mode = "animation" as WorkflowMode;

        const comfyDeployData = {
          workflowData,
          videoGenData
        }
  
        // STEP 1: Call ComfyDeploy to start the generation
        const response = await fetch("/api/comfydeploy/generate-video", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(comfyDeployData),
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
          console.log("dbData", dbData);
        } else {
          throw new Error("No video runId received");
        }
      }

      // Increment usage counter

      // TODO: Uncomment this when we have a way to increment the usage counter
      // incrementVideoUsage();
      
      toast.success("Video generation started successfully. Check timeline for progress.");
      console.log("Video generation started. Please wait...");

    } catch (error) {
      console.error("Error:", error);
      console.log("Error generating video");
      toast.error("Error generating video. Please try again.");
    } finally {
      setIsGenerating(false);
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
    
    // Create initial mask canvases
    let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
    let bestMaskBinary = float32ArrayToBinaryMask(bestMaskArray, width, height)

    // Resize both canvases
    bestMaskCanvas = resizeCanvas(bestMaskCanvas, { w: 720, h: 480 });
    bestMaskBinary = resizeCanvas(bestMaskBinary, { w: 720, h: 480 });
    
    // Optional: apply morpohological closing and slight blur for better ui
    bestMaskCanvas = enhanceMaskEdges(bestMaskCanvas, 3, 0); // Reduced blur radius
    
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
          opacity: 0.95,
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

    setSamWorkerLoading(true);
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
      }
    } else {
      // Reset the flag when the workbench becomes inactive
      isActiveNotifiedRef.current = false;
    }
  }, [isActive, editor, index, onActive, encodeWorkbenchImage, samWorker]);

  // TODO: Review this function, ideally it would have event listeners ,but they were not working.

  // We don't need the debounced function reference anymore since we're using a direct interval
  useEffect(() => {
    if (editor?.canvas && activeWorkbenchTool !== "animate" && samWorkerInitialized && isActive && !samWorkerLoading) {
      console.log("Setting up periodic encoding for workbench");
      
      // Run encoding immediately when effect initializes
      encodeWorkbenchImage();
      
      // Set up interval to encode every second
      const encodingInterval = setInterval(() => {
        encodeWorkbenchImage();
        console.log("/////------Encoding workbench image------/////");
      }, 2000);
      
      // Clean up function to clear the interval when component unmounts or dependencies change
      return () => {
        console.log("Cleaning up encoding interval");
        clearInterval(encodingInterval);
      };
    }
  }, [editor?.canvas, activeWorkbenchTool, samWorkerInitialized, isActive]);

  // When this workbench becomes active, set its editor as the active editor in context
  useEffect(() => {
    if (isActive && editor) {
      setActiveEditor(editor);
    }
  }, [isActive, editor, setActiveEditor]);

  // Group last frames by workbench for display in dropdown
  const groupedLastFrames = useMemo(() => {
    const grouped: Record<string, VideoGeneration[]> = {};
    
    lastFrameGenerations.forEach(gen => {
      if (!grouped[gen.workbenchId]) {
        grouped[gen.workbenchId] = [];
      }
      grouped[gen.workbenchId].push(gen);
    });
    
    return grouped;
  }, [lastFrameGenerations]);

  // Function to handle upgrade
  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUpgrading(true);
      
      // Here you would implement your actual payment processing logic
      // For now, we'll just redirect to a payment page with the selected option
      window.location.href = `/upgrade?plan=${paymentOption}&redirect=${encodeURIComponent(window.location.href)}`;
      
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("Failed to process upgrade. Please try again.");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <>
      <div className="grid h-full" style={{
        gridTemplateColumns: activeWorkbenchTool !== "select" 
          ? "minmax(0, 1fr) 300px 75px" 
          : "minmax(0, 1fr) 0px 75px",
        transition: "grid-template-columns 0s ease-in-out" // TODO: Figure out how to not make canvas flicker when adding a non-zero transition.
      }}>
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

            />
            {/* workbench number indicator */}
            <div className="absolute top-2 left-2 flex items-center space-x-2">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
            <div className="absolute bottom-2 left-2" ref={dropdownRef}>
              <button 
                className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-2 py-1 rounded-full transition-colors duration-200 flex items-center"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <CornerUpRight className="h-4 w-4 mr-1" />
                Import Last Frame
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* Dropdown content for importing last frames */}
              {dropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-64 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                  <div className="max-h-60 overflow-y-auto p-2">
                    {Object.keys(groupedLastFrames).length > 0 ? (
                      Object.entries(groupedLastFrames).map(([workbenchId, generations]) => (
                        <div key={workbenchId} className="mb-2">
                          <div className="text-xs font-semibold text-gray-400 mb-1 border-b border-gray-700 pb-1">
                            Workbench ({workbenchId})
                          </div>
                          <div className="space-y-1">
                            {generations.map(gen => (
                              <div 
                                key={gen.id} 
                                className="flex items-center justify-between hover:bg-gray-700 p-1 rounded-sm cursor-pointer group"
                                onClick={() => {
                                  if (gen.lastFrameUrl) {
                                    importLastFrame(gen.lastFrameUrl);
                                    setDropdownOpen(false);
                                  }
                                }}
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gray-900 rounded-sm overflow-hidden mr-2 flex-shrink-0">
                                    {gen.lastFrameUrl && (
                                      <img
                                        src={gen.lastFrameUrl}
                                        alt="Last frame thumbnail"
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-300 truncate">
                                    {new Date(gen.createdAt).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </div>
                                <button
                                  className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (gen.lastFrameUrl) {
                                      importLastFrame(gen.lastFrameUrl);
                                      setDropdownOpen(false);
                                    }
                                  }}
                                >
                                  Import
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-400 py-4">
                        No last frames available
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-700 p-2 flex justify-end">
                    <button 
                      className="text-xs text-gray-400 hover:text-gray-300"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <X className="h-3 w-3 inline mr-1" />
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle sidebar content column - with overflow hidden */}
        <div className="h-full overflow-hidden">
          <div className="h-full w-[300px]"> {/* Fixed width container */}
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
        <div className="flex flex-col w-[75px] h-full">
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
              {/* Generation Mode Selection - Vertical Toggle with Gooey Animation */}
              <div className="mb-3 relative">
                {/* Info tooltip */}
                <div className="absolute -top-8 right-1 group z-50">
                  <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center cursor-help text-xs text-blue-200 font-semibold">
                    i
                  </div>
                  <div className="absolute bottom-full mb-2 right-0 w-[60px] bg-gray-800 text-white text-xs p-2 rounded shadow-lg 
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50">
                    In Text-only mode, a text prompt is required
                  </div>
                </div>
              
                <div className="flex flex-col w-full overflow-hidden">
                  <button
                    className={`py-2 font-medium text-sm rounded-t-md w-full transition-colors duration-200 ${
                      !textOnlyMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                    onClick={() => setTextOnlyMode(false)}
                  >
                    Animation
                  </button>
                  
                  <button
                    className={`py-2 font-medium text-sm rounded-b-md w-full transition-colors duration-200 ${
                      textOnlyMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                    onClick={() => setTextOnlyMode(true)}
                  >
                    Text Only
                  </button>
                </div>
              </div>
              
              <button 
                className="w-full aspect-square bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex flex-col items-center justify-center gap-1 px-2 py-1"
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
                    <span className="text-[10px] text-blue-200/80 mt-0.5">{selectedModel.name}</span>
                  </div>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Usage Limit Modal */}
      {showUsageLimitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg w-full max-w-md p-6 animate-in fade-in duration-200">
            {upgradeStep === "info" ? (
              <>
                <h3 className="text-xl font-bold text-white mb-2">Daily Limit Reached</h3>
                <p className="text-gray-300 mb-4">
                  You&apos;ve used all {userStatus.dailyVideoGenerations.limit} of your daily video generations on the free plan.
                </p>
                <div className="bg-gray-800 rounded-md p-4 mb-4">
                  <h4 className="text-blue-300 font-medium mb-2">Upgrade to Pro for:</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li className="flex items-start">
                      <div className="bg-blue-500/20 rounded-full p-1 mr-2 mt-0.5">
                        <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>Unlimited video generations</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-500/20 rounded-full p-1 mr-2 mt-0.5">
                        <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>Higher resolution output (up to 1080p)</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-500/20 rounded-full p-1 mr-2 mt-0.5">
                        <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>Priority processing (faster generation)</span>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-500/20 rounded-full p-1 mr-2 mt-0.5">
                        <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>Exclusive models and features</span>
                    </li>
                  </ul>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowUsageLimitModal(false)}
                    className="px-4 py-2 rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setUpgradeStep("payment")}
                    className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                  >
                    Upgrade Now
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-2">Choose Your Plan</h3>
                <p className="text-gray-300 mb-4">
                  Select a subscription plan to continue generating videos without limits.
                </p>
                
                <form onSubmit={handleUpgrade} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentOption("monthly")}
                      className={`text-left border rounded-lg p-4 transition-colors ${
                        paymentOption === "monthly"
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-700 bg-gray-800 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-white">Monthly</span>
                        {paymentOption === "monthly" && (
                          <div className="bg-blue-500 rounded-full p-1">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-bold text-white">$19<span className="text-sm font-normal text-gray-400">/mo</span></div>
                      <div className="text-xs text-gray-400 mt-1">Billed monthly</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setPaymentOption("yearly")}
                      className={`text-left border rounded-lg p-4 transition-colors ${
                        paymentOption === "yearly"
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-700 bg-gray-800 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-medium text-white">Yearly</span>
                          <span className="ml-2 text-xs font-medium bg-green-900/60 text-green-400 px-2 py-0.5 rounded">SAVE 25%</span>
                        </div>
                        {paymentOption === "yearly" && (
                          <div className="bg-blue-500 rounded-full p-1">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-bold text-white">$14<span className="text-sm font-normal text-gray-400">/mo</span></div>
                      <div className="text-xs text-gray-400 mt-1">Billed annually ($168)</div>
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isUpgrading}
                    className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                  >
                    {isUpgrading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Continue to Payment"
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    You can cancel your subscription at any time.
                    By continuing, you agree to our Terms and Privacy Policy.
                  </p>
                </form>
                
                <div className="mt-4 flex justify-between">
                  <button
                    onClick={() => setUpgradeStep("info")}
                    className="text-sm text-gray-400 hover:text-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setShowUsageLimitModal(false)}
                    className="text-sm text-gray-400 hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}; 