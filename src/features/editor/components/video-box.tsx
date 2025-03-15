import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { videoModels } from "../utils/videoModels";
import { SupportedVideoModelId } from "../types";

interface VideoBoxProps {
  video: string | null;
  isLoading?: boolean;
  model?: string;
  progress?: number;
}

export const VideoBox = ({ 
  video, 
  isLoading = false,
  progress = 0,
  model = "cogvideox"
}: VideoBoxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Auto-play video when it loads
  useEffect(() => {
    if (video && videoRef.current) {
      videoRef.current.load();
    }
  }, [video]);

  return (
    <div 
      className="w-[720px] h-[480px] relative border border-gray-600/30 rounded-xl overflow-hidden flex items-center justify-center bg-gray-800/50 shadow-lg"
    >
      {video ? (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          controls
          autoPlay
          loop
        >
          <source src={video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : isLoading ? (
        <div className="w-full h-full bg-gray-800/80 flex flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <span className="text-gray-300 text-sm font-medium tracking-wide mb-2">
            Generating video with {videoModels[model as SupportedVideoModelId]?.name || "AI"}...
          </span>
          {progress > 0 && (
            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gray-800/30 flex items-center justify-center">
          <span className="text-gray-400 text-sm font-medium tracking-wide">
            No video has been generated yet
          </span>
        </div>
      )}
    </div>
  );
};
