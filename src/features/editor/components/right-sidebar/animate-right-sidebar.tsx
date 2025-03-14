import { useRef, useEffect, useState, useCallback, Dispatch, SetStateAction } from "react";
import { fabric } from "fabric";

import { 
  ActiveWorkbenchTool, 
  Editor,
  SegmentedMask,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2, Trash2, Pencil, Plus, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { interpolatePoints, interpolatePosition, smoothTrajectory } from "@/features/editor/utils";

interface AnimateRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  samWorker: React.RefObject<Worker | null>;
  samWorkerLoading: boolean;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
  segmentedMasks: SegmentedMask[];
  setSegmentedMasks: (masks: SegmentedMask[]) => void;
};

export const AnimateRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  samWorker,
  samWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
  segmentedMasks,
  setSegmentedMasks,
}: AnimateRightSidebarProps) => {

  const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
  const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });
  const pointsRef = useRef<Array<{ x: number; y: number; label: number }>>([]);
  const [isSegmentationActive, setIsSegmentationActive] = useState(false);
  const [recordingMotion, setRecordingMotion] = useState<string | null>(null);
  const [activeAnimations, setActiveAnimations] = useState<{[key: string]: {
    stop: () => void;
    isPlaying: boolean;
  }}>({});
  
  const onClose = () => {
    setIsSegmentationActive(false);
    onChangeActiveWorkbenchTool("select");
  };

  // Add this effect to handle canvas interactivity
  useEffect(() => {
    if (!editor?.canvas) return;
    
    if (activeWorkbenchTool !== "animate") {
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
    } else if (samWorkerLoading) {
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
  }, [samWorkerLoading, editor?.canvas, activeWorkbenchTool]);

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
      // Create a completely new array with a unique ID for the in-progress mask
      const updatedMasks = [
        { id: crypto.randomUUID(), url: '', binaryUrl: '', name: 'New Object', inProgress: true },
        ...segmentedMasks.map(mask => ({ ...mask, isApplied: false }))
      ];

      // Force update by creating a new array
      setSegmentedMasks([...updatedMasks]);
      
      
      // Reset any current mask
      setMask(null);
      // setSamWorkerLoading(false);
    }
  };

  const handleSaveInProgressMask = () => {
    if (mask && maskBinary && editor) {
      const maskDataUrl = mask.toDataURL('image/png');
      const maskBinaryDataUrl = maskBinary.toDataURL('image/png');
      const newMaskId = crypto.randomUUID();
      
      // Get count of actual saved masks (excluding the stub)
      const savedMasksCount = segmentedMasks.filter(mask => mask.url).length;


      // First update the state with a new array
      const updatedMasks = [
        { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: false }, // New stub at top
        ...segmentedMasks.map((mask, index) => 
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
        ...segmentedMasks.filter(mask => !mask.inProgress)
      ];
      setSegmentedMasks(updatedMasks);
    }
  };

  const handleApplyMask = (maskUrl: string, index: number) => {
    if (!editor?.canvas) return;

    // Get the actual index in the full segmentedMasks array
    const actualIndex = segmentedMasks.findIndex(mask => mask.url === maskUrl);
    
    // If the mask is already applied, just remove it and update state
    if (segmentedMasks[actualIndex].isApplied) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
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

    // Add this isSegmentationActive check
    if (!editor?.canvas || activeWorkbenchTool !== "animate") return;

    const imageClick = (e: fabric.IEvent) => {

      if (samWorkerLoading || !editor?.canvas ||  !isSegmentationActive) return;

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
  }, [editor?.canvas, activeWorkbenchTool, samWorkerLoading, isSegmentationActive]);

  // editor?.canvas, activeTool, imageEncoded, imageSize.w, imageSize.h, maskSize.w, maskSize.h
  // Clear masks when sidebar closes
  useEffect(() => {
    if (activeWorkbenchTool !== "animate" && editor?.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
      
    }
  }, [activeWorkbenchTool, editor?.canvas]);

  const handleRenameMask = (index: number, newName: string) => {
    if (editor) {
      const updatedMasks = segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, name: newName } : mask
      );
      setSegmentedMasks(updatedMasks);
    }
  };

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
    
    // Continue with deletion
    const updatedMasks = segmentedMasks.filter((_, i) => i !== index);
    setSegmentedMasks(updatedMasks);
    
    if (editor.canvas) {
      const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
      existingMasks.forEach(mask => editor.canvas.remove(mask));
      editor.canvas.renderAll();
    }
  };

  const handleStartRename = (index: number) => {
    if (editor) {
      const updatedMasks = segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, isEditing: true } : mask
      );
      setSegmentedMasks(updatedMasks);
    }
  };

  const handleFinishRename = (index: number, newName: string) => {
    if (editor) {
      const updatedMasks = segmentedMasks.map((mask, i) => 
        i === index ? { ...mask, name: newName, isEditing: false } : mask
      );
      setSegmentedMasks(updatedMasks);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, index: number, newName: string) => {
    if (event.key === 'Enter') {
      handleFinishRename(index, newName);
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
    }
  }, [activeWorkbenchTool, editor?.canvas]);

  const handleControlMotion = (maskId: string, maskUrl: string) => {

    if (!editor?.canvas) {
      return;
    }

    setRecordingMotion(maskUrl);

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

    // Update mask state with trajectory (visible by default when saving)
    const updatedMasks = segmentedMasks.map(mask => 
      mask.url === recordingMotion ? {
        ...mask,
        trajectory: {
          points,
          isVisible: true // Set to true by default when saving
        }
      } : mask
    );
    setSegmentedMasks(updatedMasks);

    // Create and start the animation with the current points
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
  };

  const createTrajectoryAnimation = (
    editor: Editor, 
    maskUrl: string, 
    trajectoryPoints: Array<{x: number, y: number}>
  ) => {

    if (!editor?.canvas) {
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

  const handleToggleTrajectory = (maskUrl: string) => {
    
    if (editor) {
      // Create a new array by mapping the existing masks
      const updatedMasks = segmentedMasks.map(mask => 
        mask.url === maskUrl && mask.trajectory ? {
          ...mask,
          trajectory: {
            ...mask.trajectory,
            isVisible: !mask.trajectory.isVisible
          }
        } : mask
      );
      
      // Set the new array directly
      setSegmentedMasks(updatedMasks);
    }

    if (editor?.canvas) {
      const mask = segmentedMasks.find(m => m.url === maskUrl);
      
      if (mask?.trajectory?.points) {
        if (activeAnimations[maskUrl]) {
          activeAnimations[maskUrl].stop();
          setActiveAnimations(prev => {
            const newAnimations = { ...prev };
            delete newAnimations[maskUrl];
            return newAnimations;
          });
        } else {
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
      const updatedMasks = segmentedMasks.map(mask => 
        mask.url === maskUrl ? {
          ...mask,
          trajectory: undefined
        } : mask
      );
      setSegmentedMasks(updatedMasks);
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

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
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
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <ScrollArea>
        <div className="p-4 space-y-4 border-b">
          <Label className="text-sm">
            Animated Objects 
          </Label>
          
          {/* Add loading and status indicator */}
          <div className="mt-4 space-y-2">
            {samWorkerLoading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{status}</span>
              </div>
            )}
            {!samWorkerLoading && status && (
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
                    disabled={samWorkerLoading}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Mask
                  </Button>
                )}
              </div>
            </div>

            {/* Empty state message */}
            {segmentedMasks.length === 0 && (
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
                  <h4 className="text-base font-medium text-foreground">No animations yet</h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    Create your first object by clicking &quot;New Mask&quot; above to start segmenting content.
                  </p>
                </div>
              </div>
            )}

            {/* Show saved masks */}
            {segmentedMasks
              .filter(mask => !mask.inProgress && mask.url)
              .map((mask, index) => {
                // Get the actual index in the full array
                const actualIndex = segmentedMasks.findIndex(m => m.url === mask.url);
                
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
                    <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-2">
                      <div className="flex items-center space-x-2 cursor-pointer select-none" 
                          onClick={() => {
                            if (editor) {
                              const updatedMasks = segmentedMasks.map((m, i) => 
                                m.url === mask.url ? { ...m, isTextDetailsOpen: !m.isTextDetailsOpen } : m
                              );
                              setSegmentedMasks(updatedMasks);
                            }
                          }}>
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${mask.isTextDetailsOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="text-sm font-medium">Text Details</span>
                        <span className="text-sm text-muted-foreground">(optional)</span>
                      </div>
                      {mask.isTextDetailsOpen && (
                        <div className="mt-2">
                          <textarea
                            className="w-full p-2 text-sm border rounded-md min-h-[60px] resize-y"
                            placeholder="Add specific object motion details to help with generation"
                            value={mask.textDetails || ""}
                            onChange={(e) => {
                              if (editor) {
                                const updatedMasks = segmentedMasks.map((m, i) => 
                                  m.url === mask.url ? { ...m, textDetails: e.target.value } : m
                                );
                                setSegmentedMasks(updatedMasks);
                              }
                            }}
                            rows={2}
                          />
                        </div>
                      )}
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
    </aside>
  );
};
  