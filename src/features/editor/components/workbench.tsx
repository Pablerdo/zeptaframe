"use client";

import { fabric } from "fabric";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MessageSquare, Trash2, Video, Film, ArrowRightSquare, ArrowRightCircle, Loader2, CornerUpRight, ChevronDown, X } from "lucide-react";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { ActiveSegmentationTool, ActiveTool, ActiveWorkbenchTool, BaseVideoModel, CameraControl, Editor as EditorType, JSON_KEYS, SegmentedMask, SupportedVideoModelId, VideoGeneration, WorkflowMode, RotationKeyframe, ScaleKeyframe } from "@/features/editor/types";
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
  getCentroid,
} from "@/app/sam/lib/imageutils";
import debounce from "lodash/debounce";
import { defaultVideoModelId, videoModels } from "../utils/video-models";
import { precisionReplacer } from "../utils/json-helpers";
import { useLastFrames } from '@/features/editor/contexts/last-frame-context';
import { toast } from "sonner";
import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "./auth-modal";
import { comfyDeployWorkflows } from "../utils/comfy-deploy-workflows";
import { Toolbar } from "./toolbar";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { generationPrices } from "@/features/subscriptions/utils";
import { videoGenUtils } from "../utils/video-gen-utils";

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
  maskCentroid: { x: number; y: number } | null;
  setMaskCentroid: (centroid: { x: number; y: number } | null) => void;
  setAllowEncodeWorkbenchImage: (allowEncodeWorkbenchImage: boolean) => void;
  samWorkerInitialized: boolean;
  isTrial: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
  lastEncodedWorkbenchId: string;
  setLastEncodedWorkbenchId: (lastEncodedWorkbenchId: string) => void;
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
  maskCentroid,
  setMaskCentroid,
  setAllowEncodeWorkbenchImage,
  samWorkerInitialized,
  isTrial,
  setShowAuthModal,
  lastEncodedWorkbenchId,
  setLastEncodedWorkbenchId,
}: WorkbenchProps) => {
  // Create refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const isActiveNotifiedRef = useRef(false);
  const [activeWorkbenchTool, setActiveWorkbenchTool] = useState<ActiveWorkbenchTool>("select");
  const [isGenerating, setIsGenerating] = useState(false);
  // Add flag to track workbench encoding status
  const [isCurrentWorkbenchEncoded, setIsCurrentWorkbenchEncoded] = useState(false);
  
  // Use the user status context
  const { userStatus, hasEnoughCredits, deductCredits } = useUserStatus();
  
  // New state - promptData elements owned by workbench
  const [generalTextPrompt, setGeneralTextPrompt] = useState<string>("");
  const [segmentedMasks, setSegmentedMasks] = useState<SegmentedMask[]>([]);
  const [selectedModel, setSelectedModel] = useState<BaseVideoModel>(videoModels[defaultVideoModelId]);
  const [cameraControl, setCameraControl] = useState<CameraControl>({
    horizontalTruck: 0,
    verticalTruck: 0,
    dolly: 0,
    horizontalPan: 0,
    verticalPan: 0,
  });

  const [activeSegmentationTool, setActiveSegmentationTool] = useState<ActiveSegmentationTool>("none");

  
  const { lastFrameGenerations, importLastFrame, setActiveEditor } = useLastFrames();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  type ComputeMode = "ultra" | "normal" | "flash" ;

  const [computeMode, setComputeMode] = useState<ComputeMode>("normal");
  const [degradation, setDegradation] = useState<number>(0.6);

  // Add state for BuyCreditsModal
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);
  
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
        editor.disableDrawingMode();
        editor.disableCropMode();
        if (activeSegmentationTool === "manual") {
          editor.enableSegmentationMode(true);
        } else {
          editor.enableSegmentationMode(false);
        }
      } else if (activeTool === "crop") {
        editor.disableDrawingMode();
        editor.disableSegmentationMode();
        editor.enableCropMode();
      } else { 
        editor.disableDrawingMode();
        editor.disableSegmentationMode();
        editor.disableCropMode();

        editor.canvas.selection = true;
        editor.canvas.forEachObject((obj: fabric.Object) => {
          obj.selectable = true;
          obj.evented = true;
        });
      }
    }
  }, [isActive, activeTool, activeSegmentationTool, editor, activeWorkbenchTool, onChangeActiveTool]);

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

    // Check permissions based on user status
    if (!userStatus.isAuthenticated) {
      // Show authentication modal instead of redirecting
      setShowAuthModal(true);
      return;
    }

    // Check if there are any masks or a text prompt
    if (segmentedMasks.length === 0 && generalTextPrompt.trim() === "") {
      toast.error("Text prompt is required for video generation");
      return;
    }

    // Check if text prompt is required but missing
    // Check if user has enough credits
    const videoPrice = generationPrices.video;
    if (!hasEnoughCredits(videoPrice)) {
      // Calculate needed credits
      const needed = videoPrice - userStatus.credits;
      setRequiredCredits(needed);
      setShowBuyCreditsModal(true);
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

      switch (selectedModel.id) {
        case "cogvideox":
          workflowData.workflow_id = comfyDeployWorkflows["PROD-ZEPTA-CogVideoX"] || "";
          break;
        case "skyreels":
            workflowData.workflow_id = comfyDeployWorkflows["PROD-ZEPTA-Skyreels"] || "";
          break;
        default:
          throw new Error("Invalid model ID");
      }

      workflowData.mode = "animation" as WorkflowMode;

      const validMasks = segmentedMasks.filter(mask => mask.id && mask.id.trim() !== '');
      
      // Sort masks by z-index (lower z-index = bottom layer, higher = top layer)
      const sortedMasks = [...validMasks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      
      // Helper function to generate rotation array from keyframes
      const generateRotationTrajectory = (keyframes: RotationKeyframe[], frameCount: number): number[] => {
        if (keyframes.length === 0) {
          return new Array(frameCount).fill(0);
        }
        
        if (keyframes.length === 1) {
          return new Array(frameCount).fill(Math.round(keyframes[0].rotation));
        }
        
        const rotationTrajectory: number[] = [];
        
        for (let i = 0; i < frameCount; i++) {
          const progress = frameCount > 1 ? i / (frameCount - 1) : 0;
          
          // Find the two keyframes to interpolate between
          let prevKeyframe = keyframes[0];
          let nextKeyframe = keyframes[keyframes.length - 1];
          
          for (let j = 0; j < keyframes.length - 1; j++) {
            if (progress >= keyframes[j].trajectoryProgress && progress <= keyframes[j + 1].trajectoryProgress) {
              prevKeyframe = keyframes[j];
              nextKeyframe = keyframes[j + 1];
              break;
            }
          }
          
          // Linear interpolation between keyframes
          if (prevKeyframe === nextKeyframe) {
            rotationTrajectory.push(Math.round(prevKeyframe.rotation));
          } else {
            const localProgress = (progress - prevKeyframe.trajectoryProgress) / 
              (nextKeyframe.trajectoryProgress - prevKeyframe.trajectoryProgress);
            const interpolatedRotation = prevKeyframe.rotation + 
              (nextKeyframe.rotation - prevKeyframe.rotation) * localProgress;
            rotationTrajectory.push(Math.round(interpolatedRotation));
          }
        }
        
        return rotationTrajectory;
      };

      // Helper function to generate scale array from keyframes
      const generateScaleTrajectory = (keyframes: ScaleKeyframe[], frameCount: number): number[] => {
        if (keyframes.length === 0) {
          return new Array(frameCount).fill(1.0);
        }
        
        if (keyframes.length === 1) {
          return new Array(frameCount).fill(Math.round(keyframes[0].scale * 100) / 100);
        }
        
        const scaleTrajectory: number[] = [];
        
        for (let i = 0; i < frameCount; i++) {
          const progress = frameCount > 1 ? i / (frameCount - 1) : 0;
          
          // Find the two keyframes to interpolate between
          let prevKeyframe = keyframes[0];
          let nextKeyframe = keyframes[keyframes.length - 1];
          
          for (let j = 0; j < keyframes.length - 1; j++) {
            if (progress >= keyframes[j].trajectoryProgress && progress <= keyframes[j + 1].trajectoryProgress) {
              prevKeyframe = keyframes[j];
              nextKeyframe = keyframes[j + 1];
              break;
            }
          }
          
          // Linear interpolation between keyframes
          if (prevKeyframe === nextKeyframe) {
            scaleTrajectory.push(Math.round(prevKeyframe.scale * 100) / 100);
          } else {
            const localProgress = (progress - prevKeyframe.trajectoryProgress) / 
              (nextKeyframe.trajectoryProgress - prevKeyframe.trajectoryProgress);
            const interpolatedScale = prevKeyframe.scale + 
              (nextKeyframe.scale - prevKeyframe.scale) * localProgress;
            scaleTrajectory.push(Math.round(interpolatedScale * 100) / 100);
          }
        }
        
        return scaleTrajectory;
      };
      
      const trajectories = sortedMasks.map(mask => mask.trajectory?.points || []);

      // Generate frame-by-frame rotation and scale arrays from keyframes
      const rotations = sortedMasks.map(mask => {
        if (mask.rotationKeyframes && mask.rotationKeyframes.length > 0) {
          return generateRotationTrajectory(mask.rotationKeyframes, videoGenUtils.totalFrames);
        } else {
          // Fallback to single value if no keyframes (rounded to integer)
          return new Array(videoGenUtils.totalFrames).fill(0);
        }
      });
      // Generate frame-by-frame rotation and scale arrays from keyframes
      const scalings = sortedMasks.map(mask => {
        if (mask.scaleKeyframes && mask.scaleKeyframes.length > 0) {
          return generateScaleTrajectory(mask.scaleKeyframes, videoGenUtils.totalFrames);
        } else {
          // Fallback to single value if no keyframes (rounded to 2 decimal places)
          return new Array(videoGenUtils.totalFrames).fill(1.00);
        }
      });
      
      // Generate centroids array - each mask gets its centroid repeated for all frames
      const centroids = sortedMasks.map(mask => {
        const centroid = mask.centroid || { x: 480, y: 320 }; // Default to center if no centroid
        return new Array(videoGenUtils.totalFrames).fill(centroid);
      });
      
      // Upload all mask images to UploadThing
      const maskUploadPromises = sortedMasks.map(async (mask, index) => {
        if (!mask.binaryUrl) return "";
        
        const maskFile = await dataUrlToFile(mask.binaryUrl, `mask-${index}.png`);
        return uploadToUploadThingResidual(maskFile);
      });
      
      const uploadedMaskUrls = await Promise.all(maskUploadPromises);

      const truckVector = {"x": -cameraControl.horizontalTruck, "y": cameraControl.verticalTruck};
      const panVector = {"x": cameraControl.horizontalPan, "y": cameraControl.verticalPan};
      const dolly = cameraControl.dolly;

      const cameraControlPayload = {
        "truck_vector": truckVector,
        "pan_vector": panVector,
        "zoom_vector": dolly,
      }

      // TODO: Add pan vector and dolly to the input camera. In the ComfyUI-SubjectBackgroundMotion.

      // GOOD TUNING VALUES
      // const boundaryDegradation = 0.75;
      // const secondaryBoundaryDegradation = 0.7;
      // const degradation = 0.50;

      // Further trials
      const boundaryDegradation = 0.9;
      const annulusDegradation = 0.8;

      const boundaryPx1 = 30;
      const boundaryPx2 = 50;

      // Replace hardcoded value with state variable
      // const degradation = 0.6;

      // TODO: Pass number of steps for sampler, as well as resolution, depending on compute mode.

      const videoGenData = {
        "input_num_frames": JSON.stringify(videoGenUtils.totalFrames),
        "input_image": JSON.stringify([workbenchImageUrl]),
        "input_masks": JSON.stringify(uploadedMaskUrls),
        "input_prompt": generalTextPrompt,
        "input_trajectories": JSON.stringify(trajectories),
        "input_rotations": JSON.stringify(rotations),
        "input_scalings": JSON.stringify(scalings),
        "input_camera": JSON.stringify(cameraControlPayload),
        // "input_boundary_degradation": JSON.stringify(boundaryDegradation),
        // "input_annulus_degradation": JSON.stringify(annulusDegradation),
        "input_degradation": JSON.stringify(degradation),
        // "input_boundary_px1": JSON.stringify(boundaryPx1),
        //"input_boundary_px2": JSON.stringify(boundaryPx2),
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
            computeMode: computeMode,
          }),
        });
        
        const dbData = await dbResponse.json();
        // ("dbData", dbData);
      } else {
        throw new Error("No video runId received");
      }
      
      
      // When successful, deduct credits
      if (computeMode === "flash") {
        deductCredits(generationPrices.flashVideoCredits);
      } else if (computeMode === "normal") {
        deductCredits(generationPrices.normalVideoCredits);
      } else if (computeMode === "ultra") {
        deductCredits(generationPrices.ultraVideoCredits);
      }
      
      toast.success("Video generation started successfully. Check timeline for progress.");
      // console.log("Video generation started. Please wait...");

    } catch (error) {
      console.error("Error:", error);
      //console.log("Error generating video");
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
    let centroid = getCentroid(bestMaskArray, width, height) as { x: number; y: number }
    
    // Resize both canvases
    bestMaskCanvas = resizeCanvas(bestMaskCanvas, { w: 960, h: 640 });
    bestMaskBinary = resizeCanvas(bestMaskBinary, { w: 960, h: 640 });
    
    // Scale the centroid coordinates to match the resized canvas
    const scaleX = 960 / width;
    const scaleY = 640 / height;
    centroid = {
      x: centroid.x * scaleX,
      y: centroid.y * scaleY
    };
    
    // Optional: apply morpohological closing and slight blur for better ui
    bestMaskCanvas = enhanceMaskEdges(bestMaskCanvas, 6, 0); // Reduced blur radius

    setMask(bestMaskCanvas);
    setMaskBinary(bestMaskBinary);
    setPrevMaskArray(bestMaskArray);
    setMaskCentroid(centroid);

    // We have direct access to activeWorkbenchTool and editor within the workbench component
    
    // Add mask to canvas if in animate mode
    if (activeWorkbenchTool === "animate" && editor?.canvas) {
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get workspace dimensions with type assertion since we know these are fabric.Object properties
      const workspaceWidth = (workspace as fabric.Object).width as number || 960;
      const workspaceHeight = (workspace as fabric.Object).height as number || 640;

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
    } else if (type === "encodeImageDone" && isActive) {
      // When encoding is done, mark this workbench as encoded
      setIsCurrentWorkbenchEncoded(true);
      setSamWorkerLoading(false);
    }
  }, [isActive, activeWorkbenchTool, editor, setMask, setMaskBinary, setPrevMaskArray, setIsCurrentWorkbenchEncoded, setSamWorkerLoading]);

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
    const workspaceWidth = workspace.width || 960;
    const workspaceHeight = workspace.height || 640;
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
      
      tempCtx?.drawImage(img, 0, 0, 960, 640, box?.x || 0, 0, box?.w, box?.h);
    
      samWorker.current?.postMessage({
        type: "encodeImage",
        data: canvasToFloat32Array(resizeCanvas(tempCanvas, imageSize)),
      });
      
      // Set the encoded workbench ID
      setLastEncodedWorkbenchId(workbenchId);
      // Mark current workbench as encoded
      setIsCurrentWorkbenchEncoded(true);
    };

    img.src = workspaceImage;
  }, [editor, samWorker, workbenchId, setLastEncodedWorkbenchId]);

  
  // Set up canvas change listeners to mark workbench as not encoded
  useEffect(() => {
    if (editor?.canvas) {
      const handleCanvasChange = () => {
        // console.log("/////------Canvas changed------/////");
        setIsCurrentWorkbenchEncoded(false);
      };
      
      // Add event listeners for all object changes
      editor.canvas.on('object:added', handleCanvasChange);
      editor.canvas.on('object:modified', handleCanvasChange);
      editor.canvas.on('object:removed', handleCanvasChange);

      // Add event listener for text changes
      editor.canvas.on('text:editing:started', handleCanvasChange);
      editor.canvas.on('text:changed', handleCanvasChange);
      
      // Cleanup listeners
      return () => {
        editor.canvas.off('object:added', handleCanvasChange);
        editor.canvas.off('object:modified', handleCanvasChange);
        editor.canvas.off('object:removed', handleCanvasChange);
        editor.canvas.off('text:editing:started', handleCanvasChange);
        editor.canvas.off('text:changed', handleCanvasChange);
      };
    }
  }, [editor, editor?.canvas, isActive]);

  // We don't need the debounced function reference anymore since we're using a direct interval
  useEffect(() => {
    // Only encode the image when:
    // 1. We have an active editor
    // 2. We're NOT in animation mode OR this is the first time encoding this workbench
    // 3. SAM worker is initialized
    // 4. This workbench is active
    // 5. SAM worker is not currently loading
    // 6. The workbench is not currently encoded OR it's the first time encoding this workbench
    if (
      editor?.canvas && 
      (activeWorkbenchTool !== "animate" || lastEncodedWorkbenchId !== workbenchId) && 
      samWorkerInitialized && 
      isActive && 
      !samWorkerLoading &&
      (!isCurrentWorkbenchEncoded || lastEncodedWorkbenchId !== workbenchId)
    ) {
      // console.log("Setting up periodic encoding for workbench");
      
      // Run encoding immediately when effect initializes
      encodeWorkbenchImage();
      
      // Set up interval to encode every two seconds - but only when needed
      const encodingInterval = setInterval(() => {
        if (!isCurrentWorkbenchEncoded) {
          encodeWorkbenchImage();
          // console.log("/////------Encoding workbench image------/////");
        }
      }, 2000);
      
      // Clean up function to clear the interval when component unmounts or dependencies change
      return () => {
        // console.log("Cleaning up encoding interval");
        clearInterval(encodingInterval);
      };
    }
  }, [
    editor?.canvas, 
    activeWorkbenchTool, 
    samWorkerInitialized, 
    isActive, 
    lastEncodedWorkbenchId, 
    isCurrentWorkbenchEncoded, 
    samWorkerLoading, 
    workbenchId
  ]); // Added isCurrentWorkbenchEncoded to dependencies

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

  // Reset the encoded state when the workbench becomes active
  useEffect(() => {
    if (isActive) {
      setIsCurrentWorkbenchEncoded(false);
    }
  }, [isActive]);

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

  return (
    <div className="flex flex-col h-full"> 
      <Toolbar
        editor={editor}
        activeTool={activeTool}
        onChangeActiveTool={onChangeActiveTool}
      />
      <div className="grid h-full overflow-hidden" style={{
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
              {/* <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div> */}

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
        <div className="h-full overflow-hidden min-h-0">
          <div className="h-full w-[300px]"> {/* Fixed width container */}
            <AnimateRightSidebar 
              editor={editor}
              activeWorkbenchTool={activeWorkbenchTool}
              activeSegmentationTool={activeSegmentationTool}
              setActiveSegmentationTool={setActiveSegmentationTool}
              onChangeActiveWorkbenchTool={setActiveWorkbenchTool}
              onChangeActiveTool={onChangeActiveTool}
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
              maskCentroid={maskCentroid}
              setMaskCentroid={setMaskCentroid}
              degradation={degradation}
              setDegradation={setDegradation}
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
                label="Animation"
                isActive={activeWorkbenchTool === "animate"}
                onClick={() => {
                  setActiveWorkbenchTool("animate");
                  onChangeActiveTool("segment");
                }}
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
              {/* Compute Mode Toggle */}
              <div className={`mt-auto opacity-50`}>
                <div className="flex flex-col w-full overflow-hidden mb-2">
                  <button 
                    className={`py-2 font-medium text-sm rounded-t-md w-full transition-colors duration-200 ${
                      computeMode === "ultra" ? 'bg-blue-600/80 text-white/80' : 'bg-gray-700/80 text-gray-300/80'
                    }`}
                    onClick={() => setComputeMode("ultra")}
                    disabled
                  >
                    Ultra
                  </button>
                  <button
                    className={`py-2 font-medium text-sm text-center w-full transition-colors duration-200 ${
                      computeMode === "normal" ? 'bg-blue-600/80 text-white/80' : 'bg-gray-700/80 text-gray-300/80'
                    }`}
                    onClick={() => setComputeMode("normal")}
                    disabled
                  >
                    Normal
                  </button>
                  <button
                    className={`py-2 font-medium text-sm rounded-b-md w-full transition-colors duration-200 ${
                      computeMode === "flash" ? 'bg-blue-600/80 text-white/80' : 'bg-gray-700/80 text-gray-300/80'
                    }`}
                    onClick={() => setComputeMode("flash")}
                    disabled
                  >
                    Flash
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
                    <span className="text-[8px] text-blue-200/80 mt-0.5">{selectedModel.name}</span>
                  </div>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        isOpen={showBuyCreditsModal}
        onClose={() => setShowBuyCreditsModal(false)}
        requiredCredits={requiredCredits}
        actionLabel="generate a video"
        projectId={projectId}
      />
    </div>
  );
}; 