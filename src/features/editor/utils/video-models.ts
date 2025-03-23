import { SupportedVideoModelId } from "../types";
import { BaseVideoModel } from "../types";

export const videoModels: Record<SupportedVideoModelId, BaseVideoModel> = {
  "cogvideox": { id: "cogvideox" as SupportedVideoModelId, name: "CogVideoX" },
  "hunyuanvideo": { id: "hunyuanvideo" as SupportedVideoModelId, name: "HunyuanVideo" },
  "skyreels": { id: "skyreels" as SupportedVideoModelId, name: "SkyReels" },
};

export const defaultVideoModelId: SupportedVideoModelId = "skyreels";