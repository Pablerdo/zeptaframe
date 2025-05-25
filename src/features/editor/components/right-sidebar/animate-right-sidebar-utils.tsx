import { useState } from "react";
import { 
  SegmentedMask,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/features/editor/types";
import { Button } from "@/components/ui/button";

// Rotation Timeline Component
export interface RotationTimelineProps {
  mask: SegmentedMask;
  onRotationChange: (rotationKeyframes: RotationKeyframe[]) => void;
  disabled: boolean;
}

export const RotationTimeline = ({ mask, onRotationChange, disabled }: RotationTimelineProps) => {
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number>(-1);
  
  const keyframes = mask.rotationKeyframes || [];
  
  const addKeyframe = (progress: number) => {
    if (disabled) return;
    
    const newKeyframe: RotationKeyframe = {
      trajectoryProgress: progress,
      rotation: 0
    };
    
    const updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
    onRotationChange(updatedKeyframes);
  };
  
  const updateKeyframe = (index: number, progress: number, rotation: number) => {
    if (disabled) return;
    
    const updatedKeyframes = [...keyframes];
    updatedKeyframes[index] = { trajectoryProgress: progress, rotation };
    updatedKeyframes.sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
    onRotationChange(updatedKeyframes);
  };
  
  const deleteKeyframe = (index: number) => {
    if (disabled) return;
    
    const updatedKeyframes = keyframes.filter((_, i) => i !== index);
    onRotationChange(updatedKeyframes);
    setSelectedKeyframeIndex(-1);
  };
  
  const addPresetSpin = () => {
    if (disabled) return;
    
    const spinKeyframes: RotationKeyframe[] = [
      { trajectoryProgress: 0, rotation: 0 },
      { trajectoryProgress: 1, rotation: 360 }
    ];
    onRotationChange(spinKeyframes);
  };
  
  const addPresetWobble = () => {
    if (disabled) return;
    
    const wobbleKeyframes: RotationKeyframe[] = [
      { trajectoryProgress: 0, rotation: 0 },
      { trajectoryProgress: 0.25, rotation: 30 },
      { trajectoryProgress: 0.5, rotation: 0 },
      { trajectoryProgress: 0.75, rotation: -30 },
      { trajectoryProgress: 1, rotation: 0 }
    ];
    onRotationChange(wobbleKeyframes);
  };
  
  const resetRotation = () => {
    if (disabled) return;
    onRotationChange([]);
    setSelectedKeyframeIndex(-1);
  };
  
  return (
    <div className={`border rounded-md p-2 bg-gray-50 dark:bg-gray-800 ${disabled ? 'opacity-50' : ''}`}>
      {/* Timeline SVG */}
      <div className="mb-3">
        <svg
          width="100%"
          height="80"
          viewBox="0 0 280 80"
          className="border rounded bg-white dark:bg-gray-900"
        >

          {/* Rotation value lines */}
          <line x1="20" y1="10" x2="260" y2="10" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="20" y1="40" x2="260" y2="40" stroke="#6b7280" strokeWidth="1" />
          <line x1="20" y1="70" x2="260" y2="70" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
          
          {/* Labels */}
          <text x="5" y="15" fontSize="10" fill="currentColor">180°</text>
          <text x="12" y="45" fontSize="10" fill="currentColor">0°</text>
          <text x="0" y="75" fontSize="10" fill="currentColor">-180°</text>
          

          {/* Interpolated spline line connecting keyframes */}
          {(() => {
            if (keyframes.length === 0) {
              // Default horizontal line at 0 degrees
              return (
                <line 
                  x1="20" 
                  y1="40" 
                  x2="260" 
                  y2="40" 
                  stroke="#8b5cf6" 
                  strokeWidth="2" 
                  opacity="0.3"
                />
              );
            }
            
            // Sort keyframes by trajectory progress to ensure proper ordering
            const sortedKeyframes = [...keyframes].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
            
            if (sortedKeyframes.length === 1) {
              // Single horizontal line at the keyframe's rotation value
              const y = 40 - (sortedKeyframes[0].rotation / 180) * 30;
              const clampedY = Math.max(0, Math.min(80, y));
              return (
                <line 
                  x1="20" 
                  y1={clampedY} 
                  x2="260" 
                  y2={clampedY} 
                  stroke="#8b5cf6" 
                  strokeWidth="2" 
                  opacity="0.3"
                />
              );
            }
            
            // Create interpolated points for the spline
            const splinePoints: Array<{x: number, y: number}> = [];
            
            // Add starting point if first keyframe isn't at progress 0
            if (sortedKeyframes[0].trajectoryProgress > 0) {
              const startY = 40 - (sortedKeyframes[0].rotation / 180) * 30;
              splinePoints.push({
                x: 20,
                y: Math.max(0, Math.min(80, startY))
              });
            }
            
            // Add all sorted keyframes
            sortedKeyframes.forEach(keyframe => {
              const x = 20 + (keyframe.trajectoryProgress * 240);
              const y = 40 - (keyframe.rotation / 180) * 30;
              splinePoints.push({
                x,
                y: Math.max(0, Math.min(80, y))
              });
            });
            
            // Add ending point if last keyframe isn't at progress 1
            if (sortedKeyframes[sortedKeyframes.length - 1].trajectoryProgress < 1) {
              const endY = 40 - (sortedKeyframes[sortedKeyframes.length - 1].rotation / 180) * 30;
              splinePoints.push({
                x: 260,
                y: Math.max(0, Math.min(80, endY))
              });
            }
            
            // Helper function for Catmull-Rom spline interpolation
            const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
              const t2 = t * t;
              const t3 = t2 * t;
              return 0.5 * (
                2 * p1 +
                (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3
              );
            };
            
            // Create path from points using Catmull-Rom spline
            if (splinePoints.length >= 2) {
              let pathData = `M ${splinePoints[0].x} ${splinePoints[0].y}`;
              
              if (splinePoints.length === 2) {
                // Just a line for two points
                pathData += ` L ${splinePoints[1].x} ${splinePoints[1].y}`;
              } else {
                // Create smooth Catmull-Rom spline through all points
                for (let i = 0; i < splinePoints.length - 1; i++) {
                  // Get the four control points for this segment
                  const p0 = splinePoints[Math.max(0, i - 1)];
                  const p1 = splinePoints[i];
                  const p2 = splinePoints[i + 1];
                  const p3 = splinePoints[Math.min(splinePoints.length - 1, i + 2)];
                  
                  // If at the start or end, duplicate points for continuity
                  const cp0 = i === 0 ? p1 : p0;
                  const cp3 = i === splinePoints.length - 2 ? p2 : p3;
                  
                  // Generate intermediate points along the curve
                  const steps = 20; // Number of intermediate points
                  for (let step = 1; step <= steps; step++) {
                    const t = step / steps;
                    const x = catmullRom(cp0.x, p1.x, p2.x, cp3.x, t);
                    const y = catmullRom(cp0.y, p1.y, p2.y, cp3.y, t);
                    pathData += ` L ${x} ${Math.max(0, Math.min(80, y))}`;
                  }
                }
              }
              
              return (
                <path
                  d={pathData}
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.5"
                />
              );
            }
            
            return null;
          })()}
          
          {/* Keyframes */}
          {keyframes.map((keyframe, index) => {
            const x = 20 + (keyframe.trajectoryProgress * 240);
            const y = 40 - (keyframe.rotation / 180) * 30; // Map -180:180 to 70:10
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={Math.max(0, Math.min(80, y))}
                  r="4"
                  fill={selectedKeyframeIndex === index ? "#3b82f6" : "#8b5cf6"}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-5"
                  onClick={() => setSelectedKeyframeIndex(selectedKeyframeIndex === index ? -1 : index)}
                />
                {selectedKeyframeIndex === index && (
                  <text x={x} y={Math.max(0, Math.min(80, y))} fontSize="8" textAnchor="middle" fill="currentColor">
                    {Math.round(keyframe.rotation)}°
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Click handler for adding keyframes */}
          <rect
            x="0"
            y="0"
            width="280"
            height="80"
            fill="transparent"
            className="cursor-crosshair"
            onClick={(e) => {
              if (disabled) return;
              
              const svg = e.currentTarget.closest('svg');
              if (!svg) return;
              
              // Get the SVG element's bounding rectangle
              const svgRect = svg.getBoundingClientRect();
              
              // Calculate relative position within the actual rendered SVG
              const relativeX = e.clientX - svgRect.left;
              const relativeY = e.clientY - svgRect.top;
              
              // Convert from rendered SVG coordinates to viewBox coordinates
              const svgWidth = svgRect.width;
              const svgHeight = svgRect.height;
              const viewBoxWidth = 280; // From viewBox="0 0 280 80"
              const viewBoxHeight = 80;
              
              const viewBoxX = (relativeX / svgWidth) * viewBoxWidth;
              const viewBoxY = (relativeY / svgHeight) * viewBoxHeight;
              
              // Calculate progress (mapping from x=20 to x=260 as 0 to 1)
              const progress = Math.max(0, Math.min(1, (viewBoxX - 20) / 240));
              
              // Calculate rotation value based on Y position (mapping from y=70 to y=10 as -180 to 180)
              const rotationValue = 180 - ((viewBoxY - 10) / 60) * 360;
              const clampedRotation = Math.max(-180, Math.min(180, rotationValue));
              
              // Add keyframe with calculated values
              const newKeyframe: RotationKeyframe = {
                trajectoryProgress: progress,
                rotation: clampedRotation
              };
              
              const updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
              onRotationChange(updatedKeyframes);
            }}
          />
        </svg>
      </div>
      
      {/* Controls */}
      <div className="space-y-2">
        {selectedKeyframeIndex >= 0 && (
          <div className="flex items-center justify-between text-xs">
            <span>Selected: {Math.round(keyframes[selectedKeyframeIndex].trajectoryProgress * 100)}% → {Math.round(keyframes[selectedKeyframeIndex].rotation)}°</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteKeyframe(selectedKeyframeIndex)}
              disabled={disabled}
              className="h-6 px-2"
            >
              Delete
            </Button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={addPresetSpin}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Spin
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addPresetWobble}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Wobble
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetRotation}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};

// Scale Timeline Component
export interface ScaleTimelineProps {
  mask: SegmentedMask;
  onScaleChange: (scaleKeyframes: ScaleKeyframe[]) => void;
  disabled: boolean;
}

export const ScaleTimeline = ({ mask, onScaleChange, disabled }: ScaleTimelineProps) => {
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number>(-1);
  
  const keyframes = mask.scaleKeyframes || [];
  
  const addKeyframe = (progress: number) => {
    if (disabled) return;
    
    const newKeyframe: ScaleKeyframe = {
      trajectoryProgress: progress,
      scale: 1.0
    };
    
    const updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
    onScaleChange(updatedKeyframes);
  };
  
  const updateKeyframe = (index: number, progress: number, scale: number) => {
    if (disabled) return;
    
    const updatedKeyframes = [...keyframes];
    updatedKeyframes[index] = { trajectoryProgress: progress, scale };
    updatedKeyframes.sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
    onScaleChange(updatedKeyframes);
  };
  
  const deleteKeyframe = (index: number) => {
    if (disabled) return;
    
    const updatedKeyframes = keyframes.filter((_, i) => i !== index);
    onScaleChange(updatedKeyframes);
    setSelectedKeyframeIndex(-1);
  };
  
  const addPresetGrow = () => {
    if (disabled) return;
    
    const growKeyframes: ScaleKeyframe[] = [
      { trajectoryProgress: 0, scale: 1.0 },
      { trajectoryProgress: 1, scale: 2.0 }
    ];
    onScaleChange(growKeyframes);
  };
  
  const addPresetShrink = () => {
    if (disabled) return;
    
    const shrinkKeyframes: ScaleKeyframe[] = [
      { trajectoryProgress: 0, scale: 1.0 },
      { trajectoryProgress: 1, scale: 0.3 }
    ];
    onScaleChange(shrinkKeyframes);
  };
  
  const addPresetPulse = () => {
    if (disabled) return;
    
    const pulseKeyframes: ScaleKeyframe[] = [
      { trajectoryProgress: 0, scale: 1.0 },
      { trajectoryProgress: 0.5, scale: 1.5 },
      { trajectoryProgress: 1, scale: 1.0 }
    ];
    onScaleChange(pulseKeyframes);
  };
  
  const resetScale = () => {
    if (disabled) return;
    onScaleChange([]);
    setSelectedKeyframeIndex(-1);
  };
  
  return (
    <div className={`border rounded-md p-2 bg-gray-50 dark:bg-gray-800 ${disabled ? 'opacity-50' : ''}`}>
      {/* Timeline SVG */}
      <div className="mb-3">
        <svg
          width="100%"
          height="80"
          viewBox="0 0 280 80"
          className="border rounded bg-white dark:bg-gray-900"
        >

          {/* Scale value lines */}
          <line x1="20" y1="10" x2="260" y2="10" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="20" y1="40" x2="260" y2="40" stroke="#6b7280" strokeWidth="1" />
          <line x1="20" y1="70" x2="260" y2="70" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" />
          
          {/* Labels */}
          <text x="0" y="15" fontSize="10" fill="currentColor">230%</text>
          <text x="0" y="45" fontSize="10" fill="currentColor">100%</text>
          <text x="5" y="75" fontSize="10" fill="currentColor">20%</text>
          
          {/* Interpolated spline line connecting keyframes */}
          {(() => {
            if (keyframes.length === 0) {
              // Default horizontal line at 100% scale (1.0)
              return (
                <line 
                  x1="20" 
                  y1="40" 
                  x2="260" 
                  y2="40" 
                  stroke="#10b981" 
                  strokeWidth="2" 
                  opacity="0.3"
                />
              );
            }
            
            // Sort keyframes by trajectory progress to ensure proper ordering
            const sortedKeyframes = [...keyframes].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
            
            if (sortedKeyframes.length === 1) {
              // Single horizontal line at the keyframe's scale value
              const y = 70 - ((sortedKeyframes[0].scale - 0.2) / 2.1) * 60;
              const clampedY = Math.max(10, Math.min(70, y));
              return (
                <line 
                  x1="20" 
                  y1={clampedY} 
                  x2="260" 
                  y2={clampedY} 
                  stroke="#10b981" 
                  strokeWidth="4" 
                  opacity="0.4"
                />
              );
            }
            
            // Create interpolated points for the spline
            const splinePoints: Array<{x: number, y: number}> = [];
            
            // Add starting point if first keyframe isn't at progress 0
            if (sortedKeyframes[0].trajectoryProgress > 0) {
              const startY = 70 - ((sortedKeyframes[0].scale - 0.2) / 2.1) * 60;
              splinePoints.push({
                x: 20,
                y: Math.max(10, Math.min(70, startY))
              });
            }
            
            // Add all sorted keyframes
            sortedKeyframes.forEach(keyframe => {
              const x = 20 + (keyframe.trajectoryProgress * 240);
              const y = 70 - ((keyframe.scale - 0.2) / 2.1) * 60;
              splinePoints.push({
                x,
                y: Math.max(10, Math.min(70, y))
              });
            });
            
            // Add ending point if last keyframe isn't at progress 1
            if (sortedKeyframes[sortedKeyframes.length - 1].trajectoryProgress < 1) {
              const endY = 70 - ((sortedKeyframes[sortedKeyframes.length - 1].scale - 0.2) / 2.1) * 60;
              splinePoints.push({
                x: 260,
                y: Math.max(10, Math.min(70, endY))
              });
            }
            
            // Helper function for Catmull-Rom spline interpolation
            const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
              const t2 = t * t;
              const t3 = t2 * t;
              return 0.5 * (
                2 * p1 +
                (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3
              );
            };
            
            // Create path from points using Catmull-Rom spline
            if (splinePoints.length >= 2) {
              let pathData = `M ${splinePoints[0].x} ${splinePoints[0].y}`;
              
              if (splinePoints.length === 2) {
                // Just a line for two points
                pathData += ` L ${splinePoints[1].x} ${splinePoints[1].y}`;
              } else {
                // Create smooth Catmull-Rom spline through all points
                for (let i = 0; i < splinePoints.length - 1; i++) {
                  // Get the four control points for this segment
                  const p0 = splinePoints[Math.max(0, i - 1)];
                  const p1 = splinePoints[i];
                  const p2 = splinePoints[i + 1];
                  const p3 = splinePoints[Math.min(splinePoints.length - 1, i + 2)];
                  
                  // If at the start or end, duplicate points for continuity
                  const cp0 = i === 0 ? p1 : p0;
                  const cp3 = i === splinePoints.length - 2 ? p2 : p3;
                  
                  // Generate intermediate points along the curve
                  const steps = 20; // Number of intermediate points
                  for (let step = 1; step <= steps; step++) {
                    const t = step / steps;
                    const x = catmullRom(cp0.x, p1.x, p2.x, cp3.x, t);
                    const y = catmullRom(cp0.y, p1.y, p2.y, cp3.y, t);
                    pathData += ` L ${x} ${Math.max(10, Math.min(70, y))}`;
                  }
                }
              }
              
              return (
                <path
                  d={pathData}
                  stroke="#10b981"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.5"
                />
              );
            }
            
            return null;
          })()}
          
          {/* Keyframes */}
          {keyframes.map((keyframe, index) => {
            const x = 20 + (keyframe.trajectoryProgress * 240);
            // Map scale 0.2:2.3 to y 70:10
            const y = 70 - ((keyframe.scale - 0.2) / 2.1) * 60;
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={Math.max(10, Math.min(70, y))}
                  r="4"
                  fill={selectedKeyframeIndex === index ? "#3b82f6" : "#10b981"}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-5"
                  onClick={() => setSelectedKeyframeIndex(selectedKeyframeIndex === index ? -1 : index)}
                />
                {selectedKeyframeIndex === index && (
                  <text x={x} y={Math.max(10, Math.min(70, y)) - 10} fontSize="8" textAnchor="middle" fill="currentColor">
                    {Math.round(keyframe.scale * 100)}%
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Click handler for adding keyframes */}
          <rect
            x="0"
            y="0"
            width="280"
            height="80"
            fill="transparent"
            className="cursor-crosshair"
            onClick={(e) => {
              if (disabled) return;
              
              const svg = e.currentTarget.closest('svg');
              if (!svg) return;
              
              // Get the SVG element's bounding rectangle
              const svgRect = svg.getBoundingClientRect();
              
              // Calculate relative position within the actual rendered SVG
              const relativeX = e.clientX - svgRect.left;
              const relativeY = e.clientY - svgRect.top;
              
              // Convert from rendered SVG coordinates to viewBox coordinates
              const svgWidth = svgRect.width;
              const svgHeight = svgRect.height;
              const viewBoxWidth = 280; // From viewBox="0 0 280 80"
              const viewBoxHeight = 80;
              
              const viewBoxX = (relativeX / svgWidth) * viewBoxWidth;
              const viewBoxY = (relativeY / svgHeight) * viewBoxHeight;
              
              // Calculate progress (mapping from x=20 to x=260 as 0 to 1)
              const progress = Math.max(0, Math.min(1, (viewBoxX - 20) / 240));
              
              // Calculate scale value based on Y position (mapping from y=70 to y=10 as 0.2 to 2.3)
              const scaleValue = 0.2 + (1.0 - (viewBoxY - 10) / 60) * 2.1;
              const clampedScale = Math.max(0.1, Math.min(3.0, scaleValue));
              
              // Add keyframe with calculated values
              const newKeyframe: ScaleKeyframe = {
                trajectoryProgress: progress,
                scale: clampedScale
              };
              
              const updatedKeyframes = [...keyframes, newKeyframe].sort((a, b) => a.trajectoryProgress - b.trajectoryProgress);
              onScaleChange(updatedKeyframes);
            }}
          />
        </svg>
      </div>
      
      {/* Controls */}
      <div className="space-y-2">
        {selectedKeyframeIndex >= 0 && (
          <div className="flex items-center justify-between text-xs">
            <span>Selected: {Math.round(keyframes[selectedKeyframeIndex].trajectoryProgress * 100)}% → {Math.round(keyframes[selectedKeyframeIndex].scale * 100)}%</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteKeyframe(selectedKeyframeIndex)}
              disabled={disabled}
              className="h-6 px-2"
            >
              Delete
            </Button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={addPresetGrow}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Grow
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addPresetShrink}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Shrink
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={addPresetPulse}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Pulse
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetScale}
            disabled={disabled}
            className="h-6 px-2 text-xs"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}; 