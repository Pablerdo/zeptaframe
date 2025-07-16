"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Loader2, Play, Download, ChevronDown, ChevronRight, Image as ImageIcon, X, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadToUploadThingFastVideo, uploadToUploadThingFastImage, uploadToUploadThingResidual, dataUrlToFile } from "@/lib/uploadthing";
import { comfyDeployWorkflows } from "@/features/editor/utils/comfy-deploy-workflows";

interface VideoProcessingState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  videoUrl?: string;
  runId?: string;
}

export default function FastPage() {
  const [processingState, setProcessingState] = useState<VideoProcessingState>({
    status: 'idle',
    progress: 0
  });
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [firstFrameImage, setFirstFrameImage] = useState<File | null>(null);
  const [firstFramePreview, setFirstFramePreview] = useState<string | null>(null);
  const [showFirstFrameOptions, setShowFirstFrameOptions] = useState(false);
  const [showVideoSettings, setShowVideoSettings] = useState(false);
  const [nthFrame, setNthFrame] = useState(1);
  const [outputFps, setOutputFps] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Warn user before leaving page during processing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (processingState.status === 'uploading' || processingState.status === 'processing') {
        e.preventDefault();
        e.returnValue = 'Your video is still being processed. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [processingState.status]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      toast.error("Please upload a valid video file");
      return;
    }

    setUploadedVideo(file);
    setProcessingState({ status: 'idle', progress: 0 });
  };

  const handleFirstFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error("Please upload a valid image file");
      return;
    }

    // Check file size (max 8MB)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Image size must be less than 8MB");
      return;
    }

    setFirstFrameImage(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setFirstFramePreview(previewUrl);
    
    toast.success("First frame image uploaded");
  };

  const removeFirstFrame = () => {
    setFirstFrameImage(null);
    setFirstFramePreview(null);
    if (firstFrameInputRef.current) {
      firstFrameInputRef.current.value = "";
    }
    toast.info("First frame removed - will use original video first frame");
  };

  const handleGenerate = async () => {
    if (!uploadedVideo) {
      toast.error("Please upload a video first");
      return;
    }

    setProcessingState({ status: 'uploading', progress: 10 });

    try {
      // Upload video to UploadThing using fast video uploader
      const videoUrl = await uploadToUploadThingFastVideo(uploadedVideo);

      if (!videoUrl) {
        throw new Error('No video URL received');
      }

      setProcessingState({ status: 'processing', progress: 30 });

      // Handle first frame image
      let firstFrameImageUrl = "";

      if (firstFrameImage) {
        // Upload custom first frame image
        try {
          firstFrameImageUrl = await uploadToUploadThingFastImage(firstFrameImage);
          setProcessingState({ status: 'processing', progress: 40 });
        } catch (error) {
          console.error("Error uploading first frame:", error);
          toast.error("Failed to upload first frame image. Using original video first frame.");
        }

        const workflowData = {
          mode: "ffe",
          workflow_id: comfyDeployWorkflows["PROD-ZEPTA-FFE-CogVideoX"],
        };
  
        const videoGenData = {
          input_num_frames: "49",
          input_video: videoUrl,
          input_image: JSON.stringify([firstFrameImageUrl]),
          input_degradation: JSON.stringify(0.1),
          input_prompt: "High quality video",
          input_nth_frame: JSON.stringify(nthFrame),
          input_fps: JSON.stringify(outputFps),
          modelId: "cogvideox",
          computeMode: "normal",
        };
  
        // Start video processing
        const processResponse = await fetch('/api/fast/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowData, videoGenData }),
        });
  
        if (!processResponse.ok) {
          throw new Error('Failed to start video processing');
        }
  
        const processData = await processResponse.json();
        const runId = processData.runId;
  
        setProcessingState({ 
          status: 'processing', 
          progress: firstFrameImage ? 60 : 50, 
          runId 
        });
  
        // Poll for completion
        pollForCompletion(runId);
      } else {
        const workflowData = {
          mode: "ffe",
          workflow_id: comfyDeployWorkflows["PROD-ZEPTA-V2V-CogVideoX"],
        };
  
        const videoGenData = {
          input_num_frames: "49",
          input_video: videoUrl,
          input_degradation: JSON.stringify(0.6),
          input_prompt: "High quality video",
          input_nth_frame: JSON.stringify(nthFrame),
          input_fps: JSON.stringify(outputFps),
          modelId: "cogvideox",
          computeMode: "normal",
        };
  
        // Start video processing
        const processResponse = await fetch('/api/fast/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflowData, videoGenData }),
        });
  
        if (!processResponse.ok) {
          throw new Error('Failed to start video processing');
        }
  
        const processData = await processResponse.json();
        const runId = processData.runId;
  
        setProcessingState({ 
          status: 'processing', 
          progress: firstFrameImage ? 60 : 50, 
          runId 
        });
  
        // Poll for completion
        pollForCompletion(runId);
      }
    } catch (error) {
      console.error('Error:', error);
      setProcessingState({ status: 'error', progress: 0 });
      toast.error("Failed to process video. Please try again.");
    }
  };

  const pollForCompletion = async (runId: string) => {
    const maxAttempts = 120; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/fast/webhook-video?runId=${runId}`);
        const data = await response.json();

        if (data.status === 'success' && data.videoUrl) {
          setProcessingState({
            status: 'completed',
            progress: 100,
            videoUrl: data.videoUrl,
            runId
          });
          toast.success("Video processing completed!");
          return;
        }

        if (data.status === 'error') {
          setProcessingState({ status: 'error', progress: 0 });
          toast.error("Video processing failed");
          return;
        }

        // Still processing
        attempts++;
        if (attempts < maxAttempts) {
          const baseProgress = firstFrameImage ? 60 : 50;
          const progress = Math.min(baseProgress + (attempts * 2), 95);
          setProcessingState(prev => ({ ...prev, progress }));
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setProcessingState({ status: 'error', progress: 0 });
          toast.error("Processing timeout");
        }

      } catch (error) {
        console.error('Polling error:', error);
        setProcessingState({ status: 'error', progress: 0 });
        toast.error("Failed to check processing status");
      }
    };

    poll();
  };

  const resetUpload = () => {
    setUploadedVideo(null);
    setFirstFrameImage(null);
    setFirstFramePreview(null);
    setShowFirstFrameOptions(false);
    setShowVideoSettings(false);
    setNthFrame(1);
    setOutputFps(8);
    setProcessingState({ status: 'idle', progress: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (firstFrameInputRef.current) {
      firstFrameInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            V2V GWF
          </h1>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Upload Area */}
          {!uploadedVideo && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <Upload className="h-16 w-16 text-gray-400" />
                <div>
                  <p className="text-xl font-medium text-gray-700 mb-2">
                    Drop your video here or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports MP4, MOV, AVI (max 32MB)
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Video Preview & Processing */}
          {uploadedVideo && (
            <div className="space-y-6">
              {/* First Frame Options */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setShowFirstFrameOptions(!showFirstFrameOptions)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">First Frame Options</h3>
                      <p className="text-sm text-gray-500">
                        {firstFrameImage 
                          ? "Custom first frame uploaded" 
                          : "Using original video first frame"}
                      </p>
                    </div>
                  </div>
                  {showFirstFrameOptions ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {showFirstFrameOptions && (
                  <div className="border-t border-gray-200 p-4 space-y-4">
                    <p className="text-sm text-gray-600">
                      Upload a custom image to replace the first frame of your video. If no image is provided, 
                      the original first frame from your video will be used.
                    </p>
                    
                    {!firstFrameImage ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input
                          ref={firstFrameInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFirstFrameUpload}
                          className="hidden"
                          id="first-frame-upload"
                        />
                        <label
                          htmlFor="first-frame-upload"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-700">Upload First Frame Image</p>
                            <p className="text-xs text-gray-500">PNG, JPG, JPEG (max 8MB)</p>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <img
                            src={firstFramePreview!}
                            alt="First frame preview"
                            className="w-32 h-20 object-cover rounded-lg border"
                          />
                          <button
                            onClick={removeFirstFrame}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Custom first frame loaded</p>
                          <p className="text-sm text-gray-500 mt-1">
                            This image will replace the first frame of your video during processing.
                          </p>
                          <Button
                            onClick={removeFirstFrame}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                          >
                            Remove Image
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Video Settings */}
              <div className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => setShowVideoSettings(!showVideoSettings)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-gray-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">Video Settings</h3>
                      <p className="text-sm text-gray-500">
                        Frame selection: every {nthFrame}{nthFrame === 1 ? 'st' : nthFrame === 2 ? 'nd' : nthFrame === 3 ? 'rd' : 'th'} frame • Output: {outputFps} FPS
                      </p>
                    </div>
                  </div>
                  {showVideoSettings ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                
                {showVideoSettings && (
                  <div className="border-t border-gray-200 p-4 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frame Selection
                      </label>
                      <div className="space-y-2">
                        <label htmlFor="nth-frame" className="block text-sm text-gray-600">
                          Select every nth frame from input video
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            id="nth-frame"
                            type="number"
                            min="1"
                            max="10"
                            value={nthFrame}
                            onChange={(e) => setNthFrame(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-500">
                            (1 = every frame, 2 = every 2nd frame, etc.)
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Frame Rate
                      </label>
                      <div className="space-y-2">
                        <label htmlFor="output-fps" className="block text-sm text-gray-600">
                          Frames per second for output video
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            id="output-fps"
                            type="number"
                            min="1"
                            max="60"
                            value={outputFps}
                            onChange={(e) => setOutputFps(Math.max(1, Math.min(60, parseInt(e.target.value) || 8)))}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-500">FPS</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Preview */}
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-contain"
                  controls
                >
                  <source src={URL.createObjectURL(uploadedVideo)} type={uploadedVideo.type} />
                </video>
                
                {/* Processing Overlay */}
                {processingState.status === 'processing' && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">Processing Video...</p>
                      <div className="w-48 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${processingState.progress}%` }}
                        />
                      </div>
                      <p className="text-sm mt-2">{processingState.progress}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Processing Warning Banner */}
              {(processingState.status === 'uploading' || processingState.status === 'processing') && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">
                        Processing in progress
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Please keep this page open. Refreshing will lose your progress and you'll need to start over.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                {processingState.status === 'idle' && (
                  <>
                    <Button
                      onClick={handleGenerate}
                      size="lg"
                      className="px-8"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Generate
                    </Button>
                    <Button
                      onClick={resetUpload}
                      variant="outline"
                      size="lg"
                    >
                      Upload Different Video
                    </Button>
                  </>
                )}

                {processingState.status === 'uploading' && (
                  <Button disabled size="lg" className="px-8">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Uploading...
                  </Button>
                )}

                {processingState.status === 'processing' && (
                  <Button disabled size="lg" className="px-8">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </Button>
                )}

                {processingState.status === 'completed' && (
                  <div className="flex gap-4">
                    <Button
                      onClick={resetUpload}
                      variant="outline"
                      size="lg"
                    >
                      Process Another Video
                    </Button>
                    {processingState.videoUrl && (
                      <Button
                        asChild
                        size="lg"
                        className="px-8"
                      >
                        <a
                          href={processingState.videoUrl}
                          download="processed-video.mp4"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-5 w-5 mr-2" />
                          Download Result
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {processingState.status === 'error' && (
                  <div className="flex gap-4">
                    <Button
                      onClick={handleGenerate}
                      size="lg"
                      className="px-8"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={resetUpload}
                      variant="outline"
                      size="lg"
                    >
                      Upload Different Video
                    </Button>
                  </div>
                )}
              </div>

              {/* Result Video */}
              {processingState.status === 'completed' && processingState.videoUrl && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold text-center mb-4">
                    Processed Video
                  </h3>
                  <div className="rounded-xl overflow-hidden bg-black">
                    <video
                      className="w-full h-64 object-contain"
                      controls
                      autoPlay
                      loop
                    >
                      <source src={processingState.videoUrl} type="video/mp4" />
                    </video>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Powered by Go-with-the-Flow • No account required
          </p>
        </div>
      </div>
    </div>
  );
} 