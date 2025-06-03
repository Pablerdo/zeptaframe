import { ArrowRightIcon, ArrowLeftIcon, X, ArrowDownIcon, ArrowUpIcon, ZoomIn, ZoomOut, Rotate3d } from "lucide-react";
import { useCallback, useState, useEffect, useRef } from "react";

import { 
  ActiveWorkbenchTool, 
  CameraControl, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { CameraSlider } from "@/components/ui/camera-slider";

interface CameraControlRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  cameraControl: CameraControl;
  setCameraControl: (cameraControl: CameraControl) => void;
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

  const dotVelocityConstant = 0.2;
  const cameraVelocityConstant = 0.35;
  const expansionVelocityConstant = 0.0008; // Controls the speed of expansion/contraction

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const populationRef = useRef<number>(0); // Separate animation frame for dot population
  const dotsRef = useRef<Dot[]>([]);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  
  const [horizontalTruck, setHorizontalTruck] = useState(0); // -1 to 1 (center is 0)
  const [verticalTruck, setVerticalTruck] = useState(0);     // -1 to 1 (center is 0)
  const [zoom, setZoom] = useState(0);                   // -1 to 1 (center is 0)
  const [horizontalPan, setHorizontalPan] = useState(0); // -1 to 1 (center is 0)
  const [verticalPan, setVerticalPan] = useState(0);     // -1 to 1 (center is 0)
  const [maxDotRate, setMaxDotRate] = useState(30);       // Max dots to create/destroy per frame
  
  // Track camera offset (pan) and scale (zoom)
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const lastCameraOffsetRef = useRef({ x: 0, y: 0 });
  const cameraScaleRef = useRef(1);
  
  // Track current velocity with smooth acceleration/deceleration
  const currentVelocityRef = useRef({ x: 0, y: 0 });
  const currentExpansionRateRef = useRef(0); // Track current expansion rate
  
  // Use refs to track target velocity values from sliders (prevents re-renders)
  const targetVelocityRef = useRef({ x: 0, y: 0 });
  const targetExpansionRateRef = useRef(0); // Target expansion rate

  // Configuration for dot generation
  const dotConfigRef = useRef({
    spacing: 8,
    viewMargin: 400, // Extra margin beyond viewport to add dots
    cleanupMargin: 600, // Distance beyond which to remove dots
  });

  // Track visible dots in frame
  const visibleDotsRef = useRef<number>(0);
  const [targetDotsInFrame, setTargetDotsInFrame] = useState(30); // Default target is 30 dots in frame
  const [visibleDotsCount, setVisibleDotsCount] = useState(0);
  const [baseTargetDots, setBaseTargetDots] = useState(30); // Base target dot count before scaling
  const densityFactorRef = useRef(1.0); // Current density factor based on expansion/contraction

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
      color: '#b3d9ff', // Light muted blue color
      opacity: 0.8, // Math.random() * 0.5 + 0.5, // Higher opacity 0.5-1.0
      velocityX: (Math.random() - 0.5) * dotVelocityConstant,
      velocityY: (Math.random() - 0.5) * dotVelocityConstant
    };
  }, [dotVelocityConstant]);
  
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

      console.log("dots", dots);
      
      // Remove dots that are far away
      dots = dots.filter(dot => 
        dot.x >= cleanupMinX && dot.x <= cleanupMaxX && 
        dot.y >= cleanupMinY && dot.y <= cleanupMaxY
      );
      
      // Update dots reference and last camera position
      dotsRef.current = dots;
      lastCameraOffsetRef.current = {...cameraOffset};
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
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, width, height);
    
    // Get current camera state
    const cameraOffset = cameraOffsetRef.current;
    const cameraScale = cameraScaleRef.current;
    
    let visibleDots = 0;
    
    // Draw dots
    dotsRef.current.forEach(dot => {
      // Apply camera offset and scale to the dot position
      const drawX = (dot.x - cameraOffset.x) * cameraScale + width / 2;
      const drawY = (dot.y - cameraOffset.y) * cameraScale + height / 2;
      
      // Check if dot is inside visible area
      const isVisible = drawX >= 0 && drawX <= width && drawY >= 0 && drawY <= height;
      
      // Skip dots outside visible area with some margin
      if (drawX < -20 || drawX > width + 20 || drawY < -20 || drawY > height + 20) {
        return;
      }
      
      // Count dots that are strictly inside the frame (no margin)
      if (isVisible) {
        visibleDots++;
      }
      
      // Set opacity and draw the dot
      ctx.globalAlpha = dot.opacity;
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      // Scale the dot size with camera scale for realistic zoom effect
      const scaledSize = dot.size * cameraScale;
      ctx.arc(drawX, drawY, scaledSize, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Update visible dots count
    visibleDotsRef.current = visibleDots;
    setVisibleDotsCount(visibleDots);
    
    ctx.globalAlpha = 1;
  }, [canvasInitialized]);
  
  // Calculate scaled target dots based on expansion/contraction
  const calculateScaledTargetDots = useCallback((zoomValue: number, baseDots: number) => {
    // Scale factor ranges from 0.5 (at zoom = -1) to 2.0 (at zoom = 1)
    // This creates a dynamic range of 50% to 200% of the base dot count
    const scaleFactor = 1.0 + zoomValue;
    densityFactorRef.current = scaleFactor;
    
    // Calculate scaled target - constrain to reasonable limits
    // Decrease dots during contraction, increase during expansion
    return Math.max(Math.round(baseDots * scaleFactor), 10);
  }, []);

  // Update dot management to handle expansion/contraction differently
  const manageDotPopulation = useCallback(() => {
    if (!canvasInitialized) {
      populationRef.current = requestAnimationFrame(manageDotPopulation);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      populationRef.current = requestAnimationFrame(manageDotPopulation);
      return;
    }
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Get count of dots inside frame
    const dotsInFrame = visibleDotsRef.current;
    
    // Calculate scaled target based on current zoom value
    const scaledTarget = calculateScaledTargetDots(zoom, baseTargetDots);
    
    // Check if we need to adjust dots to match target count
    if (dotsInFrame < scaledTarget) {
      // Need to create more dots
      // Calculate how many dots to add this frame (up to max rate)
      const dotsToAdd = Math.min(maxDotRate, scaledTarget - dotsInFrame);
      const creationProbability = dotsToAdd / 60; // Distribute creation over time (60 fps)
      
      if (Math.random() < creationProbability) {
        // Create random position within the current view
        const viewRangeX = width / cameraScaleRef.current;
        const viewRangeY = height / cameraScaleRef.current;
        
        // Generate a random position within current visible frame
        const randX = cameraOffsetRef.current.x + (Math.random() - 0.5) * viewRangeX * 0.8;
        const randY = cameraOffsetRef.current.y + (Math.random() - 0.5) * viewRangeY * 0.8;
        
        const offsetX = (Math.random() - 0.5) * 6;
        const offsetY = (Math.random() - 0.5) * 6;
        
        // Create new dot
        dotsRef.current.push({
          x: randX + offsetX,
          y: randY + offsetY,
          initialX: randX + offsetX,
          initialY: randY + offsetY,
          size: 2,
          color: '#b3d9ff',
          opacity: 0.1 + Math.random() * 0.2, // Start very transparent
          velocityX: (Math.random() - 0.5) * dotVelocityConstant,
          velocityY: (Math.random() - 0.5) * dotVelocityConstant
        });
      }
    } else if (dotsInFrame > scaledTarget) {
      // Need to remove dots - more aggressive during contraction
      // Calculate how many dots to remove
      const dotsToRemove = Math.min(
        // Use higher removal rate during contraction
        zoom < 0 ? maxDotRate * 2 : maxDotRate, 
        dotsInFrame - scaledTarget
      );
      
      // During contraction, increase removal probability
      const removalBase = Math.max(0.1, zoom < 0 ? Math.abs(zoom) * 0.5 : 0.1);
      const removalProbability = (dotsToRemove / 60) * removalBase;
      
      if (Math.random() < removalProbability && dotsRef.current.length > 10) {
        // Find dots inside the visible frame
        const visibleDots = dotsRef.current.filter(dot => {
          const drawX = (dot.x - cameraOffsetRef.current.x) * cameraScaleRef.current + width / 2;
          const drawY = (dot.y - cameraOffsetRef.current.y) * cameraScaleRef.current + height / 2;
          return drawX >= 0 && drawX <= width && drawY >= 0 && drawY <= height;
        });
        
        if (visibleDots.length > 0) {
          // Prioritize removing dots that are closer to center during contraction
          // This creates a more natural "zooming out" effect
          if (zoom < 0) {
            // Sort by distance from center (closest first)
            visibleDots.sort((a, b) => {
              const aDistSq = Math.pow(a.x - cameraOffsetRef.current.x, 2) + 
                              Math.pow(a.y - cameraOffsetRef.current.y, 2);
              const bDistSq = Math.pow(b.x - cameraOffsetRef.current.x, 2) + 
                              Math.pow(b.y - cameraOffsetRef.current.y, 2);
              return aDistSq - bDistSq;
            });
            
            // Remove dots up to the calculated adjustment number
            /* const dotsToRemove = Math.min(dots, visibleDots.length); */
            
            for (let i = 0; i < dotsToRemove; i++) {
              // Get a dot to remove (prefer center dots during contraction)
              const indexToRemove = zoom < 0 ? i : Math.floor(Math.random() * visibleDots.length);
              const dotToRemove = visibleDots[indexToRemove];
              
              // Remove from visible dots array to avoid selecting it again
              if (zoom >= 0) {
                visibleDots.splice(indexToRemove, 1);
              }
              
              // Find this dot in the main array
              const mainIndex = dotsRef.current.indexOf(dotToRemove);
              if (mainIndex !== -1) {
                // Mark for rapid fading
                dotsRef.current[mainIndex].opacity *= 0.5;
                
                // If almost transparent, remove immediately
                if (dotsRef.current[mainIndex].opacity < 0.1) {
                  dotsRef.current.splice(mainIndex, 1);
                }
              }
            }
          }
        }
      }
      
      // Update dot count occasionally to avoid too many state updates
      setDotCount(dotsRef.current.length);
    }
    
    // Apply normal dot movement and fading
    dotsRef.current.forEach(dot => {
      // Fade in new dots
      if (dot.opacity < 0.8) {
        dot.opacity += 0.01; // Gradually increase opacity for new dots
      }
      
      // Apply subtle random movement to each dot
      dot.x += dot.velocityX;
      dot.y += dot.velocityY;
      
      // Keep dots close to their initial position (elastic effect)
      dot.x += (dot.initialX - dot.x) * 0.03;
      dot.y += (dot.initialY - dot.y) * 0.03;
      
      // Occasionally change velocity slightly
      if (Math.random() < 0.02) {
        dot.velocityX = (Math.random() - 0.5) * dotVelocityConstant;
        dot.velocityY = (Math.random() - 0.5) * dotVelocityConstant;
      }
    });
    
    // Update dot count occasionally to avoid too many state updates
    if (Math.random() < 0.05) {
      setDotCount(dotsRef.current.length);
    }
    
    // Continue dot population management
    populationRef.current = requestAnimationFrame(manageDotPopulation);
  }, [zoom, maxDotRate, canvasInitialized, dotVelocityConstant, baseTargetDots, calculateScaledTargetDots]);

  // Update the maxDotRate handler to set the base target
  const handleMaxDotRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setMaxDotRate(value);
    setBaseTargetDots(value); // Store this as the base (unscaled) target
    
    // Calculate the actual target based on current zoom value
    const scaledTarget = calculateScaledTargetDots(zoom, value);
    setTargetDotsInFrame(scaledTarget);
  };
  
  // Add effect to update target dots when zoom changes
  useEffect(() => {
    // Calculate scaled target dots based on current zoom value
    const scaledTarget = calculateScaledTargetDots(zoom, baseTargetDots);
    setTargetDotsInFrame(scaledTarget);
  }, [zoom, baseTargetDots, calculateScaledTargetDots]);

  // Animate dots - focuses only on movement and expansion/contraction of existing dots
  const animateDots = useCallback(() => {
    // Use the target velocity from refs instead of directly from state
    const targetVelocityX = targetVelocityRef.current.x;
    const targetVelocityY = targetVelocityRef.current.y;
    const targetExpansionRate = targetExpansionRateRef.current;
    
    // Easing factor - smaller value = slower acceleration (range 0-1)
    const easing = 0.02;
    
    // Smoothly transition current velocity toward target
    currentVelocityRef.current.x += (targetVelocityX - currentVelocityRef.current.x) * easing;
    currentVelocityRef.current.y += (targetVelocityY - currentVelocityRef.current.y) * easing;
    
    // Smoothly transition expansion rate toward target with the same easing
    currentExpansionRateRef.current += (targetExpansionRate - currentExpansionRateRef.current) * easing;
    
    // Apply the smoothed velocity to the camera position
    if (Math.abs(currentVelocityRef.current.x) > 0.001 || Math.abs(currentVelocityRef.current.y) > 0.001) {
      cameraOffsetRef.current.x += currentVelocityRef.current.x;
      cameraOffsetRef.current.y += currentVelocityRef.current.y;
    }
    
    // Check if we need to add new dots based on camera position - only when moving camera
    const movementThreshold = 0.5;
    if (Math.abs(currentVelocityRef.current.x) > movementThreshold || 
        Math.abs(currentVelocityRef.current.y) > movementThreshold) {
      updateDots();
    }
    
    // Get current expansion rate
    const expansionRate = currentExpansionRateRef.current;
    
    dotsRef.current.forEach(dot => {
      // Apply expansion/contraction effect
      if (Math.abs(expansionRate) > 0.0001) {
        // Calculate vector from center to dot in world space
        const dotToWorldCenterX = dot.x - cameraOffsetRef.current.x;
        const dotToWorldCenterY = dot.y - cameraOffsetRef.current.y;
        
        // Apply expansion/contraction by moving along this vector
        dot.x += dotToWorldCenterX * expansionRate;
        dot.y += dotToWorldCenterY * expansionRate;
        
        // Also move the initial position to maintain the elastic effect
        dot.initialX += dotToWorldCenterX * expansionRate;
        dot.initialY += dotToWorldCenterY * expansionRate;
      }
      
      // Fade in new dots
      if (dot.opacity < 0.8) {
        dot.opacity += 0.01; // Gradually increase opacity for new dots
      }
      
      // Apply subtle random movement to each dot
      dot.x += dot.velocityX;
      dot.y += dot.velocityY;
      
      // Keep dots close to their initial position (elastic effect)
      dot.x += (dot.initialX - dot.x) * 0.03;
      dot.y += (dot.initialY - dot.y) * 0.03;
      
      // Occasionally change velocity slightly
      if (Math.random() < 0.02) {
        dot.velocityX = (Math.random() - 0.5) * dotVelocityConstant;
        dot.velocityY = (Math.random() - 0.5) * dotVelocityConstant;
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
        
    // Set initial camera position
    cameraOffsetRef.current = { x: 400, y: 300 };
    
    // Create initial dots
    initializeDots();
    
    // Start animations
    animationRef.current = requestAnimationFrame(animateDots);
    populationRef.current = requestAnimationFrame(manageDotPopulation);
    setCanvasInitialized(true);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      cancelAnimationFrame(populationRef.current);
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
            
      // Redraw
      drawDots();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [drawDots]);
  

  
  // Initialize camera position when component mounts
  useEffect(() => {
    // Set initial camera position at center
    cameraOffsetRef.current = { x: 400, y: 300 };
  }, []);
  
  // Handle slider changes
  const handleHorizontalTruckChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setHorizontalTruck(newValue);
    // Reduce multiplier from 2.0 to 1.0 for slower movement
    targetVelocityRef.current.x = newValue * cameraVelocityConstant;
    const updatedCameraControl = { ...cameraControl, horizontalTruck: newValue };
    setCameraControl(updatedCameraControl);
  }, [cameraControl, setCameraControl]);

  const handleVerticalTruckChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setVerticalTruck(newValue);
    // Reduce multiplier from 2.0 to 1.0 for slower movement
    targetVelocityRef.current.y = newValue * -cameraVelocityConstant;
    const updatedCameraControl = { ...cameraControl, verticalTruck: newValue };
    setCameraControl(updatedCameraControl);
  }, [cameraControl, setCameraControl]);

  const handleZoomChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setZoom(newValue);
    
    // Set target expansion rate based on zoom value - same approach as with movement
    targetExpansionRateRef.current = newValue * expansionVelocityConstant;
    
    const updatedCameraControl = { ...cameraControl, zoom: newValue };
    setCameraControl(updatedCameraControl);
  }, [cameraControl, setCameraControl]);

  const handleHorizontalPanChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setHorizontalPan(newValue);
    const updatedCameraControl = { ...cameraControl, horizontalPan: newValue };
    setCameraControl(updatedCameraControl);
  }, [cameraControl, setCameraControl]);

  const handleVerticalPanChange = useCallback((value: number[]) => {
    const newValue = value[0];
    setVerticalPan(newValue);
    const updatedCameraControl = { ...cameraControl, verticalPan: newValue };
    setCameraControl(updatedCameraControl);
  }, [cameraControl, setCameraControl]);

  // Initialize cameraControl with default values
  useEffect(() => {
    if (Object.keys(cameraControl).length === 0) {
      setCameraControl({
        horizontalTruck: 0,
        verticalTruck: 0,
        zoom: 0,
        horizontalPan: 0,
        verticalPan: 0
      });
    } else {
      // Sync local state with props
      const hPan = cameraControl.horizontalTruck || 0;
      const vPan = cameraControl.verticalTruck || 0;
      const zm = cameraControl.zoom || 0;

      // Round to nearest 0.1 step      
      setHorizontalTruck(hPan);
      setVerticalTruck(vPan);
      setZoom(zm);
      setHorizontalPan(cameraControl.horizontalPan || 0);
      setVerticalPan(cameraControl.verticalPan || 0);
      
      // Update target velocity refs with reduced multiplier
      targetVelocityRef.current.x = hPan * cameraVelocityConstant;
      targetVelocityRef.current.y = vPan * -cameraVelocityConstant;
      
      // Initialize expansion rate based on zoom value
      targetExpansionRateRef.current = zm * expansionVelocityConstant;
    }
  }, [cameraControl, setCameraControl]);

  const onClose = () => {
    onChangeActiveWorkbenchTool("select");
  };

  const containerStyle = {
    width: "100%",
    // 3:2 aspect ratio
    height: "180px",
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
          
          {/* Canvas with horizontal slider below */}
          <div className="flex-1 flex flex-col">
            <div style={containerStyle} className="border border-gray-200 dark:border-gray-700">
              <canvas 
                ref={canvasRef}
                className="w-[280px] h-[180px]"
              />
            </div>
            
            {/* Horizontal pan slider under canvas */}
            <div className="mt-2">
              Horizontal
              <CameraSlider
                orientation="horizontal"
                valueDisplay={horizontalTruck}
                label="Horizontal Truck"
                value={[horizontalTruck]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleHorizontalTruckChange}
                onValueDisplayChange={(value) => handleHorizontalTruckChange([value])}
                showEndIcons
                leftIcon={<ArrowLeftIcon className="h-5 w-5" />}
                rightIcon={<ArrowRightIcon className="h-5 w-5"/>}
              />
            </div>
            <div className="mt-2">
              Vertical
              <CameraSlider
                orientation="horizontal"
                valueDisplay={verticalTruck}
                label="Vertical Truck"
                value={[verticalTruck]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleVerticalTruckChange}
                onValueDisplayChange={(value) => handleVerticalTruckChange([value])}
                showEndIcons
                leftIcon={<ArrowDownIcon className="h-5 w-5"/>}
                rightIcon={<ArrowUpIcon className="h-5 w-5"/>}
              />
            </div>
            <div className="mt-2">
              Zoom
              <CameraSlider
                orientation="horizontal"
                valueDisplay={Number(zoom.toFixed(1))}
                label="Zoom"
                value={[zoom]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleZoomChange}
                onValueDisplayChange={(value) => handleZoomChange([value])}
                showEndIcons
                leftIcon={<ZoomOut className="h-5 w-5"/>}
                rightIcon={<ZoomIn className="h-5 w-5"/>}
              />
            </div>
          
            {/* <div className="mt-2 opacity-50 pointer-events-none">
              Horizontal Pan
              <CameraSlider
                orientation="horizontal"
                valueDisplay={horizontalPan}
                label="Horizontal Pan"
                value={[horizontalPan]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleHorizontalPanChange}
                onValueDisplayChange={(value) => handleHorizontalPanChange([value])}
                showEndIcons
                leftIcon={<Rotate3d className="h-5 w-5"/>}
                rightIcon={<Rotate3d className="h-5 w-5"/>}
                disabled
              />
            </div>
            <div className="mt-2 opacity-50 pointer-events-none">
              Vertical Pan
              <CameraSlider
                orientation="horizontal"
                valueDisplay={verticalPan}
                label="Vertical Pan"
                value={[verticalPan]}
                min={-1}
                max={1}
                step={0.1}
                onValueChange={handleVerticalPanChange}
                onValueDisplayChange={(value) => handleVerticalPanChange([value])}
                showEndIcons
                leftIcon={<Rotate3d className="h-5 w-5"/>}
                rightIcon={<Rotate3d className="h-5 w-5"/>}
                disabled
              />
            </div> */}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 mt-4">
        {/* Commented out Max Dot Rate Slider 
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm">Max Dots per Frame</label>
            <span className="text-sm font-medium">{maxDotRate}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1000"
            step="1"
            value={maxDotRate}
            onChange={handleMaxDotRateChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">Slow</span>
            <span className="text-xs text-gray-500">Fast</span>
          </div>
          <div className="mt-2 text-xs text-gray-600 flex items-center justify-between">
            <span>Current dot count: {dotCount}</span>
            <span className="text-blue-500">
              Dots in frame: {visibleDotsCount}/{targetDotsInFrame}
            </span>
          </div>
        </div>
        */}

        {/* Save button right after dot rate slider */}
        {/* <button
          className="w-full px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 rounded-md transition-colors"
          onClick={() => {}}
        >
          <span className="font-bold">Save Camera Control</span> 
        </button> */}
      </div>

    </aside>
  );
};
  