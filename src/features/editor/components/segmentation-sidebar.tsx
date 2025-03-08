import { useRef, useEffect, useState, useCallback, Dispatch, SetStateAction } from "react";
import { fabric } from "fabric";

import {
  resizeCanvas,
  mergeMasks,
  maskImageCanvas,
  resizeAndPadBox,
  canvasToFloat32Array,
  float32ArrayToCanvas,
  sliceTensor,
  maskCanvasToFloat32Array,
  float32ArrayToBinaryMask
} from "@/app/sam/lib/imageutils";

import { 
  ActiveTool, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2, Trash2, Pencil, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { interpolatePoints, interpolatePosition, smoothTrajectory } from "@/features/editor/utils";
import { SegmentedMask } from "@/features/editor/types";

interface SegmentationSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const SegmentationSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: SegmentationSidebarProps) => {

  const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
  const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });

  const samWorker = useRef<Worker | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [imageEncoded, setImageEncoded] = useState(false);
  const [device, setDevice] = useState(null);
  const [prevMaskArray, setPrevMaskArray] = useState<Float32Array | null>(null);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [maskBinary, setMaskBinary] = useState<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Array<{ x: number; y: number; label: number }>>([]);
  const [isSegmentationActive, setIsSegmentationActive] = useState(false);
  const [recordingMotion, setRecordingMotion] = useState<string | null>(null);
  const [activeAnimations, setActiveAnimations] = useState<{[key: string]: {

    stop: () => void;
    isPlaying: boolean;
  }}>({});

  const handleDecodingResults = useCallback((decodingResults: { 
    masks: { dims: number[]; }; 
    iou_predictions: { cpuData: number[]; }; 
  }) => {

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

    // Add mask to canvas if in segment mode
    if (activeTool === "segment" && editor?.canvas) {
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
  }, [activeTool, editor, imageSize]);

  // Handle web worker messages
  const onWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, data } = event.data;

    if (type == "pong") {
      const { success, device } = data;

      if (success) {
        setLoading(false);
        setDevice(device);
        setStatus("Encode image");
      } else {
        setStatus("Error (check JS console)");
      }
    } else if (type == "downloadInProgress" || type == "loadingInProgress") {
      setLoading(true);
      setStatus("Loading model");
    } else if (type == "encodeImageDone") {
      // alert(data.durationMs)
      // console.log("Encode image done");
      setImageEncoded(true);
      setLoading(false);
      setStatus("Ready. Click on image to start new mask");
    } else if (type == "decodeMaskResult") {
      handleDecodingResults(data);
      // console.log("Decoding results");
      setLoading(false);
      setStatus("Ready. Click on image");
    }
  }, [handleDecodingResults]);

  const initializeSamWorker = useCallback(() => {
    if (!samWorker.current) {
      console.log("Initializing SAM worker");
      samWorker.current = new Worker(new URL("../../../app/sam/worker.js", import.meta.url), {
        type: "module",
      });
      samWorker.current.addEventListener("message", onWorkerMessage);
      samWorker.current.postMessage({ type: "ping" });
      console.log("Worker started");
      setLoading(true);
    }
  }, [onWorkerMessage]);

  useEffect(() => {
    if (activeTool === "segment") {
      initializeSamWorker();
    }
  }, [activeTool, initializeSamWorker]);

  // Separate effect for encoding after worker is ready
  useEffect(() => {
    if (activeTool === "segment" && editor?.canvas && samWorker.current && device) {
      encodeImageClick();
    }
  }, [activeTool, editor?.canvas, device]);

  // Start encoding image
  const encodeImageClick = async () => {
    if (!samWorker.current || !editor?.canvas) return;
    
    const workspace = editor.getWorkspace();
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
        const largestDim = Math.max(workspaceWidth, workspaceHeight);

        const box = resizeAndPadBox(
          { h: workspaceHeight, w: workspaceWidth },
          { h: largestDim, w: largestDim }
        );
        
        tempCtx?.drawImage(img, 0, 0, 720, 480, box?.x || 0, 0, box?.w, box?.h);

        // tempCtx?.drawImage(img, 0, 0, workspaceWidth, workspaceHeight, box?.x || 0, box?.y || 0, box?.w, box?.h);
      
        samWorker.current?.postMessage({
          type: "encodeImage",
          data: canvasToFloat32Array(resizeCanvas(tempCanvas, imageSize)),
        });

        setLoading(true);
        setStatus("Encoding");
    };

    img.src = workspaceImage;
  };
  
  const onClose = () => {
    onChangeActiveTool("select");
  };

  useEffect(() => {
    // Cleanup worker when component unmounts
    return () => {
      if (samWorker.current) {
        samWorker.current.terminate();
        samWorker.current = null;
      }
    };
  }, []);

  // Add this effect to handle canvas interactivity
  useEffect(() => {
    if (!editor?.canvas) return;
    
    if (activeTool !== "segment") {
      // Reset to default cursors when sidebar is closed
      editor.canvas.hoverCursor = 'default';
      editor.canvas.defaultCursor = 'default';
      editor.canvas.selection = true;
      editor.canvas.forEachObject((obj) => {
        if (!obj.data?.isMask) {
          obj.selectable = true;
          obj.evented = true;
        }
      });
    } else if (loading) {
      // Disable all canvas interactions while loading
      editor.canvas.selection = false;
      editor.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      editor.canvas.hoverCursor = 'progress';
      editor.canvas.defaultCursor = 'progress';
    } else {
      // Disable all interactions when sidebar is open but not actively segmenting
      editor.canvas.selection = false;
      editor.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      editor.canvas.hoverCursor = 'crosshair';
      editor.canvas.defaultCursor = 'crosshair';
    }
    
    editor.canvas.renderAll();
  }, [loading, editor?.canvas, activeTool]);

  const handleNewMask = () => {
    // Stop all active animations first
    Object.values(activeAnimations).forEach(animation => animation.stop());
    setActiveAnimations({});
    
    // Deapply all masks from canvas
    if (editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    }
    
    setIsSegmentationActive(true);
    if (editor) {
      // Create new array with inProgress mask at the top
      const updatedMasks = [
        { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: true },
        ...editor.segmentedMasks.map(mask => ({ ...mask, isApplied: false }))
      ];
      editor.setSegmentedMasks(updatedMasks);
    }
  };

  const handleSaveInProgressMask = () => {
    if (mask && maskBinary && editor) {
      const maskDataUrl = mask.toDataURL('image/png');
      const maskBinaryDataUrl = maskBinary.toDataURL('image/png');
      const newMaskId = crypto.randomUUID();
      
      // Get count of actual saved masks (excluding the stub)
      const savedMasksCount = editor.segmentedMasks.filter(mask => mask.url).length;

      // First update the state with a new array
      const updatedMasks = [
        { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: false }, // New stub at top
        ...editor.segmentedMasks.map((mask, index) => 
          index === 0 ? 
          { 
            ...mask, 
            id: newMaskId,
            url: maskDataUrl, 
            binaryUrl: maskBinaryDataUrl,
            inProgress: false, 
            isApplied: true,
            name: `Object ${savedMasksCount + 1}` 
          } : {
            ...mask,
            isApplied: false
          }
        ).filter(mask => !mask.inProgress)
      ];
      editor.setSegmentedMasks(updatedMasks);

      // Then set up the mask in Fabric.js
      if (editor.canvas) {
        // Remove any existing masks
        const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
        existingMasks.forEach(mask => editor.canvas.remove(mask));

        // Create new mask image
        fabric.Image.fromURL(maskDataUrl, (maskImage) => {
          const workspace = editor.getWorkspace();
          if (!workspace) return;

          // Set all basic properties
          maskImage.set({
            left: workspace.left || 0,
            top: workspace.top || 0,
            width: workspace.width || 720,
            height: workspace.height || 480,
            selectable: false,
            evented: false,
            opacity: 0.9,
          });

          // Explicitly set the data property with both isMask and url
          maskImage.data = { 
            isMask: true, 
            url: maskDataUrl 
          };

          // Add to canvas and ensure data is set
          editor.canvas.add(maskImage);
          
          // Double check the data is set
          const addedObject = editor.canvas.getObjects().find(obj => obj.data?.isMask);
          console.log('New mask saved with data:', addedObject?.data);
          setIsSegmentationActive(false);
          editor.canvas.renderAll();
        });

        // Reset current mask state
        setMask(null);
        setPrevMaskArray(null);
        pointsRef.current = [];
        setIsSegmentationActive(false);
      }
    }
  };

  const handleCancelInProgressMask = () => {
    // Remove mask from canvas
    if (editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    }
    
    // Reset current mask state
    setMask(null);
    setPrevMaskArray(null);
    pointsRef.current = [];
    setIsSegmentationActive(false);
    
    // Reset the top stub to "New Mask" state
    if (editor) {
      const updatedMasks = [
        { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: false },
        ...editor.segmentedMasks.filter(mask => !mask.inProgress)
      ];
      editor.setSegmentedMasks(updatedMasks);
    }
  };

  const handleApplyMask = (maskUrl: string, index: number) => {
    if (!editor?.canvas) return;

    // Get the actual index in the full segmentedMasks array
    const actualIndex = editor.segmentedMasks.findIndex(mask => mask.url === maskUrl);
    
    // If the mask is already applied, just remove it and update state
    if (editor.segmentedMasks[actualIndex].isApplied) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
      const updatedMasks = editor.segmentedMasks.map(mask => ({
        ...mask,
        isApplied: false
      }));
      editor.setSegmentedMasks(updatedMasks);
      return;
    }

    // Otherwise, apply the new mask
    const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
    existingMasks.forEach(mask => editor.canvas.remove(mask));
    
    setIsSegmentationActive(false);
    setMask(null);
    setPrevMaskArray(null);
    pointsRef.current = [];

    fabric.Image.fromURL(maskUrl, (maskImage) => {
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Set all basic properties
      maskImage.set({
        left: workspace.left || 0,
        top: workspace.top || 0,
        width: workspace.width || 720,
        height: workspace.height || 480,
        selectable: false,
        evented: false,
        opacity: 0.9
      });

      // Explicitly set the data property with both isMask and url
      maskImage.data = { 
        isMask: true, 
        url: maskUrl 
      };

      // Add to canvas and ensure data is set
      editor.canvas.add(maskImage);
      
      // Double check the data is set
      const addedObject = editor.canvas.getObjects().find(obj => obj.data?.isMask);
      console.log('Mask applied with data:', addedObject?.data);
      
      editor.canvas.renderAll();

      // Update state to reflect which mask is applied
      const updatedMasks = editor.segmentedMasks.map((mask, i) => ({
        ...mask,
        isApplied: i === actualIndex,
        inProgress: false
      }));
      editor.setSegmentedMasks(updatedMasks);
    });
  };

  // Update click handling to only work when segmentation is active
  useEffect(() => {
    console.log("isSegmentationActive", isSegmentationActive);
    // Add this isSegmentationActive check
    if (!editor?.canvas || activeTool !== "segment") return;

    const imageClick = (e: fabric.IEvent) => {
      console.log("imageClick", isSegmentationActive);
      if (!imageEncoded || !editor?.canvas || !isSegmentationActive) return;

      const pointer = editor.canvas.getPointer(e.e);
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get the workspace object's position
      const workspaceLeft = workspace.left || 0;
      const workspaceTop = workspace.top || 0;

      // Calculate relative coordinates within the workspace
      const relativeX = Math.round(pointer.x - workspaceLeft);
      const relativeY = Math.round(pointer.y - workspaceTop);
      
      // Only process click if within workspace bounds
      if (relativeX >= 0 && relativeX <= imageSize.w && relativeY >= 0 && relativeY <= imageSize.h) {

        // Get workspace dimensions
        const workspaceWidth = workspace.width || 720;
        const workspaceHeight = workspace.height || 480;


        // Normalize coordinates from workspace dimensions to target size
        const normalizedX = Math.round((relativeX / workspaceWidth) * imageSize.w);
        const normalizedY = Math.round((relativeY / workspaceHeight) * imageSize.h);
        

        const point = {
          x: normalizedX,
          y: normalizedY,
          label: 1,
        };

        pointsRef.current.push(point);
        // do we have a mask already? ie. a refinement click?
        if (prevMaskArray) {
          const maskShape = [1, 1, maskSize.w, maskSize.h];

          samWorker.current?.postMessage({
            type: "decodeMask",
            data: {
              points: pointsRef.current,
              maskArray: prevMaskArray,
              maskShape: maskShape,
            }
          });      
        } else {
          samWorker.current?.postMessage({
            type: "decodeMask",
            data: {
              points: pointsRef.current,
              maskArray: null,
              maskShape: null,
            }
          });      
        }
      }
    };

    editor.canvas.on('mouse:down', imageClick);
    return () => {
      editor.canvas.off('mouse:down', imageClick);
    };
  }, [editor?.canvas, activeTool, imageEncoded, isSegmentationActive]);
  // editor?.canvas, activeTool, imageEncoded, imageSize.w, imageSize.h, maskSize.w, maskSize.h
  // Clear masks when sidebar closes
  useEffect(() => {
    if (activeTool !== "segment" && editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
    }
  }, [activeTool, editor?.canvas]);

  const handleRenameMask = (index: number, newName: string) => {
    if (editor) {
      const updatedMasks = editor.segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, name: newName } : mask
      );
      editor.setSegmentedMasks(updatedMasks);
    }
  };

  const handleDeleteMask = (index: number) => {
    if (!editor) return;
    
    // Get the mask URL before removing it from state
    const maskToDelete = editor.segmentedMasks[index];
    if (maskToDelete?.url && activeAnimations[maskToDelete.url]) {
      // Stop the animation for this specific mask
      activeAnimations[maskToDelete.url].stop();
      // Remove it from active animations
      setActiveAnimations(prev => {
        const newAnimations = { ...prev };
        delete newAnimations[maskToDelete.url];
        return newAnimations;
      });
    }
    
    // Continue with deletion
    const updatedMasks = editor.segmentedMasks.filter((_, i) => i !== index);
    editor.setSegmentedMasks(updatedMasks);
    
    if (editor.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    }
  };

  const handleStartRename = (index: number) => {
    if (editor) {
      const updatedMasks = editor.segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, isEditing: true } : mask
      );
      editor.setSegmentedMasks(updatedMasks);
    }
  };

  const handleFinishRename = (index: number, newName: string) => {
    if (editor) {
      const updatedMasks = editor.segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, name: newName, isEditing: false } : mask
      );
      editor.setSegmentedMasks(updatedMasks);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, index: number, newName: string) => {
    if (event.key === 'Enter') {
      handleFinishRename(index, newName);
    }
  };

  // Update effect for sidebar open/close
  useEffect(() => {
    if (activeTool !== "segment" && editor?.canvas) {
      // Clear masks from canvas
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
      // Reset all masks' applied status
      if (editor) {
        const updatedMasks = editor.segmentedMasks.map(mask => ({
          ...mask,
          isApplied: false
        }));
        editor.setSegmentedMasks(updatedMasks);
      }
    }
  }, [activeTool, editor?.canvas]);

  const handleControlMotion = (maskId: string, maskUrl: string) => {
    console.log('🎮 Starting Control Motion:', { maskId, maskUrl });

    if (!editor?.canvas) {
      console.warn('❌ No canvas available');
      return;
    }

    setRecordingMotion(maskUrl);

    // First disable all objects and reset cursor
    editor.canvas.selection = false;
    editor.canvas.defaultCursor = 'default';
    editor.canvas.hoverCursor = 'default';
    
    // Find the mask object
    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === maskUrl);
    console.log('🎭 Found mask object:', { 
      found: !!maskObject,
      maskData: maskObject?.data,
      totalObjects: editor.canvas.getObjects().length
    });
    
    if (!maskObject) {
      console.warn('❌ Mask object not found in canvas');
      setRecordingMotion(null);
      return;
    }

    // Disable all objects
    editor.canvas.forEachObject(obj => {
      obj.selectable = false;
      obj.evented = false;
    });

    // Array to store trajectory points
    const trajectoryPoints: Array<{x: number, y: number}> = [];

    // Track if we're currently dragging
    let isDragging = false;

    // Enable dragging for the selected mask
    maskObject.set({
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: true,
      lockRotation: true,
      hoverCursor: 'grab',
      moveCursor: 'grabbing'
    });

    // Add mouse down handler
    const handleMouseDown = (e: fabric.IEvent) => {
      if (!maskObject) return;
      isDragging = true;
      const pointer = editor.canvas.getPointer(e.e);
      // Record initial point
      trajectoryPoints.push({
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      });
      console.log('👆 Started recording trajectory');
    };

    // Add mouse move handler
    const handleMouseMove = (e: fabric.IEvent) => {
      if (!isDragging || !maskObject) return;
      const pointer = editor.canvas.getPointer(e.e);
      // Record point during movement
      trajectoryPoints.push({
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      });
    };

    // Add mouse up handler
    const handleMouseUp = (e: fabric.IEvent) => {
      if (!isDragging || !maskObject) return;
      isDragging = false;
      // Record final point
      trajectoryPoints.push({
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      });
      console.log('👆 Finished recording trajectory:', trajectoryPoints.length, 'points');
      
      // Store the trajectory points in the mask's data
      maskObject.data = {
        ...maskObject.data,
        trajectoryPoints
      };
    };

    // Attach event listeners
    editor.canvas.on('mouse:down', handleMouseDown);
    editor.canvas.on('mouse:move', handleMouseMove);
    editor.canvas.on('mouse:up', handleMouseUp);

    // Store cleanup function in the maskObject's data
    maskObject.data = {
      ...maskObject.data,
      cleanupEvents: () => {
        editor.canvas.off('mouse:down', handleMouseDown);
        editor.canvas.off('mouse:move', handleMouseMove);
        editor.canvas.off('mouse:up', handleMouseUp);
      }
    };
    
    editor.canvas.renderAll();
    console.log('🎯 Control motion setup complete');
  };

  const handleSaveMotion = () => {
    if (!recordingMotion || !editor?.canvas) return;

    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === recordingMotion);
    if (!maskObject) return;

    // Clean up event listeners
    if (maskObject.data?.cleanupEvents) {
      maskObject.data.cleanupEvents();
    }

    // Get the recorded trajectory points
    let points = maskObject.data?.trajectoryPoints || [{
      x: (maskObject.left || 0) + ((maskObject.width || 0) * (maskObject.scaleX || 1)) / 2,
      y: (maskObject.top || 0) + ((maskObject.height || 0) * (maskObject.scaleY || 1)) / 2
    }];

    // Smooth and interpolate the trajectory
    if (points.length > 1) {
      points = smoothTrajectory(points); // First smooth the trajectory
      points = interpolatePoints(points, 49); // Then interpolate to exactly 49 points
    }

    console.log('🛣️ Trajectory saved:', {
      maskUrl: recordingMotion,
      startPoint: points[0],
      endPoint: points[points.length - 1],
      totalPoints: points.length,
      isInterpolated: points.length === 49
    });

    // Update mask state with trajectory (visible by default when saving)
    const updatedMasks = editor.segmentedMasks.map(mask => 
      mask.url === recordingMotion ? {
        ...mask,
        trajectory: {
          points,
          isVisible: true // Set to true by default when saving
        }
      } : mask
    );
    editor.setSegmentedMasks(updatedMasks);

    // Create and start the animation with the current points
    console.log('▶️ Creating new animation');
    const animation = createTrajectoryAnimation(editor, recordingMotion, points);
    if (animation) {
      animation.start();
      setActiveAnimations(prev => ({
        ...prev,
        [recordingMotion]: {
          stop: animation.stop,
          isPlaying: true
        }
      }));
    }
    
    // Reset object state and cursor
    maskObject.set({
      hasControls: true,
      lockRotation: false,
      selectable: false,
      evented: false,
      hoverCursor: 'default'
    });
    editor.canvas.defaultCursor = 'default';
    editor.canvas.hoverCursor = 'default';
    editor.canvas.renderAll();

    setRecordingMotion(null);
    console.log('💾 Saved motion trajectory');
  };

  const handleCancelMotion = () => {
    if (!recordingMotion || !editor?.canvas) return;

    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === recordingMotion);
    if (!maskObject) return;

    // Clean up event listeners
    if (maskObject.data?.cleanupEvents) {
      maskObject.data.cleanupEvents();
    }

    // Reset object state and cursor without saving trajectory
    maskObject.set({
      hasControls: true,
      lockRotation: false,
      selectable: false,
      evented: false,
      hoverCursor: 'default'
    });
    editor.canvas.defaultCursor = 'default';
    editor.canvas.hoverCursor = 'default';
    editor.canvas.renderAll();

    setRecordingMotion(null);
    console.log('🚫 Cancelled motion recording');
  };

  const createTrajectoryAnimation = (
    editor: Editor, 
    maskUrl: string, 
    trajectoryPoints: Array<{x: number, y: number}>
  ) => {
    // console.log('🎬 Creating animation for mask:', maskUrl);
    // console.log('📍 Trajectory points:', trajectoryPoints);

    if (!editor?.canvas) {
      // console.error('❌ No canvas found in editor');
      return null;
    }

    // Get workspace dimensions
    const workspace = editor.getWorkspace() as fabric.Object;
    if (!workspace) return null;
    
    const workspaceWidth = workspace.width || 720;
    const workspaceHeight = workspace.height || 480;

    // Create animation canvas
    const animationCanvas = document.createElement('canvas');
    const parentElement = (editor.canvas.getElement() as HTMLCanvasElement).parentElement;
    
    // Match parent dimensions
    animationCanvas.width = parentElement?.offsetWidth || 720;
    animationCanvas.height = parentElement?.offsetHeight || 480;
    
    // Position canvas correctly
    animationCanvas.style.position = 'absolute';
    animationCanvas.style.left = '0';
    animationCanvas.style.top = '0';
    animationCanvas.style.width = '100%';
    animationCanvas.style.height = '100%';
    animationCanvas.style.pointerEvents = 'none';
    animationCanvas.style.zIndex = '1000';
    
    const ctx = animationCanvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Could not get canvas context');
      return null;
    }

    // Load mask image
    const maskImage = new Image();
    maskImage.src = maskUrl;
    console.log('🖼️ Loading mask image:', maskUrl);

    maskImage.onload = () => {
      // console.log('✅ Mask image loaded:', {
      //   width: maskImage.width,
      //   height: maskImage.height
      // });
    };

    let animationFrame: number;
    let progress = 0;
    const animationDuration = 2000;
    let startTime: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
        // console.log('⏱️ Animation started at:', timestamp);
      }
      
      const elapsed = timestamp - startTime;
      progress = (elapsed % animationDuration) / animationDuration;

      // Clear canvas
      ctx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

      // Calculate current position on trajectory
      const pointIndex = Math.floor(progress * (trajectoryPoints.length - 1));
      const nextIndex = Math.min(pointIndex + 1, trajectoryPoints.length - 1);
      const pointProgress = (progress * (trajectoryPoints.length - 1)) % 1;

      const currentPos = interpolatePosition(
        trajectoryPoints[pointIndex],
        trajectoryPoints[nextIndex],
        pointProgress
      );

      // Get current viewport transform and zoom
      const vpt = editor.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = editor.canvas.getZoom();
      
      // Transform position from object space to screen space
      const screenX = currentPos.x * vpt[0] + vpt[4];
      const screenY = currentPos.y * vpt[3] + vpt[5];

      // if (elapsed % 500 < 16) {
      //   console.log('📍 Current position:', {
      //     original: currentPos,
      //     transformed: { x: screenX, y: screenY },
      //     zoom,
      //     vpt
      //   });
      // }

      // Draw mask centered at the transformed position
      ctx.globalAlpha = 0.8;
      ctx.drawImage(
        maskImage,
        screenX - (workspaceWidth * zoom / 2),
        screenY - (workspaceHeight * zoom / 2),
        workspaceWidth * zoom,
        workspaceHeight * zoom
      );

      animationFrame = requestAnimationFrame(animate);
    };

    const start = () => {
      console.log('▶️ Starting animation');
      parentElement?.appendChild(animationCanvas);
      startTime = 0;
      animate(0);
    };

    const stop = () => {
      console.log('⏹️ Stopping animation');
      cancelAnimationFrame(animationFrame);
      if (animationCanvas && animationCanvas.parentElement) {
        animationCanvas.parentElement.removeChild(animationCanvas);
      }
    };

    return { start, stop, isPlaying: true };
  };

  const handleToggleTrajectory = (maskUrl: string) => {
    console.log('🔄 Toggling trajectory for mask:', maskUrl);
    
    if (editor) {
      // Create a new array by mapping the existing masks
      const updatedMasks = editor.segmentedMasks.map(mask => 
        mask.url === maskUrl && mask.trajectory ? {
          ...mask,
          trajectory: {
            ...mask.trajectory,
            isVisible: !mask.trajectory.isVisible
          }
        } : mask
      );
      
      // Set the new array directly
      editor.setSegmentedMasks(updatedMasks);
      console.log('📝 Updated masks:', updatedMasks);
    }

    if (editor?.canvas) {
      const mask = editor.segmentedMasks.find(m => m.url === maskUrl);
      console.log('🎭 Found mask:', mask);
      
      if (mask?.trajectory?.points) {
        if (activeAnimations[maskUrl]) {
          console.log('⏹️ Stopping existing animation');
          activeAnimations[maskUrl].stop();
          setActiveAnimations(prev => {
            const newAnimations = { ...prev };
            delete newAnimations[maskUrl];
            return newAnimations;
          });
        } else {
          console.log('▶️ Creating new animation');
          const animation = createTrajectoryAnimation(editor, maskUrl, mask.trajectory.points);
          if (animation) {
            animation.start();
            setActiveAnimations(prev => ({
              ...prev,
              [maskUrl]: {
                stop: animation.stop,
                isPlaying: true
              }
            }));
          }
        }
      }
    }
  };

  const handleRedoTrajectory = (maskUrl: string) => {
    if (editor) {
      const updatedMasks = editor.segmentedMasks.map(mask => 
        mask.url === maskUrl ? {
          ...mask,
          trajectory: undefined
        } : mask
      );
      editor.setSegmentedMasks(updatedMasks);
    }

    // Remove trajectory from canvas
    if (editor?.canvas) {
      const trajectoryObj = editor.canvas.getObjects().find(obj => obj.data?.trajectoryFor === maskUrl);
      if (trajectoryObj) {
        editor.canvas.remove(trajectoryObj);
        editor.canvas.renderAll();
      }
    }
  };

  // Add effect to hide all trajectories when sidebar opens
  useEffect(() => {
    if (activeTool === "segment" && editor?.canvas) {
      // Hide all trajectory objects
      editor.canvas.getObjects()
        .filter(obj => obj.data?.trajectoryFor)
        .forEach(obj => {
          obj.visible = false;
        });
      editor.canvas.renderAll();

      // Update state to reflect hidden trajectories
      if (editor) {
        const updatedMasks = editor.segmentedMasks.map(mask => 
          mask.trajectory ? {
            ...mask,
            trajectory: {
              ...mask.trajectory,
              isVisible: false
            }
          } : mask
        );
        editor.setSegmentedMasks(updatedMasks);
      }
    }
  }, [activeTool, editor?.canvas]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active animations
      Object.values(activeAnimations).forEach(animation => animation.stop());
    };
  }, [activeAnimations]);

  // Add cleanup when sidebar closes
  useEffect(() => {
    if (activeTool !== "segment") {
      Object.values(activeAnimations).forEach(animation => animation.stop());
      setActiveAnimations({});
    }
  }, [activeTool]);

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r rounded-xl z-[40] w-[360px] flex flex-col my-2",
        activeTool === "segment" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Segmentation"
        description="Place coordinates to segment the image"
      />

      <ScrollArea>
        <div className="p-4 space-y-4 border-b">
          <Label className="text-sm">
            Segmented Objects 
          </Label>
          
          {/* Add loading and status indicator */}
          <div className="mt-4 space-y-2">
            {loading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{status}</span>
              </div>
            )}
            {!loading && status && (
              <div className="text-sm text-muted-foreground">
                {status}
              </div>
            )}
          </div>

          {/* Segmented masks list */}
          <div className="space-y-2">
            {/* Always show the "New Object" stub at the top */}
            <div className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center space-x-2">
                <span className="text-sm">New Object</span>
              </div>
              <div className="flex items-center space-x-2">
                {isSegmentationActive ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveInProgressMask}
                      disabled={!mask}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save Mask as Object
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelInProgressMask}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewMask}
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Mask
                  </Button>
                )}
              </div>
            </div>

            {/* Show saved masks */}
            {editor?.segmentedMasks
              .filter(mask => !mask.inProgress && mask.url)
              .map((mask, index) => {
                // Get the actual index in the full array
                const actualIndex = editor?.segmentedMasks.findIndex(m => m.url === mask.url);
                
                return (
                  <div key={mask.url} className="flex flex-col p-2 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img 
                          src={mask.url} 
                          alt={mask.name} 
                          className="w-12 h-12 object-contain"
                        />
                        {mask.isEditing ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={mask.name}
                              onChange={(e) => handleRenameMask(actualIndex, e.target.value)}
                              onKeyPress={(e) => handleKeyPress(e, actualIndex, mask.name)}
                              className="h-8 w-40 text-sm"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleFinishRename(actualIndex, mask.name)}
                              className="h-8 w-8"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{mask.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartRename(actualIndex)}
                              className="h-8 w-8"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyMask(mask.url, actualIndex)}
                        >
                          {mask.isApplied ? 'Applied' : 'Apply'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMask(actualIndex)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {mask.trajectory ? (
                      <div className="flex space-x-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                          onClick={() => handleToggleTrajectory(mask.url)}
                        >
                          {mask.trajectory.isVisible ? 'Hide' : 'Show'} Trajectory
                        </Button>
                        <Button
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          size="sm"
                          onClick={() => handleRedoTrajectory(mask.url)}
                          disabled
                        >
                          Redo
                        </Button>
                      </div>
                    ) : recordingMotion === mask.url ? (
                      <div className="flex space-x-2">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                          onClick={handleSaveMotion}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Save Motion
                        </Button>
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                          size="sm"
                          onClick={handleCancelMotion}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        size="sm"
                        disabled={!mask.isApplied}
                        onClick={() => handleControlMotion(mask.id, mask.url)}
                      >
                        Control Motion
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </ScrollArea>
      
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
  