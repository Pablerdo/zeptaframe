import { Button } from "@/components/ui/button";

interface VideoBoxProps {
  video: string | null;
  onGenerateVideo: () => void;
}

export const VideoBox = ({ video, onGenerateVideo }: VideoBoxProps) => {
  return (
    <div 
      className="w-[300px] h-[200px] relative border border-gray-300 rounded-lg flex items-center justify-center bg-gray-50"
    >
      {video ? (
        <video
          className="w-full h-full object-cover"
          poster={`/path/to/first-frame.jpg`}
        >
          <source src={video} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <Button
          className="bg-blue-500 text-white hover:bg-blue-600"
          onClick={onGenerateVideo}
        >
          Generate Video
        </Button>
      )}
    </div>
  );
};
