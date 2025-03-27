import { X } from "lucide-react";
import { useCallback, useState, useEffect, useRef } from "react";

import { 
  ActiveWorkbenchTool, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { CameraSlider } from "@/components/ui/camera-slider";
import { CameraSliderVertical } from "@/components/ui/camera-slider-vertical";

interface CameraControlRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  cameraControl: Record<string, any>;
  setCameraControl: (cameraControl: Record<string, any>) => void;
};

interface Dot {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  velocityX: number;
  velocityY: number;
  initialX: number;
  initialY: number;
}

export const CameraControlRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  cameraControl,
  setCameraControl,
}: CameraControlRightSidebarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const dotsRef = useRef<Dot[]>([]);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  
  const [horizontalPan, setHorizontalPan] = useState(0); // -1 to 1 (center is 0)
  const [verticalPan, setVerticalPan] = useState(0);     // -1 to 1 (center is 0)
  const [zoom, setZoom] = useState(50);                  // 0 to 100 (default is 50)
  
  // Track camera offset (pan) and scale (zoom)
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const lastCameraOffsetRef = useRef({ x: 0, y: 0 });
  const cameraScaleRef = useRef(1);
  
  // Track current velocity with smooth acceleration/deceleration
  const currentVelocityRef = useRef({ x: 0, y: 0 });
  
  // Use refs to track target velocity values from sliders (prevents re-renders)
  const targetVelocityRef = useRef({ x: 0, y: 0 });

  // Configuration for dot generation
  const dotConfigRef = useRef({
    spacing: 16,
    viewMargin: 400, // Extra margin beyond viewport to add dots
    cleanupMargin: 600, // Distance beyond which to remove dots
  });

  // Create a single dot with specified properties
  const createDot = useCallback((x: number, y: number) => {
    // Add some randomness to dot positions
    const offsetX = (Math.random() - 0.5) * 6;
    const offsetY = (Math.random() - 0.5) * 6;
    
    return {
      x: x + offsetX,
      y: y + offsetY,
      initialX: x + offsetX,
      initialY: y + offsetY,
      size: 2, // Math.random() * 1.8 + 1.2, // Slightly larger dots: Size between 1.2-3
      color: '#ffffff', // Mix in some blue dots
      opacity: 1,// Math.random() * 0.5 + 0.5, // Higher opacity 0.5-1.0
      velocityX: (Math.random() - 0.5) * 0.4,
      velocityY: (Math.random() - 0.5) * 0.4
    };
  }, []);
  
  // Generate dots in a specified rectangular area
  const generateDotsInArea = useCallback((minX: number, maxX: number, minY: number, maxY: number) => {
    const newDots: Dot[] = [];
    const { spacing } = dotConfigRef.current;
    
    // Round to nearest spacing to maintain grid alignment
    const startX = Math.floor(minX / spacing) * spacing;
    const startY = Math.floor(minY / spacing) * spacing;
    const endX = Math.ceil(maxX / spacing) * spacing;
    const endY = Math.ceil(maxY / spacing) * spacing;
    
    // Create dots in a grid pattern
    for (let x = startX; x <= endX; x += spacing) {
      for (let y = startY; y <= endY; y += spacing) {
        newDots.push(createDot(x, y));
      }
    }
    
    return newDots;
  }, [createDot]);
  
  // Initialize the dots around the initial camera position
  const initializeDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const { viewMargin } = dotConfigRef.current;
    const cameraOffset = cameraOffsetRef.current;
    const cameraScale = cameraScaleRef.current;
    
    // Calculate the viewport boundaries in world coordinates
    const viewportMinX = cameraOffset.x - (width / 2 + viewMargin) / cameraScale;
    const viewportMaxX = cameraOffset.x + (width / 2 + viewMargin) / cameraScale;
    const viewportMinY = cameraOffset.y - (height / 2 + viewMargin) / cameraScale;
    const viewportMaxY = cameraOffset.y + (height / 2 + viewMargin) / cameraScale;
    
    // Generate initial dots
    const dots = generateDotsInArea(viewportMinX, viewportMaxX, viewportMinY, viewportMaxY);
    
    console.log(`Initialized ${dots.length} dots`);
    dotsRef.current = dots;
    lastCameraOffsetRef.current = {...cameraOffset};
  }, [generateDotsInArea]);
  
  // Update dots based on camera movement
  const updateDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const cameraOffset = cameraOffsetRef.current;
    const lastCameraOffset = lastCameraOffsetRef.current;
    const cameraScale = cameraScaleRef.current;
    const { viewMargin, cleanupMargin } = dotConfigRef.current;
    
    // Check if camera has moved significantly
    const dx = cameraOffset.x - lastCameraOffset.x;
    const dy = cameraOffset.y - lastCameraOffset.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);
    
    // Only update if camera has moved more than 10% of the view margin
    if (distanceMoved > viewMargin * 0.1) {
      // Calculate the viewport boundaries in world coordinates with margin
      const viewportMinX = cameraOffset.x - (width / 2 + viewMargin) / cameraScale;
      const viewportMaxX = cameraOffset.x + (width / 2 + viewMargin) / cameraScale;
      const viewportMinY = cameraOffset.y - (height / 2 + viewMargin) / cameraScale;
      const viewportMaxY = cameraOffset.y + (height / 2 + viewMargin) / cameraScale;
      
      // Calculate extended cleanup boundaries
      const cleanupMinX = cameraOffset.x - (width / 2 + cleanupMargin) / cameraScale;
      const cleanupMaxX = cameraOffset.x + (width / 2 + cleanupMargin) / cameraScale;
      const cleanupMinY = cameraOffset.y - (height / 2 + cleanupMargin) / cameraScale;
      const cleanupMaxY = cameraOffset.y + (height / 2 + cleanupMargin) / cameraScale;
      
      // Identify areas where new dots need to be generated
      const generateLeftSide = dx < 0 && viewportMinX < lastCameraOffset.x - (width / 2 + viewMargin) / cameraScale;
      const generateRightSide = dx > 0 && viewportMaxX > lastCameraOffset.x + (width / 2 + viewMargin) / cameraScale;
      const generateTopSide = dy < 0 && viewportMinY < lastCameraOffset.y - (height / 2 + viewMargin) / cameraScale;
      const generateBottomSide = dy > 0 && viewportMaxY > lastCameraOffset.y + (height / 2 + viewMargin) / cameraScale;
      
      // Get the current set of dots
      let dots = [...dotsRef.current];
      
      // Generate new dots where needed
      if (generateLeftSide) {
        const newArea = generateDotsInArea(
          viewportMinX,
          lastCameraOffset.x - (width / 2 + viewMargin) / cameraScale,
          viewportMinY,
          viewportMaxY
        );
        dots = [...dots, ...newArea];
      }
      
      if (generateRightSide) {
        const newArea = generateDotsInArea(
          lastCameraOffset.x + (width / 2 + viewMargin) / cameraScale,
          viewportMaxX,
          viewportMinY,
          viewportMaxY
        );
        dots = [...dots, ...newArea];
      }
      
      if (generateTopSide) {
        const leftX = generateLeftSide ? viewportMinX : lastCameraOffset.x - (width / 2 + viewMargin) / cameraScale;
        const rightX = generateRightSide ? viewportMaxX : lastCameraOffset.x + (width / 2 + viewMargin) / cameraScale;
        const newArea = generateDotsInArea(
          leftX,
          rightX,
          viewportMinY,
          lastCameraOffset.y - (height / 2 + viewMargin) / cameraScale
        );
        dots = [...dots, ...newArea];
      }
      
      if (generateBottomSide) {
        const leftX = generateLeftSide ? viewportMinX : lastCameraOffset.x - (width / 2 + viewMargin) / cameraScale;
        const rightX = generateRightSide ? viewportMaxX : lastCameraOffset.x + (width / 2 + viewMargin) / cameraScale;
        const newArea = generateDotsInArea(
          leftX,
          rightX,
          lastCameraOffset.y + (height / 2 + viewMargin) / cameraScale,
          viewportMaxY
        );
        dots = [...dots, ...newArea];
      }
      
      // Remove dots that are far away
      dots = dots.filter(dot => 
        dot.x >= cleanupMinX && dot.x <= cleanupMaxX && 
        dot.y >= cleanupMinY && dot.y <= cleanupMaxY
      );
      
      // Update dots reference and last camera position
      dotsRef.current = dots;
      lastCameraOffsetRef.current = {...cameraOffset};
      
      console.log(`Updated dots: ${dots.length} total after camera movement`);
    }
  }, [generateDotsInArea]);
  
  // Draw dots on the canvas
  const drawDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);
    
    // Get current camera state
    const cameraOffset = cameraOffsetRef.current;
    const cameraScale = cameraScaleRef.current;
    
    let visibleDots = 0;
    
    // Draw dots
    dotsRef.current.forEach(dot => {
      // Apply camera offset and scale to the dot
      const drawX = (dot.x - cameraOffset.x) * cameraScale + width / 2;
      const drawY = (dot.y - cameraOffset.y) * cameraScale + height / 2;
      
      // Skip dots outside visible area (with some margin)
      if (drawX < -20 || drawX > width + 20 || drawY < -20 || drawY > height + 20) {
        return;
      }
      
      visibleDots++;
      
      // Set opacity and draw the dot
      ctx.globalAlpha = dot.opacity;
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(drawX, drawY, dot.size * cameraScale, 0, Math.PI * 2);
      ctx.fill();
    });
    
    if (canvasInitialized && visibleDots === 0) {
      console.log(`No visible dots. Camera: ${JSON.stringify(cameraOffset)}, Scale: ${cameraScale}, Total dots: ${dotsRef.current.length}`);
    }
    
    ctx.globalAlpha = 1;
  }, [canvasInitialized]);
  
  // Animate dots - remove horizontalPan and verticalPan from dependency array
  const animateDots = useCallback(() => {
    // Use the target velocity from refs instead of directly from state
    const targetVelocityX = targetVelocityRef.current.x;
    const targetVelocityY = targetVelocityRef.current.y;
    
    // Easing factor - smaller value = slower acceleration (range 0-1)
    // 0.01 means it takes roughly 300 frames (5 seconds at 60fps) to reach ~95% of target velocity
    const easing = 0.02;
    
    // Smoothly transition current velocity toward target
    currentVelocityRef.current.x += (targetVelocityX - currentVelocityRef.current.x) * easing;
    currentVelocityRef.current.y += (targetVelocityY - currentVelocityRef.current.y) * easing;
    
    // Apply the smoothed velocity to the camera position
    if (Math.abs(currentVelocityRef.current.x) > 0.001 || Math.abs(currentVelocityRef.current.y) > 0.001) {
      cameraOffsetRef.current.x += currentVelocityRef.current.x;
      cameraOffsetRef.current.y += currentVelocityRef.current.y;
    }
    
    // Check if we need to add new dots based on camera position
    updateDots();
    
    dotsRef.current.forEach(dot => {
      // Apply subtle random movement to each dot
      dot.x += dot.velocityX;
      dot.y += dot.velocityY;
      
      // Keep dots close to their initial position (elastic effect)
      dot.x += (dot.initialX - dot.x) * 0.03;
      dot.y += (dot.initialY - dot.y) * 0.03;
      
      // Occasionally change velocity slightly
      if (Math.random() < 0.02) {
        dot.velocityX = (Math.random() - 0.5) * 0.4;
        dot.velocityY = (Math.random() - 0.5) * 0.4;
      }
    });
    
    // Draw the updated dots
    drawDots();
    
    // Continue animation
    animationRef.current = requestAnimationFrame(animateDots);
  }, [drawDots, updateDots]);
  
  // Initialize canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas dimensions - the visual size is set via CSS
    canvas.width = canvas.clientWidth || 300;
    canvas.height = canvas.clientHeight || 200;
    
    console.log(`Canvas initialized: ${canvas.width}x${canvas.height}`);
    
    // Set initial camera position
    cameraOffsetRef.current = { x: 400, y: 300 };
    
    // Create initial dots
    initializeDots();
    
    // Start animation
    animationRef.current = requestAnimationFrame(animateDots);
    setCanvasInitialized(true);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [initializeDots, animateDots]);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Update canvas dimensions
      canvas.width = canvas.clientWidth || 300;
      canvas.height = canvas.clientHeight || 200;
      
      console.log(`Canvas resized: ${canvas.width}x${canvas.height}`);
      
      // Redraw
      drawDots();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [drawDots]);
  
  // Update camera position based on sliders - only set initial position now
  useEffect(() => {
    // Calculate camera scale based on zoom only
    const scale = 0.5 + (zoom / 100) * 1.5;
    
    // Update camera scale
    cameraScaleRef.current = scale;
    
    // No need to explicitly call drawDots() here as it's done in the animation loop
  }, [zoom]);
  
  // Initialize camera position when component mounts
  useEffect(() => {
    // Set initial camera position at center
    cameraOffsetRef.current = { x: 400, y: 300 };
  }, []);
  
  // Handle slider changes
  const handleHorizontalPanChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setHorizontalPan(newValue);
    // Reduce multiplier from 2.0 to 1.0 for slower movement
    targetVelocityRef.current.x = newValue * 0.5;
    setCameraControl((prev: Record<string, any>) => ({ ...prev, horizontalPan: newValue }));
  }, [setCameraControl]);

  const handleVerticalPanChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setVerticalPan(newValue);
    // Reduce multiplier from 2.0 to 1.0 for slower movement
    targetVelocityRef.current.y = newValue * -0.5;
    setCameraControl((prev: Record<string, any>) => ({ ...prev, verticalPan: newValue }));
  }, [setCameraControl]);

  const handleZoomChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setZoom(newValue);
    setCameraControl((prev: Record<string, any>) => ({ ...prev, zoom: newValue }));
  }, [setCameraControl]);

  // Initialize cameraControl with default values
  useEffect(() => {
    if (Object.keys(cameraControl).length === 0) {
      setCameraControl({
        horizontalPan: 0,
        verticalPan: 0,
        zoom: 50
      });
    } else {
      // Sync local state with props
      const hPan = cameraControl.horizontalPan || 0;
      const vPan = cameraControl.verticalPan || 0;
      setHorizontalPan(hPan);
      setVerticalPan(vPan);
      setZoom(cameraControl.zoom || 50);
      
      // Update target velocity refs with reduced multiplier
      targetVelocityRef.current.x = hPan * 0.5;
      targetVelocityRef.current.y = vPan * -0.5;
    }
  }, [cameraControl, setCameraControl]);

  const onClose = () => {
    onChangeActiveWorkbenchTool("select");
  };

  const containerStyle = {
    width: "100%",
    // 3:2 aspect ratio
    height: "200px",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "5px"
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
        activeWorkbenchTool === "camera-control" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Camera Control"
          description="Adjust camera movement"
        />
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X className="h-5 w-5 text-gray-600 dark:text-gray-100" />
        </button>
      </div>
      
      {/* New layout with sliders positioned around canvas */}
      <div className="px-4 py-2">
        <div className="flex gap-4">
          {/* Vertical pan slider on the left */}
          <div className="h-[150px] flex flex-col justify-center">
            <CameraSliderVertical
              orientation="vertical"
              valueDisplay={verticalPan}
              label="Vertical"
              value={[verticalPan]}
              min={-1}
              max={1}
              step={0.1}
              onValueChange={handleVerticalPanChange}
              onValueDisplayChange={(value) => handleVerticalPanChange([value])}
              showEndIcons
            />
          </div>
          
          {/* Canvas with horizontal slider below */}
          <div className="flex-1 flex flex-col h-[190px]">
            <div style={containerStyle} className="border border-gray-200 dark:border-gray-700">
              <canvas 
                ref={canvasRef}
                className="w-[223px] h-[149px]"
              />
            </div>
            
            {/* Horizontal pan slider under canvas */}
            <div className="mt-2">
              <CameraSlider
                orientation="horizontal"
                valueDisplay={horizontalPan}
                label="Horizontal"
                value={[horizontalPan]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleHorizontalPanChange}
                onValueDisplayChange={(value) => handleHorizontalPanChange([value])}
                showEndIcons
              />
            </div>
          </div>
        </div>
      </div>

      {/* Zoom slider stays in original position for now */}
      <div className="px-4 py-2 mt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Zoom
        </label>
        <Slider
          defaultValue={[50]}
          value={[zoom]}
          min={1}
          max={100}
          step={1}
          onValueChange={handleZoomChange}
          className="mb-6"
        />

        {/* Save button right after zoom slider */}
        <button
          className="w-full px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 rounded-md transition-colors"
          onClick={() => {}}
        >
          <span className="font-bold">Save Camera Control</span> 
        </button>
      </div>

    </aside>
  );
};
  