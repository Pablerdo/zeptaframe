import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Coordinate, CoordinatePath } from "@/features/editor/types";

interface Point {
  x: number;
  y: number;
}

interface SplineCanvasProps {
  width?: number;
  height?: number;
  coordinates: Coordinate[] | undefined;
  onChange?: (path: CoordinatePath) => void;
}

export const SplineCanvas = ({ 
  width = 360, 
  height = 240,
  coordinates,
  onChange 
}: SplineCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startPoint, setStartPoint] = useState<Point>(coordinates?.[0] || { x: 50, y: 120 });
  const [endPoint, setEndPoint] = useState<Point>(coordinates?.[coordinates.length - 1] || { x: 310, y: 120 });

  useEffect(() => {
    if (coordinates) {
      setStartPoint(coordinates[0]);
      setEndPoint(coordinates[coordinates.length - 1]);
    }
  }, [coordinates]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1f2937'; // Dark background
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw arrow
    ctx.strokeStyle = '#f97316'; // Orange
    ctx.lineWidth = 2;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    // Draw arrow head
    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
    const arrowLength = 15;
    
    ctx.beginPath();
    ctx.moveTo(endPoint.x, endPoint.y);
    ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle - Math.PI / 6),
      endPoint.y - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endPoint.x, endPoint.y);
    ctx.lineTo(
      endPoint.x - arrowLength * Math.cos(angle + Math.PI / 6),
      endPoint.y - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  useEffect(() => {
    drawCanvas();
  }, [startPoint, endPoint]);

//   const handlePointChange = (newStart: Point, newEnd: Point) => {
//     onChange?.({ start: newStart, end: newEnd });
//   };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Start Point</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={startPoint.x}
              onChange={(e) => {
                const newStart = { ...startPoint, x: Number(e.target.value) };
                setStartPoint(newStart);
                // handlePointChange(newStart, endPoint);
              }}
              className="w-20"
              placeholder="X"
            />
            <Input
              type="number"
              value={startPoint.y}
              onChange={(e) => {
                const newStart = { ...startPoint, y: Number(e.target.value) };
                setStartPoint(newStart);
                // handlePointChange(newStart, endPoint);
              }}
              className="w-20"
              placeholder="Y"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">End Point</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={endPoint.x}
              onChange={(e) => {
                const newEnd = { ...endPoint, x: Number(e.target.value) };
                setEndPoint(newEnd);
                // handlePointChange(startPoint, newEnd);
              }}
              className="w-20"
              placeholder="X"
            />
            <Input
              type="number"
              value={endPoint.y}
              onChange={(e) => {
                const newEnd = { ...endPoint, y: Number(e.target.value) };
                setEndPoint(newEnd);
                // handlePointChange(startPoint, newEnd);
              }}
              className="w-20"
              placeholder="Y"
            />
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-zinc-700 rounded-md"
      />
    </div>
  );
};
