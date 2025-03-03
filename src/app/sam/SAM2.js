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

  constructor() {}

  async downloadModels() {
    this.bufferEncoder = await this.alwaysDownloadModel(ENCODER_URL);
    this.bufferDecoder = await this.alwaysDownloadModel(DECODER_URL);
  }

  async alwaysDownloadModel(url) {
    console.log("Directly downloading model from " + url);
    let buffer = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
    
    try {
      buffer = await fetch(url, {
        // headers: new Headers({
        //   Origin: location.origin,
        // }),
        mode: "cors",
        redirect: "follow",
        signal: controller.signal,
      }).then((response) => response.arrayBuffer());
      console.log("Download completed, buffer size:", buffer.byteLength);
      return buffer;
    } catch (e) {
      console.error("Download of " + url + " failed: ", e);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async downloadModel(url) {
    // step 1: check if cached
    const root = await navigator.storage.getDirectory();
    const filename = path.basename(url);

    console.log("Checking if file exists: " + filename);

    let fileHandle = await root
      .getFileHandle(filename)
      .catch((e) => console.error("File does not exist:", filename, e));

    console.log("File handle: " + fileHandle);
    if (fileHandle) {
      const file = await fileHandle.getFile();
      if (file.size > 0) return await file.arrayBuffer();
    }

    // step 2: download if not cached
    // console.log("File " + filename + " not in cache, downloading from " + url);
    console.log("File not in cache, downloading from " + url);
    let buffer = null;
    try {
      buffer = await fetch(url, {
        headers: new Headers({
          Origin: location.origin,
        }),
        mode: "cors",
      }).then((response) => response.arrayBuffer());
    } catch (e) {
      console.error("Download of " + url + " failed: ", e);
      return null;
    }

    // step 3: store
    try {
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      console.log("Stored " + filename);
    } catch (e) {
      console.error("Storage of " + filename + " failed: ", e);
    }

    return buffer;
  }

  async createSessions() {
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
    for (let ep of ["cpu"]) { // ["webgpu", "cpu"]) {
      try {
        session = await ort.InferenceSession.create(model, {
          executionProviders: [ep],
        });
      } catch (e) {
        console.error(e);
        continue;
      }

      return [session, ep];
    }
  }

  async getEncoderSession() {
    if (!this.sessionEncoder)
      this.sessionEncoder = await this.getORTSession(this.bufferEncoder);

    return this.sessionEncoder;
  }

  async getDecoderSession() {
    if (!this.sessionDecoder)
      this.sessionDecoder = await this.getORTSession(this.bufferDecoder);

    return this.sessionDecoder;
  }

  async encodeImage(inputTensor) {
    const [session, device] = await this.getEncoderSession();
    const results = await session.run({ image: inputTensor });

    this.image_encoded = {
      high_res_feats_0: results[session.outputNames[0]],
      high_res_feats_1: results[session.outputNames[1]],
      image_embed: results[session.outputNames[2]],
    };
  }

  async decode(points, masks) {
    const [session, device] = await this.getDecoderSession();

    const flatPoints = points.map((point) => {
      return [point.x, point.y];
    });

    const flatLabels = points.map((point) => {
      return point.label;
    });

    console.log({
      flatPoints,
      flatLabels,
      masks
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
