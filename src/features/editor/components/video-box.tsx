import { useRef, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { videoModels } from "../utils/video-models";
import { SupportedVideoModelId } from "../types";

interface VideoBoxProps {
  videoUrl: string | null;
  videoStatus: string | null;
  isLoading?: boolean;
  model?: string;
  progress?: number;
}

export const VideoBox = ({ 
  videoUrl, 
  videoStatus,
  isLoading = false,
  progress = 0,
  model = "cogvideox"
}: VideoBoxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Auto-play video when it loads
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  return (
    <div 
      className="w-[480px] h-[320px] relative border border-gray-600/30 rounded-xl overflow-hidden flex items-center justify-center bg-gray-800/50 shadow-lg"
    >
      {videoStatus === 'success' && videoUrl && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          controls
          autoPlay
          loop
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}

      {videoStatus === 'pending' && (
        <div className="w-full h-full bg-gray-800/30 flex flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <span className="text-gray-300 text-sm font-medium tracking-wide mb-2">
            Generating video with {videoModels[model as SupportedVideoModelId]?.name || "AI"}...
          </span>
        </div>
      )}
      {videoStatus === 'error' && (
        <div className="w-full h-full bg-gray-800/30 flex flex-col items-center justify-center">
          <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
          <span className="text-red-400 text-sm font-medium tracking-wide">
            Selected generation failed, please try again.
          </span>
        </div>
      )}
      {videoStatus === null && (
        <div className="w-full h-full bg-gray-800/30 flex items-center justify-center">
          <span className="text-gray-400 text-sm font-medium tracking-wide">
            No video has been generated in this workbench yet
          </span>
        </div>
      )}
    </div>
  );
};
