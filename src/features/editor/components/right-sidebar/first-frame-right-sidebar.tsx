import { useState, useRef, useEffect } from "react";
import { 
  ActiveWorkbenchTool, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { X, Upload, Film, Wand2, Loader2, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { generationPrices } from "@/features/subscriptions/utils";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { dataUrlToFile, uploadToUploadThingResidual } from "@/lib/uploadthing";

interface FirstFrameEditorRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  projectId: string;
  setShowAuthModal: (showAuthModal: boolean) => void;
};

export const FirstFrameEditorRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  projectId,
  setShowAuthModal,
}: FirstFrameEditorRightSidebarProps) => {
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [originalFirstFrameDataUrl, setOriginalFirstFrameDataUrl] = useState<string | null>(null);
  const [originalCanvasCapture, setOriginalCanvasCapture] = useState<string | null>(null);
  const [inpaintedImageUrl, setInpaintedImageUrl] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { userStatus, hasEnoughCredits, deductCredits } = useUserStatus();
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);

  const onClose = () => onChangeActiveWorkbenchTool("select");

  // Extract first frame from video
  const extractFirstFrame = async (videoFile: File) => {
    setIsProcessing(true);
    try {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.currentTime = 0;
        };
        video.onerror = reject;
        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/png');
          setOriginalFirstFrameDataUrl(dataUrl);
          
          // Add the first frame to the canvas
          if (editor) {
            console.log("Adding image to canvas");
            editor.addImage(dataUrl);
            
            // Wait for the next render cycle and then capture
            requestAnimationFrame(() => {
              // Add a small delay to ensure the image is fully rendered
              setTimeout(() => {
                console.log("Capturing canvas state");
                const workspace = editor.getWorkspace();
                if (workspace) {
                  const workspaceBounds = workspace.getBoundingRect();
                  const canvasCapture = editor.canvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    left: workspaceBounds.left,
                    top: workspaceBounds.top,
                    width: workspaceBounds.width,
                    height: workspaceBounds.height,
                  });
                  setOriginalCanvasCapture(canvasCapture);
                  console.log("Canvas state captured");
                }
              }, 500); // Increased delay to 500ms to be safe
            });
          }
          
          URL.revokeObjectURL(video.src);
          resolve(null);
        };
      });
      
      toast.success("First frame extracted successfully");
    } catch (error) {
      console.error("Error extracting first frame:", error);
      toast.error("Failed to extract first frame");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      toast.error("Please upload a valid video file");
      return;
    }

    setUploadedVideo(file);
    setInpaintedImageUrl(null); // Reset any previous inpainted image
    await extractFirstFrame(file);
  };

  const handleFirstFrameEdit = async () => {
    if (!originalCanvasCapture || !editPrompt.trim()) {
      toast.error("Please provide a prompt for editing");
      return;
    }

    // Check authentication
    if (!userStatus.isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // Check credits
    const imagePrice = generationPrices.image;
    if (!hasEnoughCredits(imagePrice)) {
      const needed = imagePrice - userStatus.credits;
      setRequiredCredits(needed);
      setShowBuyCreditsModal(true);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setInpaintedImageUrl(null);
    
    // Start progress animation
    const startTime = Date.now();
    const duration = 15000; // 15 seconds
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 99);
      setGenerationProgress(Math.floor(progress));
      
      if (elapsed >= duration && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, 50);

    try {
      // Convert the original canvas capture to a file
      const canvasFile = await dataUrlToFile(originalCanvasCapture, `first-frame-${Date.now()}.png`);
      
      // Upload to UploadThing
      const uploadedUrl = await uploadToUploadThingResidual(canvasFile);
      
      // Call Replicate API
      const response = await fetch('/api/replicate/inpaint-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: editPrompt,
          inputImageUrl: uploadedUrl,
          projectId: projectId,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }
      
      if (data.outputUrl) {
        // Clear the interval and set to 100%
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setGenerationProgress(100);
        
        // Small delay to show 100% before showing the image
        setTimeout(() => {
          setInpaintedImageUrl(data.outputUrl);
          setGenerationProgress(0);
          
          // Add the new image to canvas
          if (editor) {
            editor.addImage(data.outputUrl);
          }
          
          // Deduct credits
          deductCredits(imagePrice);
          
          toast.success("Video first frame generated successfully!");
        }, 300);
      } else {
        throw new Error('No image returned from API');
      }
    } catch (error) {
      console.error("Error editing first frame:", error);
      toast.error("Failed to generate new video");
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setGenerationProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetUpload = () => {
    setUploadedVideo(null);
    setOriginalFirstFrameDataUrl(null);
    setOriginalCanvasCapture(null);
    setInpaintedImageUrl(null);
    setEditPrompt("");
    setGenerationProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
        activeWorkbenchTool === "first-frame" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="First Frame Editor"
          description="Upload a video and edit its first frame"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Info box about disabled tools */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> While in First Frame mode, other editing tools are temporarily disabled. Exit this mode to access Animation, Camera, Prompt, and Model tools.
          </p>
        </div>

        {/* Step 1: Video Upload */}
        <div className="relative">
          <div className="flex">
            {/* Number bubble with line */}
            <div className="relative flex flex-col items-center mr-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold z-10">
                1
              </div>
              <div className="absolute top-8 mt-2 w-0.5 h-[calc(100%-22px)] my-2 bg-gray-300 dark:bg-gray-600" />
            </div>
            
            {/* Content */}
            <div className="flex-1 space-y-3 pb-6">
              <h3 className="font-medium">Upload Video</h3>
              
              <div className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-opacity",
                uploadedVideo ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-gray-300 dark:border-gray-700"
              )}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                
                {!uploadedVideo ? (
                  <label
                    htmlFor="video-upload"
                    className="cursor-pointer flex flex-col items-center gap-2 p-4"
                  >
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Click to upload video
                    </span>
                  </label>
                ) : (
                  <div className="space-y-2">
                    <Film className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      {uploadedVideo.name}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resetUpload}
                      className="mt-2"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Upload Different Video
                    </Button>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Processing video...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Edit First Frame */}
        <div className={cn(
          "relative transition-opacity",
          !originalFirstFrameDataUrl ? "opacity-50 pointer-events-none" : ""
        )}>
          <div className="flex">
            {/* Number bubble with line */}
            <div className="relative flex flex-col items-center mr-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold z-10",
                originalFirstFrameDataUrl ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-500"
              )}>
                2
              </div>
              <div className="absolute top-8 mt-2 w-0.5 h-[calc(100%-22px)] my-2 bg-gray-300 dark:bg-gray-600" />
            </div>
            
            {/* Content */}
            <div className="flex-1 space-y-3 pb-6">
              <h3 className="font-medium">Edit First Frame</h3>
              
              {originalFirstFrameDataUrl && (
                <div className="space-y-3">
                  {/* Original Frame */}
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={originalFirstFrameDataUrl}
                      alt="Original first frame"
                      className="w-full h-48"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 text-xs text-white font-medium">
                      Original First Frame
                    </span>
                  </div>
                  
                  <Textarea
                    placeholder="Describe how you want to edit the first frame..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}
              {/* Content */}
              <div className="flex-1 space-y-3">
                <h4 className="font-medium">Generate New First Frame</h4>
                
                {originalFirstFrameDataUrl && (
                  <Button
                    onClick={handleFirstFrameEdit}
                    disabled={isGenerating || !editPrompt.trim()}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating New First Frame...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        New First Frame
                      </>
                    )}
                  </Button>
                )}

                {/* Inpainted Result */}
                {(isGenerating || inpaintedImageUrl) && (
                  <div className="relative rounded-lg overflow-hidden border">
                    {isGenerating && !inpaintedImageUrl ? (
                      <>
                        {/* Swirling gradient background */}
                        <div className="w-full h-48 relative">

                          {/* Progress counter */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-5xl font-bold text-white mb-2">
                                {generationProgress}%
                              </div>
                              <div className="text-sm text-white/80">
                                Generating...
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-2 left-2 text-xs text-white font-medium">
                          Generating First Frame
                        </span>
                      </>
                    ) : inpaintedImageUrl ? (
                      <>
                        <img
                          src={inpaintedImageUrl}
                          alt="Generated first frame"
                          className="w-full h-48"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <span className="absolute bottom-2 left-2 text-xs text-white font-medium">
                          Generated First Frame
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

  
          </div>
        </div>

        {/* Step 3: Generate Video */}
        <div className={cn(
          "relative transition-opacity",
          !originalFirstFrameDataUrl ? "opacity-50 pointer-events-none" : ""
        )}>
          <div className="flex">
            {/* Number bubble */}
            <div className="relative flex flex-col items-center mr-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold z-10",
                originalFirstFrameDataUrl ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-500"
              )}>
                3
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <h3 className="font-medium">Generate New Video</h3>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Generate New Video
              </Button>
            </div>
            
          </div>
        </div>
      </div>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        isOpen={showBuyCreditsModal}
        onClose={() => setShowBuyCreditsModal(false)}
        requiredCredits={requiredCredits}
        actionLabel="edit first frame"
        projectId={projectId}
      />
    </aside>
  );
};
