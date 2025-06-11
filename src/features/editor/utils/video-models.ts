import { SupportedVideoModelId } from "../types";
import { BaseVideoModel } from "../types";

export const videoModels: Record<SupportedVideoModelId, BaseVideoModel> = {
  "cogvideox": { id: "cogvideox" as SupportedVideoModelId, name: "CogVideoX", durations: [49]},
  "skyreels": { id: "skyreels" as SupportedVideoModelId, name: "SkyReels", durations: [49, 65, 97]},
  "wan": { id: "wan" as SupportedVideoModelId, name: "Wan2.1", durations: [49, 65, 97]},
};

export const defaultVideoModelId: SupportedVideoModelId = "cogvideox";