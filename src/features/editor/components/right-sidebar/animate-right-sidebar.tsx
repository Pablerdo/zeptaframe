import { useRef, useEffect, useState } from "react";
import { fabric } from "fabric";

import { 
  ActiveWorkbenchTool, 
  Editor,
  SegmentedMask,
  ActiveSegmentationTool,
  ActiveTool,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { RotationTimeline, ScaleTimeline } from "./animate-right-sidebar-utils";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2, Trash2, Pencil, Plus, ChevronRight, ChevronDown, Move, Hand, ChevronUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { interpolatePoints, interpolatePosition, smoothTrajectory } from "@/features/editor/utils";
import { videoGenUtils } from "../../utils/video-gen-utils";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AnimateRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  onChangeActiveTool: (tool: ActiveTool) => void;
  samWorker: React.RefObject<Worker | null>;
  samWorkerLoading: boolean;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
  maskCentroid: { x: number; y: number } | null;
  setMaskCentroid: (centroid: { x: number; y: number } | null) => void;
  segmentedMasks: SegmentedMask[];
  setSegmentedMasks: (masks: SegmentedMask[]) => void;
  activeSegmentationTool: ActiveSegmentationTool;
  setActiveSegmentationTool: (tool: ActiveSegmentationTool) => void;
  degradation: number;
  setDegradation: (value: number) => void;
  timelineCollapsed: boolean;
}

export const AnimateRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  onChangeActiveTool,
  samWorker,
  samWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
  maskCentroid,
  setMaskCentroid,
  segmentedMasks,
  setSegmentedMasks,
  activeSegmentationTool,
  setActiveSegmentationTool,
  degradation,
  setDegradation,
  timelineCollapsed,
}: AnimateRightSidebarProps) => {

  const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
  const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });
  const pointsRef = useRef<Array<{ x: number; y: number; label: number }>>([]);
  const [recordingMotion, setRecordingMotion] = useState<string | null>(null);
  const [activeAnimations, setActiveAnimations] = useState<{[key: string]: {
    stop: () => void;
    isPlaying: boolean;
  }}>({});
  
  // New state variables for mask editing
  const [editingMaskId, setEditingMaskId] = useState<string | null>(null);
  const [tempMaskName, setTempMaskName] = useState<string>("");

  const [hasFinishedDragging, setHasFinishedDragging] = useState(false);
  const [trajectoryLimitReached, setTrajectoryLimitReached] = useState(false);
  
  // Add ref for trajectory length tracking
  const trajectoryLengthRef = useRef(0);

  // State for slow loading disclaimer
  const [showSlowLoadingDisclaimer, setShowSlowLoadingDisclaimer] = useState(false);

  // Effect to show slow loading disclaimer after 2 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (samWorkerLoading) {
      timer = setTimeout(() => {
        setShowSlowLoadingDisclaimer(true);
      }, 4000);
    } else {
      setShowSlowLoadingDisclaimer(false);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [samWorkerLoading]);

  // Helper function to generate next mask name with consistent numbering
  const generateNextMaskName = (type: 'auto' | 'manual'): string => {
    const validMasks = segmentedMasks.filter(mask => !mask.inProgress && mask.url);
    const typePrefix = type === 'manual' ? 'Manual Mask' : 'Object';
    
    // Get existing numbers for this type
    const existingNumbers = validMasks
      .filter(mask => mask.name.startsWith(typePrefix))
      .map(mask => {
        const match = mask.name.match(new RegExp(`${typePrefix}\\s+(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    // Find the next available number
    let nextNumber = 1;
    while (existingNumbers.includes(nextNumber)) {
      nextNumber++;
    }
    
    return `${typePrefix} ${nextNumber}`;
  };

  // Helper function to get next z-index
  const getNextZIndex = (): number => {
    const validMasks = segmentedMasks.filter(mask => !mask.inProgress && mask.url);
    return validMasks.length;
  };

  // Helper function to normalize z-indices after deletion
  const normalizeZIndices = (masks: SegmentedMask[]): SegmentedMask[] => {
    const validMasks = masks.filter(mask => !mask.inProgress && mask.url);
    
    // Sort by current z-index to maintain order
    const sortedMasks = [...validMasks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    
    // Reassign z-indices sequentially
    const normalizedMasks = masks.map(mask => {
      if (!mask.inProgress && mask.url) {
        const sortedIndex = sortedMasks.findIndex(sorted => sorted.id === mask.id);
        return { ...mask, zIndex: sortedIndex };
      }
      return mask;
    });
    
    return normalizedMasks;
  };

  // Helper function to calculate centroid from binary mask
  const calculateCentroidFromBinaryMask = (binaryCanvas: HTMLCanvasElement): { x: number; y: number } | null => {
    const ctx = binaryCanvas.getContext('2d');
    if (!ctx) return null;
    
    const imageData = ctx.getImageData(0, 0, binaryCanvas.width, binaryCanvas.height);
    const data = imageData.data;
    
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // Iterate through all pixels
    for (let y = 0; y < binaryCanvas.height; y++) {
      for (let x = 0; x < binaryCanvas.width; x++) {
        const idx = (y * binaryCanvas.width + x) * 4;
        // Check if pixel is white (R, G, B all 255)
        if (data[idx] === 255 && data[idx + 1] === 255 && data[idx + 2] === 255) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    
    if (count === 0) return null;
    
    // Calculate average position (centroid)
    return {
      x: sumX / count,
      y: sumY / count
    };
  };

  // Helper function to generate rotation array from keyframes
  const generateRotationTrajectory = (keyframes: RotationKeyframe[], frameCount: number): number[] => {
    if (keyframes.length === 0) {
      return new Array(frameCount).fill(0);
    }
    
    if (keyframes.length === 1) {
      return new Array(frameCount).fill(keyframes[0].rotation);
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
        rotationTrajectory.push(prevKeyframe.rotation);
      } else {
        const localProgress = (progress - prevKeyframe.trajectoryProgress) / 
          (nextKeyframe.trajectoryProgress - prevKeyframe.trajectoryProgress);
        const interpolatedRotation = prevKeyframe.rotation + 
          (nextKeyframe.rotation - prevKeyframe.rotation) * localProgress;
        rotationTrajectory.push(interpolatedRotation);
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
      return new Array(frameCount).fill(keyframes[0].scale);
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
        scaleTrajectory.push(prevKeyframe.scale);
      } else {
        const localProgress = (progress - prevKeyframe.trajectoryProgress) / 
          (nextKeyframe.trajectoryProgress - prevKeyframe.trajectoryProgress);
        const interpolatedScale = prevKeyframe.scale + 
          (nextKeyframe.scale - prevKeyframe.scale) * localProgress;
        scaleTrajectory.push(interpolatedScale);
      }
    }
    
    return scaleTrajectory;
  };

  const onClose = () => {
    setActiveSegmentationTool("none");
    onChangeActiveWorkbenchTool("select");
    onChangeActiveTool("select");
  };

  const handleNewManualMask = () => {
    // Stop all active animations first
    Object.values(activeAnimations).forEach(animation => animation.stop());
    setActiveAnimations({});
    
    // Deapply all masks from canvas
    if (editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    
      setActiveSegmentationTool("manual");

      // Enable drawing mode, so that we can draw a manual mask
      editor.enableSegmentationMode(true);
      
      editor.changeStrokeColor("rgba(0, 255, 0, 0.95)");
      editor.changeStrokeWidth(3);

      // Remove any previous path:created listeners to avoid duplicates
      editor.canvas.off('path:created');
      
      // Add event listener for when a path is created (after mouse up)
      editor.canvas.on('path:created', function(e: any) {
        const path = e.path as fabric.Path;
        
        // Add metadata to identify this as a manual mask path
        path.data = { isManualMaskPath: true };
        
        // Minimum distance to consider the path closed
        const closeDistance = 20;
        
        // Check if the path is closed (start and end points are close enough)
        if (path.path && Array.isArray(path.path)) {
          if (path.path.length < 10) {
            // Path is too short, discard and allow starting over
            editor.canvas.remove(path);
            return;
          }
          
          // Get start and end coordinates
          const start = path.path[0];
          const end = path.path[path.path.length - 1];
          
          if (Array.isArray(start) && start[0] === 'M' && Array.isArray(end) && end[0] === 'L') {
            const startX = start[1] as number;
            const startY = start[2] as number;
            const endX = end[1] as number;
            const endY = end[2] as number;
            
            // Calculate distance between start and end points
            const dx = endX - startX;
            const dy = endY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closeDistance) {
              // Add a closing segment to ensure it's a closed path
              // Cast to any to bypass type checking for the path array
              (path.path as any).push(['L', startX, startY]);
              
              path.set({ 
                stroke: 'rgba(255, 0, 0, 0.7)',
                strokeWidth: 2,
                fill: 'transparent'
              });
              
              // Save the mask
              handleSaveInProgressManualMask();
            } else {
              // Not closed enough, discard and allow starting over
              editor.canvas.remove(path);
            }
          } else {
            // Path doesn't have expected structure, discard
            editor.canvas.remove(path);
          }
        }
      });
      
      // Set cursor to crosshair for manual drawing
      editor.canvas.defaultCursor = 'crosshair';
    }
  };

  // Helper function to handle z-index changes
  const handleZIndexChange = (maskIndex: number, direction: 'up' | 'down') => {
    const currentMask = segmentedMasks[maskIndex];
    const currentZIndex = currentMask.zIndex ?? maskIndex;
    
    // Filter out masks that are in progress or don't have URLs
    const validMasks = segmentedMasks.filter(mask => !mask.inProgress && mask.url);
    const validMaskIndices = segmentedMasks
      .map((mask, idx) => ({ mask, idx }))
      .filter(({ mask }) => !mask.inProgress && mask.url)
      .map(({ idx }) => idx);
    
    if (direction === 'up' && currentZIndex < validMasks.length - 1) {
      // Find the mask with the next higher z-index
      const targetMaskIndex = segmentedMasks.findIndex(
        mask => mask.zIndex === currentZIndex + 1
      );
      
      if (targetMaskIndex !== -1) {
        // Swap z-indices
        const updatedMasks = [...segmentedMasks];
        updatedMasks[maskIndex] = { ...updatedMasks[maskIndex], zIndex: currentZIndex + 1 };
        updatedMasks[targetMaskIndex] = { ...updatedMasks[targetMaskIndex], zIndex: currentZIndex };
        setSegmentedMasks(updatedMasks);
        
        // Restart preview animations if any are active with the updated masks
        restartPreviewAnimations(updatedMasks);
      }
    } else if (direction === 'down' && currentZIndex > 0) {
      // Find the mask with the next lower z-index
      const targetMaskIndex = segmentedMasks.findIndex(
        mask => mask.zIndex === currentZIndex - 1
      );
      
      if (targetMaskIndex !== -1) {
        // Swap z-indices
        const updatedMasks = [...segmentedMasks];
        updatedMasks[maskIndex] = { ...updatedMasks[maskIndex], zIndex: currentZIndex - 1 };
        updatedMasks[targetMaskIndex] = { ...updatedMasks[targetMaskIndex], zIndex: currentZIndex };
        setSegmentedMasks(updatedMasks);
        
        // Restart preview animations if any are active with the updated masks
        restartPreviewAnimations(updatedMasks);
      }
    }
  };

  const handleSaveInProgressManualMask = () => {
    if (editor?.canvas) {
      editor.enableSegmentationMode(false);
      
      // Get the drawn path from the canvas
      const drawnPath = editor.canvas.getObjects().find(
        obj => obj.data?.isManualMaskPath
      ) as fabric.Object & { path?: any[] };
      
      if (drawnPath && drawnPath.path) {
        // Create a mask from the path
        const fabricCanvas = editor.canvas;
        const workspace = editor.getWorkspace();
        if (!workspace) return;
        
        // Get workspace dimensions and position
        const workspaceLeft = workspace.left as number || 0;
        const workspaceTop = workspace.top as number || 0;
        const workspaceWidth = workspace.width as number || 960;
        const workspaceHeight = workspace.height as number || 640;
        
        // Create a binary mask canvas first (for the data)
        const binaryCanvas = document.createElement('canvas');
        binaryCanvas.width = workspaceWidth;
        binaryCanvas.height = workspaceHeight;
        const binaryCtx = binaryCanvas.getContext('2d');
        
        if (!binaryCtx) return;
        
        // Fill with black (transparent in mask terms)
        binaryCtx.fillStyle = 'black';
        binaryCtx.fillRect(0, 0, binaryCanvas.width, binaryCanvas.height);
        
        // Fill the path with white (opaque in mask terms)
        binaryCtx.fillStyle = 'white';
        binaryCtx.beginPath();
        
        // Recreate the path from Fabric.js path but adjust for workspace position
        if (Array.isArray(drawnPath.path)) {
          drawnPath.path.forEach((pathCmd: any[], i: number) => {
            if (i === 0 && pathCmd[0] === 'M') {
              // Adjust coordinates to be relative to the workspace
              const x = pathCmd[1] - workspaceLeft;
              const y = pathCmd[2] - workspaceTop;
              binaryCtx.moveTo(x, y);
            } else if (pathCmd[0] === 'L') {
              // Adjust coordinates to be relative to the workspace
              const x = pathCmd[1] - workspaceLeft;
              const y = pathCmd[2] - workspaceTop;
              binaryCtx.lineTo(x, y);
            } else if (pathCmd[0] === 'Q') {
              // Adjust coordinates to be relative to the workspace
              const x1 = pathCmd[1] - workspaceLeft;
              const y1 = pathCmd[2] - workspaceTop;
              const x2 = pathCmd[3] - workspaceLeft;
              const y2 = pathCmd[4] - workspaceTop;
              binaryCtx.quadraticCurveTo(x1, y1, x2, y2);
            } else if (pathCmd[0] === 'C') {
              // Adjust coordinates to be relative to the workspace
              const x1 = pathCmd[1] - workspaceLeft;
              const y1 = pathCmd[2] - workspaceTop;
              const x2 = pathCmd[3] - workspaceLeft;
              const y2 = pathCmd[4] - workspaceTop;
              const x3 = pathCmd[5] - workspaceLeft;
              const y3 = pathCmd[6] - workspaceTop;
              binaryCtx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
            }
          });
        }
        
        // Close and fill the path
        binaryCtx.closePath();
        binaryCtx.fill();
        
        // Now create a visual representation canvas with transparency
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = workspaceWidth;
        tempCanvas.height = workspaceHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) return;
        
        // Start with a transparent canvas
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw a semi-transparent overlay
        tempCtx.fillStyle = 'rgba(170, 170, 170, 0.8)'; // Semi-transparent blue
        
        // Recreate the same path for the visual representation
        tempCtx.beginPath();
        if (Array.isArray(drawnPath.path)) {
          drawnPath.path.forEach((pathCmd: any[], i: number) => {
            if (i === 0 && pathCmd[0] === 'M') {
              const x = pathCmd[1] - workspaceLeft;
              const y = pathCmd[2] - workspaceTop;
              tempCtx.moveTo(x, y);
            } else if (pathCmd[0] === 'L') {
              const x = pathCmd[1] - workspaceLeft;
              const y = pathCmd[2] - workspaceTop;
              tempCtx.lineTo(x, y);
            } else if (pathCmd[0] === 'Q') {
              const x1 = pathCmd[1] - workspaceLeft;
              const y1 = pathCmd[2] - workspaceTop;
              const x2 = pathCmd[3] - workspaceLeft;
              const y2 = pathCmd[4] - workspaceTop;
              tempCtx.quadraticCurveTo(x1, y1, x2, y2);
            } else if (pathCmd[0] === 'C') {
              const x1 = pathCmd[1] - workspaceLeft;
              const y1 = pathCmd[2] - workspaceTop;
              const x2 = pathCmd[3] - workspaceLeft;
              const y2 = pathCmd[4] - workspaceTop;
              const x3 = pathCmd[5] - workspaceLeft;
              const y3 = pathCmd[6] - workspaceTop;
              tempCtx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
            }
          });
        }
        tempCtx.closePath();
        tempCtx.fill();
        
        // Add a border to make it more visible
        tempCtx.strokeStyle = 'rgba(102, 102, 102, 0.9)';
        tempCtx.lineWidth = 2;
        tempCtx.stroke();
        
        // Set the masks
        setMask(tempCanvas);
        setMaskBinary(binaryCanvas);
        
        // Remove the drawing path
        fabricCanvas.remove(drawnPath);
        
        // Turn off path:created listener
        fabricCanvas.off('path:created');
        
        // Calculate centroid from the binary mask
        const calculatedCentroid = calculateCentroidFromBinaryMask(binaryCanvas);
        
        // Add the new mask to segmentedMasks with clean numbering
        const newMaskId = `mask-${Date.now()}`;
        const newMask: SegmentedMask = {
          id: newMaskId,
          name: generateNextMaskName('manual'),
          url: tempCanvas.toDataURL(),
          binaryUrl: binaryCanvas.toDataURL(),
          isApplied: true,
          trajectory: undefined,
          rotation: 0,
          centroid: calculatedCentroid || undefined,
          zIndex: getNextZIndex()
        };
        
        // Simply add the new mask to the existing array
        setSegmentedMasks([...segmentedMasks, newMask]);

        // Apply the mask to the canvas
        fabric.Image.fromURL(tempCanvas.toDataURL(), (maskImage) => {
          const workspace = editor.getWorkspace();
          if (!workspace) return;

          // Set all basic properties
          maskImage.set({
            left: workspace.left || 0,
            top: workspace.top || 0,
            width: workspace.width || 960,
            height: workspace.height || 640,
            selectable: false,
            evented: false,
            opacity: 0.9,
          });

          // Explicitly set the data property with both isMask and url
          maskImage.data = { 
            isMask: true, 
            url: tempCanvas.toDataURL() 
          };

          // Add to canvas and ensure data is set
          editor.canvas.add(maskImage);
          editor.canvas.renderAll();
        });
      }
      
      // Reset segmentation tool and canvas state
      setActiveSegmentationTool("none");
      editor.canvas.defaultCursor = 'default';
    }
  };

  const handleCancelInProgressManualMask = () => {
    if (editor?.canvas) {
      editor.enableSegmentationMode(false);
      setActiveSegmentationTool("none");
      
      // Remove any drawing paths
      const existingPaths = editor.canvas.getObjects().filter(obj => obj.data?.isManualMaskPath);
      existingPaths.forEach(path => editor.canvas.remove(path));
      
      // Reset canvas state
      editor.canvas.defaultCursor = 'default';
      
      // Remove path:created listener
      editor.canvas.off('path:created');
    }
  };

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
    
    setActiveSegmentationTool("auto");
    
    if (editor) {
      // Reset any current mask
      setMask(null);
      
      // Set cursor to crosshair for SAM segmentation
      editor.canvas.defaultCursor = 'crosshair';
    }
  };

  const handleSaveInProgressMask = () => {
    if (mask && maskBinary && editor) {
      const maskDataUrl = mask.toDataURL('image/png');
      const maskBinaryDataUrl = maskBinary.toDataURL('image/png');
      const newMaskId = crypto.randomUUID();
      
      // Create new mask with clean numbering
      const newMask: SegmentedMask = {
        id: newMaskId,
        name: generateNextMaskName('auto'),
        url: maskDataUrl,
        binaryUrl: maskBinaryDataUrl,
        isApplied: true,
        centroid: maskCentroid || undefined,
        zIndex: getNextZIndex()
      };

      // Add to existing masks and unapply others
      const updatedMasks = [
        ...segmentedMasks.map(mask => ({ ...mask, isApplied: false })),
        newMask
      ];
      setSegmentedMasks(updatedMasks);
      
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
            width: workspace.width || 960,
            height: workspace.height || 640,
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
          
          setActiveSegmentationTool("none");
          editor.canvas.renderAll();
        });

        // Reset current mask state
        setMask(null);
        setPrevMaskArray(null);
        pointsRef.current = [];
        setActiveSegmentationTool("none");
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
    setActiveSegmentationTool("none");
  };

  const handleApplyMask = (maskUrl: string, startAnimation: boolean = true) => {
    if (!editor?.canvas) return;

    // Delete all animations in the canvas
    Object.values(activeAnimations).forEach(animation => animation.stop());
    setActiveAnimations({});

    // Get the actual index in the full segmentedMasks array
    const actualIndex = segmentedMasks.findIndex(mask => mask.url === maskUrl);
    
    // If the mask is already applied, just remove it and update state
    if (segmentedMasks[actualIndex].isApplied) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
      if (activeAnimations[maskUrl] && startAnimation) {
        handleToggleTrajectory(maskUrl, false);
      }
      const updatedMasks = segmentedMasks.map(mask => ({
        ...mask,
        isApplied: false
      }));
      setSegmentedMasks(updatedMasks);
      return;
    }

    // Otherwise, apply the new mask
    const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
    existingMasks.forEach(mask => editor.canvas.remove(mask));
    
    setActiveSegmentationTool("none");
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
        width: workspace.width || 960,
        height: workspace.height || 640,
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
      
      // Check if the mask has a trajectory
      if (segmentedMasks[actualIndex].trajectory) {
        handleToggleTrajectory(maskUrl, true);
      }

      editor.canvas.renderAll();

      // Update state to reflect which mask is applied
      const updatedMasks = segmentedMasks.map((mask, i) => ({
        ...mask,
        isApplied: i === actualIndex,
        inProgress: false
      }));
      setSegmentedMasks(updatedMasks);
    });
  };

  // Update click handling to only work when segmentation is active
  useEffect(() => {
    if (!editor?.canvas || activeWorkbenchTool !== "animate" || activeSegmentationTool === "none") return;

    const imageClick = (e: fabric.IEvent) => {
      // Only process clicks if actively in AUTO segmentation mode
      if (activeSegmentationTool !== "auto" || !samWorker.current || samWorkerLoading || !editor?.canvas) {
        return;
      }

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
        const workspaceWidth = workspace.width || 960;
        const workspaceHeight = workspace.height || 640;


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
  }, [editor?.canvas, activeWorkbenchTool, samWorkerLoading, activeSegmentationTool]);

  // editor?.canvas, activeTool, imageEncoded, imageSize.w, imageSize.h, maskSize.w, maskSize.h
  // Clear masks when sidebar closes
  useEffect(() => {
    if (activeWorkbenchTool !== "animate" && editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
    }
  }, [activeWorkbenchTool, editor?.canvas]);

  const handleDeleteMask = (index: number) => {
    if (!editor) return;
    
    // Get the mask URL before removing it from state
    const maskToDelete = segmentedMasks[index];
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
    
    // Remove the mask from the array
    const updatedMasks = segmentedMasks.filter((_, i) => i !== index);
    
    // Normalize z-indices to maintain proper order
    const normalizedMasks = normalizeZIndices(updatedMasks);
    
    setSegmentedMasks(normalizedMasks);
    
    if (editor.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    }
  };

  const handleStartRename = (index: number) => {
    if (editor) {
      const maskToEdit = segmentedMasks[index];
      setEditingMaskId(maskToEdit.url);
      setTempMaskName(maskToEdit.name);
    }
  };

  const handleFinishRename = (index: number, newName: string) => {
    if (editor) {
      const updatedMasks = segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, name: newName } : mask
      );
      setSegmentedMasks(updatedMasks);
      setEditingMaskId(null);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Enter') {
      handleFinishRename(index, tempMaskName);
    }
  };

  // Update effect for sidebar open/close
  useEffect(() => {
    if (activeWorkbenchTool !== "animate" && editor?.canvas) {

      // Clear masks from canvas
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
      // Reset all masks' applied status
      if (editor) {
        const updatedMasks = segmentedMasks.map(mask => ({
          ...mask,
          isApplied: false
        }));
        setSegmentedMasks(updatedMasks);
      }
      // Re-enable all interactions
      editor.canvas.skipTargetFind = false;
    } else if (activeWorkbenchTool === "animate" && editor?.canvas) {
      editor.canvas.skipTargetFind = true; // This prevents objects from being targets for mouse events
    }

  }, [activeWorkbenchTool, editor?.canvas]);

  const handleControlMotion = (maskId: string, maskUrl: string) => {

    if (!editor?.canvas) {
      return;
    }

    setRecordingMotion(maskUrl);
    setTrajectoryLimitReached(false);
    setHasFinishedDragging(false);
    trajectoryLengthRef.current = 0;

    editor.canvas.skipTargetFind = false; // This prevents objects from being targets for mouse events

    // First disable all objects and reset cursor
    editor.canvas.selection = false;
    editor.canvas.defaultCursor = 'default';
    editor.canvas.hoverCursor = 'default';
    
    // Find the mask object
    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === maskUrl);
    
    if (!maskObject) {
      setRecordingMotion(null);
      return;
    }

    // Calculate maximum trajectory length (3/4 of the diagonal of the canvas)
    const workspace = editor.getWorkspace();
    if (!workspace) return;
    
    const workspaceWidth = workspace.width as number || 960;
    const workspaceHeight = workspace.height as number || 640;
    const maxTrajectoryLength = Math.sqrt(workspaceWidth * workspaceWidth + workspaceHeight * workspaceHeight) * 0.35;
    
    let lastPoint: {x: number, y: number} | null = null;

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
      trajectoryLengthRef.current = 0;
      lastPoint = null;
      const pointer = editor.canvas.getPointer(e.e);
      // Record initial point
      const initialPoint = {
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      };
      trajectoryPoints.push(initialPoint);
      lastPoint = initialPoint;
    };

    // Add mouse move handler
    const handleMouseMove = (e: fabric.IEvent) => {
      if (!isDragging || !maskObject) return;
      const pointer = editor.canvas.getPointer(e.e);
      // Calculate current position
      const currentPoint = {
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      };
      
      // Calculate distance from last point
      if (lastPoint) {
        const dx = currentPoint.x - lastPoint.x;
        const dy = currentPoint.y - lastPoint.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        
        // Update trajectory length in ref (mutable and immediately accessible)
        trajectoryLengthRef.current += segmentLength;

        // Check if we've exceeded the maximum trajectory length
        if (trajectoryLengthRef.current > maxTrajectoryLength) {
          setHasFinishedDragging(true);
          isDragging = false;
          setTrajectoryLimitReached(true);
          
          // Store the trajectory points in the mask's data
          maskObject.data = {
            ...maskObject.data,
            trajectoryPoints
          };
          
          // Simulate mouse up to stop dragging
          editor.canvas.off('mouse:move', handleMouseMove);
          editor.canvas.off('mouse:up', handleMouseUp);
          
          return;
        }
      }
      
      lastPoint = currentPoint;
      
      // Record point during movement
      trajectoryPoints.push(currentPoint);

      // I need to also draw the mask object on the canvas, so as to see the movement
      
      // Track the last position we drew a ghost mask at
      if (!maskObject.data.lastDrawnPosition) {
        maskObject.data.lastDrawnPosition = {
          x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
          y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
        };
        maskObject.data.ghostMasks = [];
      }
      
      // Calculate the current center position of the mask
      const currentPosition = {
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      };
      
      // Calculate distance from last drawn position
      const dx = currentPosition.x - maskObject.data.lastDrawnPosition.x;
      const dy = currentPosition.y - maskObject.data.lastDrawnPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only draw a new ghost mask if we've moved at least 5 pixels
      if (distance >= 5) {
        // Create a clone of the mask at reduced opacity
        const ghostMask = new fabric.Image((maskObject as fabric.Image).getElement() as HTMLImageElement, {
          left: maskObject.left,
          top: maskObject.top,
          width: maskObject.width,
          height: maskObject.height,
          scaleX: maskObject.scaleX,
          scaleY: maskObject.scaleY,
          selectable: false,
          evented: false,
          opacity: 0.3,
        });
        
        // Add the ghost mask to the canvas
        editor.canvas.add(ghostMask);
        
        // Add this ghost mask to our list for cleanup later
        maskObject.data.ghostMasks.push(ghostMask);
        
        // Update the last drawn position
        maskObject.data.lastDrawnPosition = {...currentPosition};
      }
    };

    // Add mouse up handler
    const handleMouseUp = (e: fabric.IEvent) => {
      if (!isDragging || !maskObject) return;
      setHasFinishedDragging(true);
      isDragging = false;
      // Record final point
      trajectoryPoints.push({
        x: maskObject.left! + (maskObject.width! * (maskObject.scaleX || 1)) / 2,
        y: maskObject.top! + (maskObject.height! * (maskObject.scaleY || 1)) / 2
      });

      setTrajectoryLimitReached(false);
      
      // Store the trajectory points in the mask's data
      maskObject.data = {
        ...maskObject.data,
        trajectoryPoints
      };
      
      // Ghost masks will remain visible until Save or Cancel is clicked
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
  };

  const handleToggleTrajectory = (maskUrl: string, startAnimation: boolean) => {

    if (!editor?.canvas) {
      return;
    }

    if (startAnimation) {
      // Then toggle trajectory visibility
      const updatedMasks = segmentedMasks.map(mask => 
        mask.url === maskUrl && mask.trajectory ? {
          ...mask,
          trajectory: {
            ...mask.trajectory,
            isVisible: true
          }
        } : mask
      );

      const mask = segmentedMasks.find(m => m.url === maskUrl);

      const animation = createTrajectoryAnimation(
        editor, 
        maskUrl, 
        mask?.trajectory?.points || [],
        mask?.rotationTrajectory,
        mask?.scaleTrajectory,
        mask?.zIndex
      );
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
      
      // Set the new array directly
      setSegmentedMasks(updatedMasks);
    } else {
      const mask = segmentedMasks.find(m => m.url === maskUrl);
      
      if (mask?.trajectory?.points) {
        if (activeAnimations[maskUrl]) {
          activeAnimations[maskUrl].stop();
          setActiveAnimations(prev => {
            const newAnimations = { ...prev };
            delete newAnimations[maskUrl];
            return newAnimations;
          });
        } 
      }
    }

  };

  const handleRedoTrajectory = (maskUrl: string) => {
    if (editor) {
      // First ensure the mask is applied
      const maskIndex = segmentedMasks.findIndex(mask => mask.url === maskUrl);
      if (maskIndex >= 0 && !segmentedMasks[maskIndex].isApplied) {
        // Apply the mask if not already applied
        handleApplyMask(maskUrl, false);
        
        // After applying the mask, set a timeout to allow the state to update
        setTimeout(() => {
          startRetracingTrajectory(maskUrl);
        }, 100);
      } else {
        // Mask is already applied, start retracing immediately
        startRetracingTrajectory(maskUrl);
      }
    }
  };

  // Helper function to start the retracing process
  const startRetracingTrajectory = (maskUrl: string) => {
    // Find the mask with this URL
    const mask = segmentedMasks.find(m => m.url === maskUrl);
    if (mask) {
      // Stop any active animation for this mask first
      if (activeAnimations[maskUrl]) {
        activeAnimations[maskUrl].stop();
        setActiveAnimations(prev => {
          const newAnimations = { ...prev };
          delete newAnimations[maskUrl];
          return newAnimations;
        });
      }

      // Store the original trajectory in case user cancels
      mask.originalTrajectory = mask.trajectory;
      
      setHasFinishedDragging(false);
      // Set recordingMotion state to show Save/Cancel buttons FIRST
      setRecordingMotion(maskUrl);
      
      // Use a small timeout to ensure the state update is processed before continuing
      setTimeout(() => {
        // Start the control motion process
        handleControlMotion(mask.id, maskUrl);
      }, 50);
    }
  };

  const handleSaveMotion = () => {
    if (!recordingMotion || !editor?.canvas) return;
    
    setTrajectoryLimitReached(false);
    setHasFinishedDragging(false);

    editor.canvas.skipTargetFind = true;
    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === recordingMotion);
    if (!maskObject) return;

    // Clean up event listeners
    if (maskObject.data?.cleanupEvents) {
      maskObject.data.cleanupEvents();
    }

    // Clean up any remaining ghost masks
    if (maskObject.data?.ghostMasks && maskObject.data.ghostMasks.length > 0) {
      maskObject.data.ghostMasks.forEach((ghostMask: fabric.Image) => {
        editor.canvas.remove(ghostMask);
      });
      maskObject.data.ghostMasks = [];
    }

    // Get the recorded trajectory points
    let points = maskObject.data?.trajectoryPoints || [{
      x: (maskObject.left || 0) + ((maskObject.width || 0) * (maskObject.scaleX || 1)) / 2,
      y: (maskObject.top || 0) + ((maskObject.height || 0) * (maskObject.scaleY || 1)) / 2
    }];

    // Smooth the trajectory but don't interpolate yet - interpolation will be done at submission time
    if (points.length > 1) {
      points = smoothTrajectory(points); // First smooth the trajectory
      // Note: Final interpolation to frame count will be done when generating video
    }

    // Update mask state with trajectory (visible by default when saving)
    // When redoing, we also need to remove the originalTrajectory property
    const updatedMasks = segmentedMasks.map(mask => 
      mask.url === recordingMotion ? {
        ...mask,
        trajectory: {
          points,
          isVisible: true // Set to true by default when saving
        },
        originalTrajectory: undefined // Clear the original trajectory reference
      } : mask
    );
    setSegmentedMasks(updatedMasks);

    // Create and start the animation with the current points
    const animation = createTrajectoryAnimation(
      editor, 
      recordingMotion, 
      points,
      updatedMasks.find(m => m.url === recordingMotion)?.rotationTrajectory,
      updatedMasks.find(m => m.url === recordingMotion)?.scaleTrajectory,
      updatedMasks.find(m => m.url === recordingMotion)?.zIndex
    );
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
  };

  const handleCancelMotion = () => {
    if (!recordingMotion || !editor?.canvas) return;

    const maskObject = editor.canvas.getObjects().find(obj => obj.data?.isMask && obj.data.url === recordingMotion);
    if (!maskObject) return;

    // Clean up event listeners
    if (maskObject.data?.cleanupEvents) {
      maskObject.data.cleanupEvents();
    }

    // Clean up any remaining ghost masks
    if (maskObject.data?.ghostMasks && maskObject.data.ghostMasks.length > 0) {
      maskObject.data.ghostMasks.forEach((ghostMask: fabric.Image) => {
        editor.canvas.remove(ghostMask);
      });
      maskObject.data.ghostMasks = [];
    }

    // If we were redoing a trajectory, restore the original
    const updatedMasks = segmentedMasks.map(mask => {
      if (mask.url === recordingMotion && mask.originalTrajectory) {
        // Restore the original trajectory
        return {
          ...mask,
          trajectory: mask.originalTrajectory,
          originalTrajectory: undefined // Clear the temporary property
        };
      }
      return mask;
    });
    
    // Update the state with restored trajectories if needed
    if (updatedMasks.some(mask => mask.url === recordingMotion && mask.originalTrajectory)) {
      setSegmentedMasks(updatedMasks);
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
  };

  const createTrajectoryAnimation = (
    editor: Editor, 
    maskUrl: string, 
    rawTrajectoryPoints: Array<{x: number, y: number}>,
    rotationValues?: number[],
    scaleValues?: number[],
    zIndex?: number
  ) => {

    if (!editor?.canvas) {
      return null;
    }

    // Get workspace dimensions
    const workspace = editor.getWorkspace() as fabric.Object;
    if (!workspace) return null;
    
    const workspaceWidth = workspace.width || 960;
    const workspaceHeight = workspace.height || 640;

    // Find the mask in segmentedMasks to get its centroid
    const maskData = segmentedMasks.find(mask => mask.url === maskUrl);
    const maskCentroid = maskData?.centroid;

    // Interpolate trajectory points for animation preview (using videoGenUtils.totalFrames for preview)
    let trajectoryPoints: Array<{x: number, y: number}>;
    if (rawTrajectoryPoints.length === 0) {
      // No trajectory - stationary at center
      trajectoryPoints = new Array(videoGenUtils.totalFrames).fill({ x: 480, y: 320 });
    } else if (rawTrajectoryPoints.length === 1) {
      // Single point - replicate for all frames
      trajectoryPoints = new Array(videoGenUtils.totalFrames).fill(rawTrajectoryPoints[0]);
    } else {
      // Multiple points - interpolate to preview frame count
      trajectoryPoints = interpolatePoints(rawTrajectoryPoints, videoGenUtils.totalFrames);
    }

    // Create animation canvas
    const animationCanvas = document.createElement('canvas');
    const parentElement = (editor.canvas.getElement() as HTMLCanvasElement).parentElement;
    
    // Match parent dimensions
    animationCanvas.width = parentElement?.offsetWidth || 960;
    animationCanvas.height = parentElement?.offsetHeight || 640;
    
    // Position canvas correctly
    animationCanvas.style.position = 'absolute';
    animationCanvas.style.left = '0';
    animationCanvas.style.top = '0';
    animationCanvas.style.width = '100%';
    animationCanvas.style.height = '100%';
    animationCanvas.style.pointerEvents = 'none';
    // Use z-index to ensure proper layering (add 1000 as base to be above canvas)
    animationCanvas.style.zIndex = String(1000 + (zIndex ?? 0));
    
    const ctx = animationCanvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Could not get canvas context');
      return null;
    }

    // Load mask image
    const maskImage = new Image();
    maskImage.src = maskUrl;

    maskImage.onload = () => {};

    let animationFrame: number;
    let progress = 0;
    const animationDuration = 2000;
    let startTime: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
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

      // Calculate current rotation
      let currentRotation = 0;
      if (rotationValues && rotationValues.length > 0) {
        const rotationIndex = Math.floor(progress * (rotationValues.length - 1));
        const nextRotationIndex = Math.min(rotationIndex + 1, rotationValues.length - 1);
        const rotationProgress = (progress * (rotationValues.length - 1)) % 1;
        
        currentRotation = rotationValues[rotationIndex] + 
          (rotationValues[nextRotationIndex] - rotationValues[rotationIndex]) * rotationProgress;
      }

      // Calculate current scale
      let currentScale = 1.0;
      if (scaleValues && scaleValues.length > 0) {
        const scaleIndex = Math.floor(progress * (scaleValues.length - 1));
        const nextScaleIndex = Math.min(scaleIndex + 1, scaleValues.length - 1);
        const scaleProgress = (progress * (scaleValues.length - 1)) % 1;
        
        currentScale = scaleValues[scaleIndex] + 
          (scaleValues[nextScaleIndex] - scaleValues[scaleIndex]) * scaleProgress;
      }

      // Get current viewport transform and zoom
      const vpt = editor.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = editor.canvas.getZoom();
      
      // Transform position from object space to screen space
      const screenX = currentPos.x * vpt[0] + vpt[4];
      const screenY = currentPos.y * vpt[3] + vpt[5];

      // Apply transformations and draw mask
      ctx.save();
      ctx.globalAlpha = 0.8;
      
      // Move to the trajectory position
      ctx.translate(screenX, screenY);
      
      // If we have a centroid, use it as the rotation/scale center
      if (maskCentroid) {
        // Transform centroid to screen space
        const centroidScreenX = (maskCentroid.x - workspaceWidth / 2) * zoom;
        const centroidScreenY = (maskCentroid.y - workspaceHeight / 2) * zoom;
        
        // Translate to centroid, apply rotation and scale, then translate back
        ctx.translate(centroidScreenX, centroidScreenY);
        ctx.rotate(-currentRotation * Math.PI / 180); // Negate rotation for counter-clockwise
        ctx.scale(currentScale, currentScale);
        ctx.translate(-centroidScreenX, -centroidScreenY);
      } else {
        // Fallback to center-based rotation/scaling
        ctx.rotate(-currentRotation * Math.PI / 180); // Negate rotation for counter-clockwise
        ctx.scale(currentScale, currentScale);
      }
      
      ctx.drawImage(
        maskImage,
        -(workspaceWidth * zoom / 2),
        -(workspaceHeight * zoom / 2),
        workspaceWidth * zoom,
        workspaceHeight * zoom
      );
      
      ctx.restore();

      animationFrame = requestAnimationFrame(animate);
    };

    const start = () => {
      parentElement?.appendChild(animationCanvas);
      startTime = 0;
      animate(0);
    };

    const stop = () => {
      cancelAnimationFrame(animationFrame);
      if (animationCanvas && animationCanvas.parentElement) {
        animationCanvas.parentElement.removeChild(animationCanvas);
      }
    };

    return { start, stop, isPlaying: true };
  };

  // Add effect to hide all trajectories when sidebar opens
  useEffect(() => {
    if (activeWorkbenchTool === "animate" && editor?.canvas) {
      // Hide all trajectory objects
      editor.canvas.getObjects()
        .filter(obj => obj.data?.trajectoryFor)
        .forEach(obj => {
          obj.visible = false;
        });
      editor.canvas.renderAll();

      // Update state to reflect hidden trajectories
      if (editor) {
        const updatedMasks = segmentedMasks.map(mask => 
          mask.trajectory ? {
            ...mask,
            trajectory: {
              ...mask.trajectory,
              isVisible: false
            }
          } : mask
        );
        setSegmentedMasks(updatedMasks);
      }
    }
  }, [activeWorkbenchTool, editor?.canvas]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active animations
      Object.values(activeAnimations).forEach(animation => animation.stop());
    };
  }, [activeAnimations]);

  // Add cleanup when sidebar closes
  useEffect(() => {
    if (activeWorkbenchTool !== "animate") {
      Object.values(activeAnimations).forEach(animation => animation.stop());
      setActiveAnimations({});
    }
  }, [activeWorkbenchTool]);

  // Effect to restart animations when timeline is toggled
  useEffect(() => {
    if (!editor?.canvas || activeWorkbenchTool !== "animate") return;

    // Check if there are any active animations
    const hasActiveAnimations = Object.keys(activeAnimations).length > 0;
    
    if (hasActiveAnimations) {
      // Use a timeout to allow the layout to adjust first
      const timeoutId = setTimeout(() => {
        // Stop all existing animations
        Object.values(activeAnimations).forEach(animation => {
          animation.stop();
        });
        
        // Restart animations with recalculated dimensions
        const newActiveAnimations: {[key: string]: {stop: () => void; isPlaying: boolean}} = {};
        
        // Sort masks by z-index before creating animations
        const masksWithTrajectories = segmentedMasks
          .filter(mask => !mask.inProgress && mask.url && mask.trajectory?.points && mask.trajectory.points.length > 0)
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        
        masksWithTrajectories.forEach(mask => {
          const animation = createTrajectoryAnimation(
            editor,
            mask.url,
            mask.trajectory!.points,
            mask.rotationTrajectory,
            mask.scaleTrajectory,
            mask.zIndex
          );
          
          if (animation) {
            animation.start();
            newActiveAnimations[mask.url] = {
              stop: animation.stop,
              isPlaying: true
            };
          }
        });
        
        setActiveAnimations(newActiveAnimations);
      }, 50); // Small delay to allow layout to adjust
      
      return () => clearTimeout(timeoutId);
    }
  }, [timelineCollapsed]); // Only watch timelineCollapsed changes

  // Add function to handle preview all animations (toggle)
  const handlePreviewAll = () => {
    if (!editor?.canvas) return;
    
    // Check if any animations are currently playing
    const hasActiveAnimations = Object.keys(activeAnimations).length > 0;
    
    if (hasActiveAnimations) {
      // Stop all existing animations
      Object.values(activeAnimations).forEach(animation => {
        animation.stop();
      });
      setActiveAnimations({});
    } else {
      // Start animations for all masks that have trajectories
      const newActiveAnimations: {[key: string]: {stop: () => void; isPlaying: boolean}} = {};
      
      // Sort masks by z-index before creating animations
      const masksWithTrajectories = segmentedMasks
        .filter(mask => !mask.inProgress && mask.url && mask.trajectory?.points && mask.trajectory.points.length > 0)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      
      masksWithTrajectories.forEach(mask => {
        const animation = createTrajectoryAnimation(
          editor,
          mask.url,
          mask.trajectory!.points,
          mask.rotationTrajectory,
          mask.scaleTrajectory,
          mask.zIndex
        );
        
        if (animation) {
          animation.start();
          newActiveAnimations[mask.url] = {
            stop: animation.stop,
            isPlaying: true
          };
        }
      });
      
      setActiveAnimations(newActiveAnimations);
    }
  };

  // Helper function to restart preview animations with updated z-order
  const restartPreviewAnimations = (updatedMasks?: SegmentedMask[]) => {
    if (!editor?.canvas) return;
    
    // Use provided masks or current state
    const masksToUse = updatedMasks || segmentedMasks;
    
    // Check if any animations are currently playing
    const hasActiveAnimations = Object.keys(activeAnimations).length > 0;
    
    if (hasActiveAnimations) {
      // Stop all existing animations
      Object.values(activeAnimations).forEach(animation => {
        animation.stop();
      });
      
      // Start animations again with updated z-order
      const newActiveAnimations: {[key: string]: {stop: () => void; isPlaying: boolean}} = {};
      
      // Sort masks by z-index before creating animations
      const masksWithTrajectories = masksToUse
        .filter(mask => !mask.inProgress && mask.url && mask.trajectory?.points && mask.trajectory.points.length > 0)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      
      masksWithTrajectories.forEach(mask => {
        const animation = createTrajectoryAnimation(
          editor,
          mask.url,
          mask.trajectory!.points,
          mask.rotationTrajectory,
          mask.scaleTrajectory,
          mask.zIndex
        );
        
        if (animation) {
          animation.start();
          newActiveAnimations[mask.url] = {
            stop: animation.stop,
            isPlaying: true
          };
        }
      });
      
      setActiveAnimations(newActiveAnimations);
    }
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l border-gray-300 dark:border-gray-700 z-[40] w-full flex flex-col",
        activeWorkbenchTool === "animate" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Animate"
          description="Choose an object to animate"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-100" />
        </button>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-4 space-y-4 border-b">
          <div className="flex items-center justify-between">
            <Label className="text-sm">
              Animation Type
            </Label>
            {segmentedMasks.filter(mask => !mask.inProgress && mask.url).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewAll}
                disabled={activeSegmentationTool !== "none" || segmentedMasks.every(mask => mask.trajectory === undefined)}
                className="h-7 px-3 text-xs"
              >
                {Object.keys(activeAnimations).length > 0 ? "Stop All" : "Preview All"}
              </Button>
            )}
          </div>
        
          {/* Segmented masks list */}
          <div className="space-y-2">
            {/* Show mask creation buttons when no segmentation is active */}
            {activeSegmentationTool === "none" && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleNewMask}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={samWorkerLoading}
                >
                  {samWorkerLoading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Auto Mask
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleNewManualMask}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Manual Mask
                </Button>
              </div>
            )}

            {/* Show segmentation-in-progress UI */}
            {activeSegmentationTool === "auto" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-300 dark:border-blue-700 rounded-md">
                <div className="text-center space-y-3">
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 animate-pulse">
                    Click on the object you want to animate
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveInProgressMask}
                      disabled={!mask}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save Object
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelInProgressMask}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeSegmentationTool === "manual" && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 border border-purple-300 dark:border-purple-700 rounded-md">
                <div className="text-center space-y-3">
                  <div className="text-sm font-medium text-purple-800 dark:text-purple-200 animate-pulse">
                    Draw around the object to create a mask
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelInProgressManualMask}
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Slow loading disclaimer */}
            {showSlowLoadingDisclaimer && samWorkerLoading && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-300 dark:border-amber-700 rounded-md animate-in fade-in duration-500">
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Loading Auto Mask Model...</p>
                    <p className="text-xs opacity-80">
                      This may take a while on slower connections as we download the SAM model.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-100 dark:bg-[#111530] p-3 border border-gray-300 dark:border-blue-800 rounded-md mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="degradation-slider" className="text-sm font-medium">
                    Mask Degradation: {degradation.toFixed(2)}
                  </Label>
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Degradation controls how faithfully the motion follows the mask trajectories.<br />
                        As degradation increases, the motion information is destroyed<br />
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <Slider
                id="degradation-slider"
                min={0}
                max={1}
                step={0.05}
                value={[degradation]}
                onValueChange={(values) => setDegradation(values[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>1</span>
              </div>
            </div> 
            
            {/* Separator */}
            {(activeSegmentationTool !== "none" || segmentedMasks.length > 0) && (
              <div className="h-px bg-gray-300 dark:bg-gray-700 w-full my-2" />
            )}

            {/* Empty state message */}
            {segmentedMasks.length === 0 && activeSegmentationTool === "none" && (
              <div className="p-6 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-md mt-3 bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                    <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                    <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-medium text-foreground">No objects yet</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    Create your first animated object using the buttons above
                  </p>
                </div>
              </div>
            )}

            {/* Show all masks */}
            {segmentedMasks.map((mask, index) => {
              // Get the actual index in the full array
              const actualIndex = segmentedMasks.findIndex(m => m.url === mask.url);
              const isEditingMaskName = editingMaskId === mask.url;
              const isRetracing = recordingMotion === mask.url;
              const hasTrajectory = !!mask.trajectory;
              
              return (
                <div key={mask.url} className={`flex flex-col p-2 border border-gray-300 dark:border-blue-700 rounded-md space-y-2 dark:bg-[#111530] ${activeSegmentationTool !== "none" ? 'opacity-50' : ''} ${mask.isApplied ? 'border-green-700 dark:border-green-700' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img 
                        src={mask.binaryUrl} 
                        alt={mask.name} 
                        className="w-12 h-12 object-contain"
                      />
                      {isEditingMaskName ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            value={tempMaskName}
                            onChange={(e) => setTempMaskName(e.target.value)}
                            onKeyPress={(e) => handleKeyPress(e, actualIndex)}
                            className="h-8 w-40 text-sm"
                            autoFocus
                            disabled={activeSegmentationTool !== "none"}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleFinishRename(actualIndex, tempMaskName)}
                            className="h-8 w-8"
                            disabled={activeSegmentationTool !== "none"}
                          >
                            <Check className="w-4 h-4" />
                          </Button> 
                        </div>
                      ) : (
                        <div className="flex items-center space-x-0">
                          <span className="text-sm">{mask.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartRename(actualIndex)}
                            className="h-8 w-8"
                            disabled={activeSegmentationTool !== "none"}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {!isEditingMaskName && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApplyMask(mask.url)}
                          className={mask.isApplied ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-700 hover:bg-blue-800 text-white"}
                          disabled={activeSegmentationTool !== "none"}
                        >
                          {mask.isApplied ? 'Applied' : 'Apply'}
                        </Button>
                        
                        {/* Z-index controls */}
                        <div className="flex items-center space-x-0.5 bg-gray-200 dark:bg-gray-700 rounded px-0.5">
                          
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleZIndexChange(actualIndex, 'up')}
                              className="h-4 w-3 p-0"
                              disabled={
                                activeSegmentationTool !== "none" || 
                                mask.zIndex === segmentedMasks.filter(m => !m.inProgress && m.url).length - 1
                              }
                              title="Move layer up"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleZIndexChange(actualIndex, 'down')}
                              className="h-4 w-3 p-0"
                              disabled={activeSegmentationTool !== "none" || mask.zIndex === 0}
                              title="Move layer down"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <span className="text-md font-medium px-1 min-w-[8px] text-center">
                            {(mask.zIndex ?? index) + 1}
                          </span>

                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMask(actualIndex)}
                          className="h-8 w-8 hover:text-red-500 transition-colors"
                          disabled={activeSegmentationTool !== "none"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-2">
                    <div className="flex items-center space-x-2 cursor-pointer select-none" 
                        onClick={() => {
                          if (editor && activeSegmentationTool === "none") {
                            const updatedMasks = segmentedMasks.map((m, i) => 
                              m.url === mask.url ? { ...m, isTextDetailsOpen: !m.isTextDetailsOpen } : m
                            );
                            setSegmentedMasks(updatedMasks);
                          }
                        }}>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${mask.isTextDetailsOpen ? 'rotate-90' : ''}`}
                      />
                      <span className="text-sm font-medium">Advanced Options</span>
                    </div>
                    {mask.isTextDetailsOpen && (
                      <div className="mt-2 space-y-4">
                        {/* Rotation Timeline Section */}
                        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-500 rounded-md">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-800 dark:text-gray-100 pl-1">
                              Rotation Timeline
                            </Label>
                            {mask.rotationKeyframes && mask.rotationKeyframes.length > 1 && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 mt-1 mr-1 rounded">
                                {mask.rotationKeyframes.length - 1} keyframes
                              </span>
                            )}
                          </div>
                          {!mask.trajectory ? (
                            <div className="text-xs text-muted-foreground border rounded border-dashed">
                              Create a trajectory first to enable rotation timeline
                            </div>
                          ) : (
                            <RotationTimeline
                              mask={mask}
                              onRotationChange={(rotationKeyframes) => {
                                if (editor && activeSegmentationTool === "none") {
                                  // Generate rotation trajectory from keyframes for preview (using preview frame count)
                                  const frameCount = videoGenUtils.totalFrames;
                                  const rotationTrajectory = generateRotationTrajectory(rotationKeyframes, frameCount);
                                  
                                  const updatedMasks = segmentedMasks.map((m, i) => 
                                    m.url === mask.url ? { 
                                      ...m, 
                                      rotationKeyframes,
                                      rotationTrajectory 
                                    } : m
                                  );
                                  setSegmentedMasks(updatedMasks);
                                  
                                  // If mask is applied and has a trajectory, restart the animation with new values
                                  if (mask.isApplied && mask.trajectory) {
                                    // Stop existing animation if any
                                    if (activeAnimations[mask.url]) {
                                      activeAnimations[mask.url].stop();
                                    }
                                    
                                    // Create and start new animation with updated values
                                    const animation = createTrajectoryAnimation(
                                      editor,
                                      mask.url,
                                      mask.trajectory.points,
                                      rotationTrajectory,
                                      mask.scaleTrajectory,
                                      mask.zIndex
                                    );
                                    
                                    if (animation) {
                                      animation.start();
                                      setActiveAnimations(prev => ({
                                        ...prev,
                                        [mask.url]: {
                                          stop: animation.stop,
                                          isPlaying: true
                                        }
                                      }));
                                    }
                                  }
                                }
                              }}
                              disabled={activeSegmentationTool !== "none"}
                            />
                          )}
                        </div>

                        {/* Scale Timeline Section */}
                        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-600 rounded-md">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-gray-800 dark:text-gray-100 pl-1">
                              Scale Timeline
                            </Label>
                            {mask.scaleKeyframes && mask.scaleKeyframes.length > 1 && (
                              <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded">
                                {mask.scaleKeyframes.length - 1} keyframes
                              </span>
                            )}
                          </div>
                          {!mask.trajectory ? (
                            <div className="text-xs text-muted-foreground border rounded border-dashed">
                              Create a trajectory first to enable scale timeline
                            </div>
                          ) : (
                            <ScaleTimeline
                              mask={mask}
                              onScaleChange={(scaleKeyframes) => {
                                if (editor && activeSegmentationTool === "none") {
                                  // Generate scale trajectory from keyframes for preview (using preview frame count)
                                  const frameCount = videoGenUtils.totalFrames;
                                  const scaleTrajectory = generateScaleTrajectory(scaleKeyframes, frameCount);
                                  
                                  const updatedMasks = segmentedMasks.map((m, i) => 
                                    m.url === mask.url ? { 
                                      ...m, 
                                      scaleKeyframes,
                                      scaleTrajectory 
                                    } : m
                                  );
                                  setSegmentedMasks(updatedMasks);
                                  
                                  // If mask is applied and has a trajectory, restart the animation with new values
                                  if (mask.isApplied && mask.trajectory) {
                                    // Stop existing animation if any
                                    if (activeAnimations[mask.url]) {
                                      activeAnimations[mask.url].stop();
                                    }
                                    
                                    // Create and start new animation with updated values
                                    const animation = createTrajectoryAnimation(
                                      editor,
                                      mask.url,
                                      mask.trajectory.points,
                                      mask.rotationTrajectory,
                                      scaleTrajectory,
                                      mask.zIndex
                                    );
                                    
                                    if (animation) {
                                      animation.start();
                                      setActiveAnimations(prev => ({
                                        ...prev,
                                        [mask.url]: {
                                          stop: animation.stop,
                                          isPlaying: true
                                        }
                                      }));
                                    }
                                  }
                                }
                              }}
                              disabled={activeSegmentationTool !== "none"}
                            />
                          )}
                        </div>

                        {/* Text Details Section */}
                        <div className="flex flex-col bg-gray-100 dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-600 rounded-md">
                          <Label className="text-sm font-medium text-gray-800 dark:text-gray-100 pl-1 my-1">
                              Text Details
                          </Label>
                          <textarea
                            className="w-full p-2 text-sm border rounded-md min-h-[60px] resize-y"
                            placeholder="Add specific object motion details to help with generation"
                            value={mask.textDetails || ""}
                            onChange={(e) => {
                              if (editor && activeSegmentationTool === "none") {
                                const updatedMasks = segmentedMasks.map((m, i) => 
                                  m.url === mask.url ? { ...m, textDetails: e.target.value } : m
                                );
                                setSegmentedMasks(updatedMasks);
                              }
                            }}
                            rows={2}
                            disabled={activeSegmentationTool !== "none"}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Trajectory interaction buttons - 3 states:
                      1. Retracing (show Save/Cancel)
                      2. Has trajectory (show Show/Hide + Retrace)
                      3. No trajectory (show Trace Trajectory) */}
                  {isRetracing ? (
                    <div className="flex space-x-2">
                      {hasFinishedDragging ? ( 
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                          onClick={handleSaveMotion}
                          disabled={activeSegmentationTool !== "none"}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Save Motion
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground animate-pulse">
                          Drag and drop the object to create a trajectory
                        </span>    
                      )}
                      <Button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            size="sm"
                            onClick={handleCancelMotion}
                            disabled={activeSegmentationTool !== "none"}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                      </Button>
                    </div>
                  ) : hasTrajectory && mask.trajectory ? (
                    <div className="flex space-x-2">
                      <Button
                        className="flex-1 bg-purple-700 hover:bg-purple-800 text-white"
                        size="sm"
                        onClick={() => handleRedoTrajectory(mask.url)}
                        disabled={activeSegmentationTool !== "none"}
                      >
                        <Hand className="w-4 h-4 mr-1" />
                        Retrace Trajectory
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-purple-700 hover:bg-purple-800 text-white"
                      size="sm"
                      disabled={!mask.isApplied || activeSegmentationTool !== "none"}
                      onClick={() => handleControlMotion(mask.id, mask.url)}
                    >
                      <Hand className="w-4 h-4 mr-1" />
                      Trace Trajectory
                    </Button>
                  )}
                  
                  {/* Show trajectory limit reached message */}
                  {isRetracing && trajectoryLimitReached && (
                    <div className="mt-2 text-sm text-amber-500 font-medium">
                      Trajectory length limit reached
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
  