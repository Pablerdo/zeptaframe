import { useState, useRef, useEffect } from "react";
import { 
  ActiveWorkbenchTool, 
  Editor,
  SupportedVideoModelId,
  WorkflowMode,
  ComputeMode,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { X, Upload, Film, Wand2, Loader2, RefreshCw, Play, ArrowRightSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { generationPrices } from "@/features/subscriptions/utils";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { dataUrlToFile, uploadToUploadThingResidual, uploadToUploadThingVideo } from "@/lib/uploadthing";
import { comfyDeployWorkflows } from "../../utils/comfy-deploy-workflows";
import { comfyDeployGenerateVideo } from "../../services/generate-video";
import { videoModels } from "../../utils/video-models";

interface FirstFrameEditorRightSidebarProps {
  editor: Editor | undefined;
  workbenchId: string;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  projectId: string;
  setShowAuthModal: (showAuthModal: boolean) => void;
  degradation: number;
};

export const FirstFrameEditorRightSidebar = ({
  editor,
  workbenchId,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  projectId,
  setShowAuthModal,
  degradation
}: FirstFrameEditorRightSidebarProps) => {
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [videoUploadThingUrl, setVideoUploadThingUrl] = useState<string | null>(null);
  const [originalFirstFrameDataUrl, setOriginalFirstFrameDataUrl] = useState<string | null>(null);
  const [originalCanvasCapture, setOriginalCanvasCapture] = useState<string | null>(null);
  const [inpaintedImageUrl, setInpaintedImageUrl] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingFirstFrame, setIsGeneratingFirstFrame] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
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

    setIsProcessing(true);
    try {
      // Upload to UploadThing
      const uploadedUrl = await uploadToUploadThingVideo(file);
      setVideoUploadThingUrl(uploadedUrl);
      setUploadedVideo(file);
      setInpaintedImageUrl(null); // Reset any previous inpainted image
      await extractFirstFrame(file);
      toast.success("Video uploaded successfully");
    } catch (error) {
      console.error("Error uploading video:", error);
      if (error instanceof Error && error.message.includes("File too large")) {
        toast.error("Video size exceeds the 16MB limit");
      } else {
        toast.error("Failed to upload video");
      }
      resetUpload();
    } finally {
      setIsProcessing(false);
    }
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
    const ffeFirstFramePrice = generationPrices.ffeFirstFrameCredits;
    if (!hasEnoughCredits(ffeFirstFramePrice)) {
      const needed = ffeFirstFramePrice - userStatus.credits;
      setRequiredCredits(needed);
      setShowBuyCreditsModal(true);
      return;
    }

    setIsGeneratingFirstFrame(true);
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
          deductCredits(generationPrices.ffeFirstFrameCredits);
          
          toast.success("Inpainted first frame generated successfully!");
        }, 300);
      } else {
        throw new Error('No image returned from API');
      }
    } catch (error) {
      console.error("Error editing first frame:", error);
      console.log("Is it type Error?", error instanceof Error);
      if (error instanceof Error && error.message.includes("FileSizeMismatch")) {
        toast.error("File size exceeds the 16MB limit");
      } else if (error instanceof Error && error.message.includes("E005")) {
        toast.error("First frame generation prompt flagged as sensitive, please try again");
      } else {
        toast.error("Failed to generate first frame");
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setGenerationProgress(0);
    } finally {
      setIsGeneratingFirstFrame(false);
    }
  };

  const resetUpload = () => {
    setUploadedVideo(null);
    setVideoUploadThingUrl(null);
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

  const handleGenerateVideo = async () => {
    if (!editor) return;

    // Check permissions based on user status
    if (!userStatus.isAuthenticated) {
      // Show authentication modal instead of redirecting
      setShowAuthModal(true);
      return;
    }

    // // Check if user has enough credits
    const ffeVideoPrice = generationPrices.ffeVideoCredits;
    if (!hasEnoughCredits(ffeVideoPrice)) {
      // Calculate needed credits
      const needed = ffeVideoPrice - userStatus.credits;
      setRequiredCredits(needed);
      setShowBuyCreditsModal(true);
      return;
    }
    
    try {
      setIsGeneratingVideo(true);
      
      // Upload the workbench image to UploadThing
      let workbenchImageUrl = "";
      if (editor.workspaceURL) {
        const workbenchFile = await dataUrlToFile(editor.workspaceURL, "workspace.png");
        workbenchImageUrl = await uploadToUploadThingResidual(workbenchFile);
      } else {
        throw new Error("No workbench image available");
      }

      const workflowData = {
        "mode": "ffe",
        "workflow_id": comfyDeployWorkflows["PROD-ZEPTA-FFE-CogVideoX"],
      }

      const videoGenData = {
        "input_num_frames": videoModels["cogvideox"].durations[0],
        "input_video": videoUploadThingUrl,
        "input_image": JSON.stringify([workbenchImageUrl]),
        "input_degradation": JSON.stringify(degradation),
      };

      console.log("videoGenData from ffe: ", videoGenData);
        
      const comfyDeployData = {
        workflowData,
        videoGenData
      }

      comfyDeployGenerateVideo({projectId, workbenchId, modelId: "cogvideox", computeMode: "normal", comfyDeployData});

      // When successful, deduct credits
      deductCredits(generationPrices.ffeVideoCredits);
      toast.success("Video submitted successfully!");
    } catch (error) {
      console.error("Error generating video:", error);
      console.log("Is it type Error?", error instanceof Error);

    } finally {
      setIsGeneratingVideo(false);
    }
  };

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
                  disabled={isProcessing}
                />
                
                {!uploadedVideo ? (
                  <label
                    htmlFor="video-upload"
                    className={cn(
                      "cursor-pointer flex flex-col items-center gap-2 p-4",
                      isProcessing && "opacity-50 pointer-events-none"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Uploading video...
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Click to upload video
                        </span>
                      </>
                    )}
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
                      disabled={isProcessing}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Upload Different Video
                    </Button>
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
                {originalFirstFrameDataUrl && (
                  <Button
                    onClick={handleFirstFrameEdit}
                    disabled={isGeneratingFirstFrame || !editPrompt.trim()}
                    className="w-full"
                  >
                    {isGeneratingFirstFrame ? (
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
                {(isGeneratingFirstFrame || inpaintedImageUrl) && (
                  <div className="relative rounded-lg overflow-hidden border">
                    {isGeneratingFirstFrame && !inpaintedImageUrl ? (
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
            <div className="flex-1 space-y-3 w-full">
              <h3 className="font-medium">Generate New Video</h3>
              <Button className="w-full h-16 mb-10" onClick={() => handleGenerateVideo()} disabled={isGeneratingVideo}>
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs">Sending request...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightSquare className="h-6 w-6 mr-2" />
                    Generate First Frame Edited Video
                  </>
                )}
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
