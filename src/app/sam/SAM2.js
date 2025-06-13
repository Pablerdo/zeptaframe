"use client"

import path from "path";

import * as ort from "onnxruntime-web/all";
// ort.env.wasm.numThreads=1
// ort.env.wasm.simd = false;'


const ENCODER_URL =
  "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_encoder.with_runtime_opt.ort";
const DECODER_URL =
  "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder_pr1.onnx";

export class SAM2 {
  bufferEncoder = null;
  bufferDecoder = null;
  sessionEncoder = null;
  sessionDecoder = null;
  image_encoded = null;
  
  // Add flags to prevent concurrent downloads
  downloadingEncoder = false;
  downloadingDecoder = false;

  constructor() {}

  async downloadModels() {
    // Prevent concurrent downloads by using Promise.all with individual download checks
    const [encoderBuffer, decoderBuffer] = await Promise.all([
      this.downloadModelSafe(ENCODER_URL, 'encoder'),
      this.downloadModelSafe(DECODER_URL, 'decoder')
    ]);
    
    this.bufferEncoder = encoderBuffer;
    this.bufferDecoder = decoderBuffer;
    
    return {
      encoder: !!encoderBuffer,
      decoder: !!decoderBuffer
    };
  }

  async downloadModelSafe(url, type) {
    // Prevent concurrent downloads of the same model
    const isDownloading = type === 'encoder' ? this.downloadingEncoder : this.downloadingDecoder;
    if (isDownloading) {
      console.log(`${type} model already downloading, waiting...`);
      // Wait for current download to complete
      while (type === 'encoder' ? this.downloadingEncoder : this.downloadingDecoder) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return type === 'encoder' ? this.bufferEncoder : this.bufferDecoder;
    }

    // Set downloading flag
    if (type === 'encoder') {
      this.downloadingEncoder = true;
    } else {
      this.downloadingDecoder = true;
    }

    try {
      return await this.downloadModelWithRetry(url, 3);
    } finally {
      // Clear downloading flag
      if (type === 'encoder') {
        this.downloadingEncoder = false;
      } else {
        this.downloadingDecoder = false;
      }
    }
  }

  async downloadModelWithRetry(url, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Downloading model from ${url} (attempt ${attempt}/${maxRetries})`);
        const buffer = await this.downloadModel(url);
        if (buffer) {
          console.log(`Successfully downloaded model on attempt ${attempt}`);
          return buffer;
        }
      } catch (error) {
        lastError = error;
        console.warn(`Download attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.error(`Failed to download model after ${maxRetries} attempts:`, lastError);
    return null;
  }

  async alwaysDownloadModel(url) {
    console.log("Directly downloading model from " + url);
    let buffer = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Increased to 120 seconds
    
    try {
      const response = await fetch(url, {
        mode: "cors",
        redirect: "follow",
        signal: controller.signal,
      });
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }
      
      buffer = await response.arrayBuffer();
      console.log("Download completed, buffer size:", buffer.byteLength);
      return buffer;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error("Download of " + url + " timed out");
      } else {
        console.error("Download of " + url + " failed: ", e);
      }
      throw e; // Re-throw to allow retry logic to handle
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async downloadModel(url) {
    const filename = path.basename(url);

    // Step 1: Check if cached (with better error handling)
    try {
      const root = await navigator.storage.getDirectory();
      console.log("Checking if file exists: " + filename);

      const fileHandle = await root.getFileHandle(filename).catch(() => null);
      
      if (fileHandle) {
        console.log("File found in cache");
        const file = await fileHandle.getFile();
        if (file.size > 0) {
          console.log(`Loaded ${filename} from cache (${file.size} bytes)`);
          return await file.arrayBuffer();
        } else {
          console.warn(`Cached file ${filename} is empty, re-downloading`);
        }
      } else {
        console.log("File not found in cache");
      }
    } catch (storageError) {
      console.warn("Storage API not available or failed, proceeding with direct download:", storageError);
      // Fall back to direct download without caching
      return await this.alwaysDownloadModel(url);
    }

    // Step 2: Download if not cached
    console.log("File not in cache, downloading from " + url);
    let buffer = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // Increased timeout
    
    try {
      const response = await fetch(url, {
        mode: "cors",
        redirect: "follow",
        signal: controller.signal,
      });
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }
      
      buffer = await response.arrayBuffer();
      console.log("Download completed, buffer size:", buffer.byteLength);
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error("Download of " + url + " timed out");
      } else {
        console.error("Download of " + url + " failed: ", e);
      }
      throw e; // Re-throw to allow retry logic to handle
    } finally {
      clearTimeout(timeoutId);
    }

    // Step 3: Store (with better error handling)
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      console.log("Stored " + filename + " in cache");
    } catch (e) {
      console.warn("Storage of " + filename + " failed (but download succeeded):", e);
      // Don't fail the entire operation if storage fails
    }

    return buffer;
  }

  async createSessions() {
    // First ensure models are downloaded
    if (!this.bufferEncoder || !this.bufferDecoder) {
      console.log("Models not loaded, downloading...");
      const downloadResult = await this.downloadModels();
      if (!downloadResult.encoder || !downloadResult.decoder) {
        console.error("Failed to download required models");
        return {
          success: false,
          device: null,
          error: "Failed to download models"
        };
      }
    }

    const success =
      (await this.getEncoderSession()) && (await this.getDecoderSession());

    return {
      success: success,
      device: success ? this.sessionEncoder[1] : null,
    };
  }

  async getORTSession(model) {
    /** Creating a session with executionProviders: {"webgpu", "cpu"} fails
     *  => "Error: multiple calls to 'initWasm()' detected."
     *  but ONLY in Safari and Firefox (wtf)
     *  seems to be related to web worker, see https://github.com/microsoft/onnxruntime/issues/22113
     *  => loop through each ep, catch e if not available and move on
     */
    let session = null;
    // Wait a bit before trying the next execution provider
    for (let ep of ["webgpu","cpu"]) { // ["webgpu", "cpu"]) {
      try {
        session = await ort.InferenceSession.create(model, {
          executionProviders: [ep],
        });
      } catch (e) {
        console.error("Error creating session with execution provider: " + ep);
        console.error(e);
        console.log("Retrying with next execution provider...");

        continue;
      }

      return [session, ep];
    }
  }

  async createEncoderSession() {
    // Ensure model is downloaded first
    if (!this.bufferEncoder) {
      console.log("Encoder buffer not available, downloading...");
      const downloadResult = await this.downloadModels();
      if (!downloadResult.encoder) {
        console.error("Failed to download encoder model");
        return null;
      }
    }
    
    console.log("Creating encoder session");
    this.sessionEncoder = await this.getORTSession(this.bufferEncoder);
    return this.sessionEncoder;
  }

  async getEncoderSession() {
    if (!this.sessionEncoder) {
      // Ensure model is downloaded first
      if (!this.bufferEncoder) {
        console.log("Encoder buffer not available, downloading...");
        const downloadResult = await this.downloadModels();
        if (!downloadResult.encoder) {
          console.error("Failed to download encoder model");
          return null;
        }
      }
      
      console.log("Creating encoder session");
      this.sessionEncoder = await this.getORTSession(this.bufferEncoder);
    }
    return this.sessionEncoder;
  }

  async getDecoderSession() {
    if (!this.sessionDecoder) {
      // Ensure model is downloaded first
      if (!this.bufferDecoder) {
        console.log("Decoder buffer not available, downloading...");
        const downloadResult = await this.downloadModels();
        if (!downloadResult.decoder) {
          console.error("Failed to download decoder model");
          return null;
        }
      }
      
      console.log("Creating decoder session");
      this.sessionDecoder = await this.getORTSession(this.bufferDecoder);
    }

    return this.sessionDecoder;
  }

  async encodeImage(inputTensor) {
    // Wait for encoder session to be available with retry mechanism
    if (!this.sessionEncoder) return;

    const [session, device] = await this.sessionEncoder;
    const results = await session.run({ image: inputTensor });

    this.image_encoded = {
      high_res_feats_0: results[session.outputNames[0]],
      high_res_feats_1: results[session.outputNames[1]],
      image_embed: results[session.outputNames[2]],
    };
  }

  async decode(points, masks) {
    // const [session, device] = await this.getDecoderSession();

    if (!this.sessionDecoder) return;

    const [session, device] = await this.sessionDecoder;

    const flatPoints = points.map((point) => {
      return [point.x, point.y];
    });

    const flatLabels = points.map((point) => {
      return point.label;
    });

    let mask_input, has_mask_input
    if (masks) {
      mask_input = masks
      has_mask_input = new ort.Tensor("float32", [1], [1])
    } else {
      // dummy data
      mask_input = new ort.Tensor(
        "float32",
        new Float32Array(256 * 256),
        [1, 1, 256, 256]
      )
      has_mask_input = new ort.Tensor("float32", [0], [1])
    }

    const inputs = {
      image_embed: this.image_encoded.image_embed,
      high_res_feats_0: this.image_encoded.high_res_feats_0,
      high_res_feats_1: this.image_encoded.high_res_feats_1,
      point_coords: new ort.Tensor("float32", flatPoints.flat(), [
        1,
        flatPoints.length,
        2,
      ]),
      point_labels: new ort.Tensor("float32", flatLabels, [
        1,
        flatLabels.length,
      ]),
      mask_input: mask_input,
      has_mask_input: has_mask_input,
    };

    return await session.run(inputs);
  }
}
