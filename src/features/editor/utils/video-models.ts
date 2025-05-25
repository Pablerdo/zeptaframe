import { SupportedVideoModelId } from "../types";
import { BaseVideoModel } from "../types";

export const videoModels: Record<SupportedVideoModelId, BaseVideoModel> = {
  "cogvideox": { id: "cogvideox" as SupportedVideoModelId, name: "CogVideoX" },
  "skyreels": { id: "skyreels" as SupportedVideoModelId, name: "SkyReels" },
};

export const defaultVideoModelId: SupportedVideoModelId = "skyreels";