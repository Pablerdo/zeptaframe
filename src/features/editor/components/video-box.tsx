import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoBoxProps {
  video: string | null;
  onGenerateVideo: () => void;
  isLoading?: boolean;
  progress?: number;
}

export const VideoBox = ({ video, onGenerateVideo, isLoading = false, progress = 0 }: VideoBoxProps) => {
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
            Generating video...
          </span>
          <div className="w-[60%] h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-gray-400 text-xs mt-2">
            {Math.round(progress)}%
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
