export function maskImageCanvas(imageCanvas, maskCanvas) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = imageCanvas.height;
  canvas.width = imageCanvas.width;

  context.drawImage(
    maskCanvas,
    0,
    0,
    maskCanvas.width,
    maskCanvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.globalCompositeOperation = "source-in";
  context.drawImage(
    imageCanvas,
    0,
    0,
    imageCanvas.width,
    imageCanvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

export function resizeCanvas(canvasOrig, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.height = size.h;
  canvas.width = size.w;

  ctx.drawImage(
    canvasOrig,
    0,
    0,
    canvasOrig.width,
    canvasOrig.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

// input: 2x Canvas, output: One new Canvas, resize source
export function mergeMasks(sourceMask, targetMask) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.height = targetMask.height;
  canvas.width = targetMask.width;

  ctx.drawImage(targetMask, 0, 0);
  ctx.drawImage(
    sourceMask,
    0,
    0,
    sourceMask.width,
    sourceMask.height,
    0,
    0,
    targetMask.width,
    targetMask.height
  );

  return canvas;
}

// input: source and target {w, h}, output: {x,y,w,h} to fit source nicely into target preserving aspect
export function resizeAndPadBox(sourceDim, targetDim) {
  if (sourceDim.h == sourceDim.w) {
    return { x: 0, y: 0, w: targetDim.w, h: targetDim.h };
  } else if (sourceDim.h > sourceDim.w) {
    // portrait => resize and pad left
    const newW = (sourceDim.w / sourceDim.h) * targetDim.w;
    const padLeft = Math.floor((targetDim.w - newW) / 2);

    return { x: padLeft, y: 0, w: newW, h: targetDim.h };
  } else if (sourceDim.h < sourceDim.w) {
    // landscape => resize and pad top
    const newH = (sourceDim.h / sourceDim.w) * targetDim.h;
    const padTop = Math.floor((targetDim.h - newH) / 2);

    return { x: 0, y: padTop, w: targetDim.w, h: newH };
  }
}

/** 
 * input: onnx Tensor [B, *, W, H] and index idx
 * output: Tensor [B, idx, W, H]
 **/
export function sliceTensor(tensor, idx) {
  const [bs, noMasks, width, height] = tensor.dims;
  const stride = width * height;
  const start = stride * idx,
    end = start + stride;

  return tensor.cpuData.slice(start, end);
}

/**
 * input: Float32Array representing ORT.Tensor of shape [1, 1, width, height]
 * output: HTMLCanvasElement (4 channels, RGBA)
 **/
export function float32ArrayToCanvas(array, width, height) {
  const C = 4; // 4 output channels, RGBA
  const imageData = new Uint8ClampedArray(array.length * C);
  
  // Create a simple mask without the border detection
  for (let srcIdx = 0; srcIdx < array.length; srcIdx++) {
    const trgIdx = srcIdx * C;
    
    if (array[srcIdx] > 0) {
      // All mask pixels get the same light gray color
      imageData[trgIdx] = 0xaa;     // Red: 170
      imageData[trgIdx + 1] = 0xaa; // Green: 170
      imageData[trgIdx + 2] = 0xaa; // Blue: 170
      imageData[trgIdx + 3] = 200;  // Consistent opacity
    } else {
      // Background: fully transparent
      imageData[trgIdx] = 0;
      imageData[trgIdx + 1] = 0;
      imageData[trgIdx + 2] = 0;
      imageData[trgIdx + 3] = 0;
    }
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.height = height;
  canvas.width = width;
  ctx.putImageData(new ImageData(imageData, width, height), 0, 0);

  return canvas;
}

/**
 * Applies morphological opening and blur to a mask canvas for improved results
 * Uses pixelThreshold as the size of the opening operation and blurRadius for final smoothing
 * 
 * @param {HTMLCanvasElement} canvas - The mask canvas to enhance
 * @param {number} pixelThreshold - Size of morphological opening operation (default: 5px)
 * @param {number} blurRadius - Amount of final blur to apply (default: 1)
 * @returns {HTMLCanvasElement} - A new canvas with the enhanced mask
 */
export function enhanceMaskEdges(canvas, pixelThreshold = 5, blurRadius = 1) {
  const width = canvas.width;
  const height = canvas.height;
  
  // Create new canvases for the process
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = width;
  tempCanvas.height = height;
  
  // Get initial mask data
  const sourceCtx = canvas.getContext("2d");
  const originalData = sourceCtx.getImageData(0, 0, width, height);
  const originalPixels = originalData.data;
  
  // Create binary representation of the mask (1 for mask, 0 for background)
  const isMasked = new Array(width * height).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      isMasked[y * width + x] = originalPixels[idx + 3] > 128;
    }
  }

  // =============================================
  // STEP 1: Erosion (shrink the mask by pixelThreshold)
  // =============================================

  const erodedMask = new Array(width * height).fill(false);
  const radius = Math.max(1, Math.floor(pixelThreshold / 2));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      
      // Only check pixels that were masked in the original
      if (!isMasked[pixelIdx]) continue;
      
      // Check if all pixels in neighborhood are masked in original mask
      let allNeighborsMasked = true;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          // If outside image or not masked, this pixel doesn't pass erosion
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || !isMasked[ny * width + nx]) {
            allNeighborsMasked = false;
            break;
          }
        }
        if (!allNeighborsMasked) break;
      }
      
      erodedMask[pixelIdx] = allNeighborsMasked;
    }
  }
  
  
  // =============================================
  // STEP 2: Dilation (expand the eroded mask by pixelThreshold)
  // =============================================

  const resultMask = new Array(width * height).fill(false);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      
      // Check neighborhood within circular radius
      let hasNeighbor = false;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Calculate Euclidean distance for circular structuring element
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Skip points outside the circle
          if (distance > radius) continue;
          
          const ny = y + dy;
          const nx = x + dx;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (erodedMask[ny * width + nx]) {
              hasNeighbor = true;
              break;
            }
          }
        }
        if (hasNeighbor) break;
      }
      
      resultMask[pixelIdx] = hasNeighbor;
    }
  }
  
  // Create image data from the result mask
  const resultData = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      const dataIdx = pixelIdx * 4;
      
      if (resultMask[pixelIdx]) {
        resultData.data[dataIdx] = 0xaa;     // Red
        resultData.data[dataIdx + 1] = 0xaa; // Green
        resultData.data[dataIdx + 2] = 0xaa; // Blue
        resultData.data[dataIdx + 3] = 200;  // Alpha
      } else {
        resultData.data[dataIdx] = 0;
        resultData.data[dataIdx + 1] = 0;
        resultData.data[dataIdx + 2] = 0;
        resultData.data[dataIdx + 3] = 0;    // Transparent
      }
    }
  }
  
  // =============================================  
  // STEP 3: Add darker borders to the mask
  // =============================================

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      const dataIdx = pixelIdx * 4;
      
      // Only process mask pixels
      if (!resultMask[pixelIdx]) continue;
      
      // Check if this is a border pixel (within 2 pixels of an edge)
      let isBorder = false;
      const borderWidth = 2;  // Width of the border in pixels
      
      // Check in a small area around the pixel for non-mask pixels
      for (let dy = -borderWidth; dy <= borderWidth && !isBorder; dy++) {
        for (let dx = -borderWidth; dx <= borderWidth && !isBorder; dx++) {
          // Skip checking the pixel itself
          if (dx === 0 && dy === 0) continue;
          
          const ny = y + dy;
          const nx = x + dx;
          
          // If we find a non-mask pixel within range, this is a border pixel
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && !resultMask[ny * width + nx]) {
            isBorder = true;
          }
        }
      }
      
      if (isBorder) {
        // Make borders darker (around 40% darker)
        resultData.data[dataIdx] = 0x66;     // Red: 102
        resultData.data[dataIdx + 1] = 0x66; // Green: 102
        resultData.data[dataIdx + 2] = 0x66; // Blue: 102
        resultData.data[dataIdx + 3] = 230;  // Slightly more opaque
      }
    }
  }
  
  // Put the morphologically opened mask on the temp canvas
  tempCtx.putImageData(resultData, 0, 0);
  
  // Apply blur to the result
  const finalCanvas = document.createElement("canvas");
  const finalCtx = finalCanvas.getContext("2d");
  finalCanvas.width = width;
  finalCanvas.height = height;
  
  // Apply blur if radius > 0
  if (blurRadius > 0) {
    finalCtx.filter = `blur(${blurRadius}px)`;
  }
  finalCtx.drawImage(tempCanvas, 0, 0);
  finalCtx.filter = 'none';
  
  return finalCanvas;
}

/** 
 * input: HTMLCanvasElement (RGB)
 * output: Float32Array for later conversion to ORT.Tensor of shape [1, 3, canvas.width, canvas.height]
 *  
 * inspired by: https://onnxruntime.ai/docs/tutorials/web/classify-images-nextjs-github-template.html
 **/ 
export function canvasToFloat32Array(canvas) {
  const imageData = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const shape = [1, 3, canvas.width, canvas.height];

  const [redArray, greenArray, blueArray] = [[], [], []];

  for (let i = 0; i < imageData.length; i += 4) {
    redArray.push(imageData[i]);
    greenArray.push(imageData[i + 1]);
    blueArray.push(imageData[i + 2]);
    // skip data[i + 3] to filter out the alpha channel
  }

  const transposedData = redArray.concat(greenArray).concat(blueArray);

  let i,
    l = transposedData.length;
  const float32Array = new Float32Array(shape[1] * shape[2] * shape[3]);
  for (i = 0; i < l; i++) {
    float32Array[i] = transposedData[i] / 255.0; // convert to float
  }

  return { float32Array, shape };
}

/** 
 * input: HTMLCanvasElement (RGB)
 * output: Float32Array for later conversion to ORT.Tensor of shape [1, 3, canvas.width, canvas.height]
 *  
 * inspired by: https://onnxruntime.ai/docs/tutorials/web/classify-images-nextjs-github-template.html
 **/ 
export function maskCanvasToFloat32Array(canvas) {
  const imageData = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data;

  const shape = [1, 1, canvas.width, canvas.height];
  const float32Array = new Float32Array(shape[1] * shape[2] * shape[3]);

  for (let i = 0; i < float32Array.length; i++) {
    float32Array[i] = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / (3 * 255.0); // convert avg to float
  }

  return float32Array;
}

/**
 * Creates a pure binary RGB mask (no alpha channel)
 * White pixels (255,255,255) represent the segmented object
 * Black pixels (0,0,0) represent the background
 * 
 * @param {Float32Array} array - The mask data from the segmentation model
 * @param {number} width - Width of the mask
 * @param {number} height - Height of the mask
 * @returns {HTMLCanvasElement} - Canvas with the binary mask (RGB only)
 */
export function float32ArrayToBinaryMask(array, width, height) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  
  // Create image data with RGB values (3 bytes per pixel)
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  for (let srcIdx = 0, dataIdx = 0; srcIdx < array.length; srcIdx++, dataIdx += 4) {
    // Determine if this pixel is part of the mask
    const isMasked = array[srcIdx] > 0;
    
    // Set RGB values (all channels the same - either 0 or 255)
    const value = isMasked ? 255 : 0;
    data[dataIdx] = value;     // R
    data[dataIdx + 1] = value; // G
    data[dataIdx + 2] = value; // B
    data[dataIdx + 3] = 255;   // Alpha always 255 (fully opaque)
  }
  
  // Put the image data on the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}

/**
 * Outputs the centroid of the mask
 * 
 * @param {Float32Array} array - The mask data from the segmentation model
 * @param {number} width - Width of the mask
 * @param {number} height - Height of the mask
 * @returns {Object} - The centroid of the mask
 * @returns {number} x - The x-coordinate of the centroid
 * @returns {number} y - The y-coordinate of the centroid
 */
export function getCentroid(array, width, height) {
  const centroid = { x: 0, y: 0 };
  let totalWeight = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = y * width + x;
      const weight = array[pixelIdx];
      
      if (weight > 0) {
        centroid.x += x * weight;
        centroid.y += y * weight;
        totalWeight += weight;
      }
    }
  }
  
  if (totalWeight > 0) {
    centroid.x /= totalWeight;
    centroid.y /= totalWeight;
  }
  
  return centroid;
}
