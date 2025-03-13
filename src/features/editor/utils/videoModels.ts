import { Film } from "lucide-react";
import { Video } from "lucide-react";
import { SupportedVideoModelId } from "../types";
import { BaseVideoModel } from "../types";

export const videoModels: Record<SupportedVideoModelId, BaseVideoModel> = {
  "cogvideox": { id: "cogvideox" as SupportedVideoModelId, name: "CogVideoX", icon: Film },
  "hunyuanvideo": { id: "hunyuanvideo" as SupportedVideoModelId, name: "HunyuanVideo", icon: Video },
};