import { SupportedVideoModelId } from "../types";
import { BaseVideoModel } from "../types";

export const videoModels: Record<SupportedVideoModelId, BaseVideoModel> = {
  "cogvideox": { 
    id: "cogvideox" as SupportedVideoModelId, 
    name: "CogVideoX", 
    frameCount: [49],
    credits: {
      flash: 15,
      normal: 20,
      ultra: 35,
    }
  },
  "skyreels": { 
    id: "skyreels" as SupportedVideoModelId, 
    name: "SkyReels", 
    frameCount: [49, 65, 97],
    credits: {
      flash: 15,
      normal: 20,
      ultra: 35,
    }
  },
  "wan": { 
    id: "wan" as SupportedVideoModelId, 
    name: "Wan2.1", 
    frameCount: [81],
    credits: {
      flash: 20,
      normal: 40,
      ultra: 80,
    }
  },
};

export const defaultVideoModelId: SupportedVideoModelId = "cogvideox";