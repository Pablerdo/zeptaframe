import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface VideoBoxProps {
  video: string | null;
  onGenerateVideo: () => void;
}

export const VideoBox = ({ video, onGenerateVideo }: VideoBoxProps) => {
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
