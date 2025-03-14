import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { videoModels } from "../utils/videoModels";
import { SupportedVideoModelId } from "../types";

interface VideoBoxProps {
  video: string | null;
  isLoading?: boolean;
  model?: string;
}

export const VideoBox = ({ 
  video, 
  isLoading = false, 
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
            Generating video with {videoModels[model as SupportedVideoModelId].name}...
          </span>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 text-sm font-medium tracking-wide">
            No video has been generated yet
          </span>
        </div>
      )}
    </div>
  );
};
