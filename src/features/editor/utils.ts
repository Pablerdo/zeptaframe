import { uuid } from "uuidv4";
import { fabric } from "fabric";
import type { RGBColor } from "react-color";

export function transformText(objects: any) {
  if (!objects) return;

  objects.forEach((item: any) => {
    if (item.objects) {
      transformText(item.objects);
    } else {
      item.type === "text" && (item.type === "textbox");
    }
  });
};

export function downloadFile(file: string, type: string) {
  const anchorElement = document.createElement("a");

  anchorElement.href = file;
  anchorElement.download = `${uuid()}.${type}`;
  document.body.appendChild(anchorElement);
  anchorElement.click();
  anchorElement.remove();
};

export function isTextType(type: string | undefined) {
  return type === "text" || type === "i-text" || type === "textbox";
};

export function rgbaObjectToString(rgba: RGBColor | "transparent") {
  if (rgba === "transparent") {
    return `rgba(0,0,0,0)`;
  }

  const alpha = rgba.a === undefined ? 1 : rgba.a;

  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`;
};

export const createFilter = (value: string) => {
  let effect;

  switch (value) {
    case "greyscale":
      effect = new fabric.Image.filters.Grayscale();
      break;
    case "polaroid":
      // @ts-ignore
      effect = new fabric.Image.filters.Polaroid();
      break;
    case "sepia":
      effect = new fabric.Image.filters.Sepia();
      break;
    case "kodachrome":
      // @ts-ignore
      effect = new fabric.Image.filters.Kodachrome();
      break;
    case "contrast":
      effect = new fabric.Image.filters.Contrast({ contrast: 0.3 });
      break;
    case "brightness":
      effect = new fabric.Image.filters.Brightness({ brightness: 0.8 });
      break;
    case "brownie":
      // @ts-ignore
      effect = new fabric.Image.filters.Brownie();
      break;
    case "vintage":
      // @ts-ignore
      effect = new fabric.Image.filters.Vintage();
      break;
    case "technicolor":
      // @ts-ignore
      effect = new fabric.Image.filters.Technicolor();
      break;
    case "pixelate":
      effect = new fabric.Image.filters.Pixelate();
      break;
    case "invert":
      effect = new fabric.Image.filters.Invert();
      break;
    case "blur":
      effect = new fabric.Image.filters.Blur();
      break;
    case "sharpen":
      effect = new fabric.Image.filters.Convolute({
        matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      });
      break;
    case "emboss":
      effect = new fabric.Image.filters.Convolute({
        matrix: [1, 1, 1, 1, 0.7, -1, -1, -1, -1],
      });
      break;
    case "removecolor":
      // @ts-ignore
      effect = new fabric.Image.filters.RemoveColor({
        threshold: 0.2,
        distance: 0.5
      });
      break;
    case "blacknwhite":
      // @ts-ignore
      effect = new fabric.Image.filters.BlackWhite();
      break;
    case "vibrance":
      // @ts-ignore
      effect = new fabric.Image.filters.Vibrance({ 
        vibrance: 1,
      });
      break;
    case "blendcolor":
      effect = new fabric.Image.filters.BlendColor({ 
        color: "#00ff00",
        mode: "multiply",
      });
      break;
    case "huerotate":
      effect = new fabric.Image.filters.HueRotation({ 
        rotation: 0.5,
      });
      break;
    case "resize":
      effect = new fabric.Image.filters.Resize();
      break;
    case "gamma":
      // @ts-ignore
      effect = new fabric.Image.filters.Gamma({
        gamma: [1, 0.5, 2.1]
      });
    case "saturation":
      effect = new fabric.Image.filters.Saturation({
        saturation: 0.7,
      });
      break;
    default:
      effect = null;
      return;
  };

  return effect;
};

// Add these utility functions at the top of the component
export const interpolatePoints = (points: Array<{x: number, y: number}>, numPoints: number = 49): Array<{x: number, y: number}> => {
  if (points.length <= 1) return points;
  if (points.length === 2) {
    // Linear interpolation for just two points
    return Array.from({length: numPoints}, (_, i) => {
      const t = i / (numPoints - 1);
      return {
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t
      };
    });
  }

  // Calculate the total path length
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Create points at equal distances
  const result: Array<{x: number, y: number}> = [];
  const segmentLength = totalLength / (numPoints - 1);
  let currentDist = 0;
  let currentIndex = 0;

  result.push(points[0]); // Add first point

  for (let i = 1; i < numPoints - 1; i++) {
    const targetDist = i * segmentLength;

    // Move to the correct segment
    while (currentIndex < points.length - 1) {
      const dx = points[currentIndex + 1].x - points[currentIndex].x;
      const dy = points[currentIndex + 1].y - points[currentIndex].y;
      const segDist = Math.sqrt(dx * dx + dy * dy);
      
      if (currentDist + segDist >= targetDist) {
        const t = (targetDist - currentDist) / segDist;
        result.push({
          x: points[currentIndex].x + dx * t,
          y: points[currentIndex].y + dy * t
        });
        break;
      }
      
      currentDist += segDist;
      currentIndex++;
    }
  }

  result.push(points[points.length - 1]); // Add last point
  return result;
};

export const interpolatePosition = (start: {x: number, y: number}, end: {x: number, y: number}, progress: number): {x: number, y: number} => {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  };
};


export const smoothTrajectory = (points: Array<{x: number, y: number}>, smoothingFactor: number = 0.2): Array<{x: number, y: number}> => {
  if (points.length <= 2) return points;

  const smoothed: Array<{x: number, y: number}> = [];
  smoothed.push(points[0]); // Keep first point

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    smoothed.push({
      x: curr.x + (next.x - prev.x) * smoothingFactor,
      y: curr.y + (next.y - prev.y) * smoothingFactor
    });
  }

  smoothed.push(points[points.length - 1]); // Keep last point
  return smoothed;
};