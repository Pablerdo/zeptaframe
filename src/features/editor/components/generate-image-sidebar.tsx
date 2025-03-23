import { useState, useEffect } from "react";

import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "../components/auth-modal";

import { ActiveTool, Editor, ImageGeneration } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ITextToImage } from "@runware/sdk-js";

interface GenerateImageSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  isTrial: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
  projectId: string;
};

export const GenerateImageSidebar = ({
    editor,
    activeTool,
    onChangeActiveTool,
    isTrial,
    setShowAuthModal,
    projectId,
  }: GenerateImageSidebarProps) => {

    const [isCurrentlyGenerating, setIsCurrentlyGenerating] = useState(false);

    const { userStatus, canGenerateImage, incrementImageUsage } = useUserStatus();

    const [textPrompt, setTextPrompt] = useState("");
    const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);

    const [imageGenerations, setImageGenerations] = useState<ImageGeneration[]>([]);

    const fetchImageGenerations = async () => {
      try {
        const response = await fetch(`/api/image-generations?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch image generations');
        
        const data = await response.json();
        if (data.imageGenerations) {
          setImageGenerations(data.imageGenerations);
        }
      } catch (error) {
        console.error('Error fetching all image generations:', error);
      }
    };
    
    // Fetch image generations on mount
    useEffect(() => {
      fetchImageGenerations();
    }, []);


    const onSubmit = async () => {
      setIsCurrentlyGenerating(true);

      // Check permissions based on user status
      if (!userStatus.isAuthenticated) {
        // Show authentication modal instead of redirecting
        setShowAuthModal(true);
        setIsCurrentlyGenerating(false);
        return;
      }
      
      // Check usage limits for free users
      if (!canGenerateImage()) {
        // Show usage limit modal
        setShowUsageLimitModal(true);
        setIsCurrentlyGenerating(false);
        return;
      }
      
      try {
        const response = await fetch('/api/runware/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            positivePrompt: textPrompt,
            width: 1536,
            height: 1024,
            numberResults: 1,
            projectId: projectId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate image');
        }
        
        const data = await response.json();
        
        console.log("data", data);
        if (data.images && data.images.length > 0) {
          editor?.addImage(data.images[0].imageURL);

          // Increment usage count
          // incrementImageUsage();
          // add image to imageGenerations array
          const imageGeneration: ImageGeneration = {
            id: crypto.randomUUID(), // TODO: get imageUUID from database instead of generating a new one
            imageUrl: data.images[0].imageURL,
            status: "success",
            projectId: projectId,
          }
          // console.log("imageGeneration", imageGeneration);
          setImageGenerations([imageGeneration, ...imageGenerations]);

          // save image to database
          const response = await fetch('/api/image-generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: projectId,
              imageUrl: data.images[0].imageURL,
              status: "success",
            }),
          });

          toast.success("Image generation successful.");
          setTextPrompt("");
          setIsCurrentlyGenerating(false);
        }
      } catch (e) {
        console.error("Error generating image:", e);
        toast.error("Failed to generate image");
      } finally {
        setIsCurrentlyGenerating(false);
      }
    };

    const onClose = () => {
      onChangeActiveTool("select");
    };

    return (
      <div>
        <aside
          className={cn(
            "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[320px] flex flex-col my-2",
            activeTool === "generate-image" ? "visible" : "hidden",
          )}
        >
          <div className="relative">
            <ToolSidebarHeader
              title="Generate Image"
              description="Generate an image using AI."
            />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Close sidebar"
            >
              <X className="h-6 w-6 text-gray-600 dark:text-gray-100" />
            </button>
          </div>
            <form className="p-4 space-y-6" onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}>
              <Textarea
                disabled={isCurrentlyGenerating}
                placeholder="An astronaut riding a horse on mars, hd, dramatic lighting"
                cols={30}
                rows={10}
                required
                minLength={3}
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
              />
              <Button
                disabled={isCurrentlyGenerating}
                type="submit"
                className="w-full"
              >
                {isCurrentlyGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </form>

          <ScrollArea>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {imageGenerations &&
                  imageGenerations.map((image: ImageGeneration) => {
                    return (
                      <button
                        onClick={() => editor?.addImage(image.imageUrl || "")}
                        key={image.id}
                        className="relative w-full h-[100px] group hover:opacity-75 transition bg-muted rounded-sm overflow-hidden border"
                      >
                        <img
                          src={image.imageUrl || ""}
                          alt={"Image"}
                          className="object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Usage Limit Modal */}
        {showUsageLimitModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg w-full max-w-md p-6 animate-in fade-in duration-200">
              <h3 className="text-xl font-bold text-white mb-2">Daily Limit Reached</h3>
              <p className="text-gray-300 mb-4">
                You&apos;ve used all {userStatus.dailyImageGenerations.limit} of your daily image generations on the free plan.
              </p>
              <div className="bg-gray-800 rounded-md p-4 mb-4">
                <h4 className="text-blue-300 font-medium mb-2">Upgrade to Pro for:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Unlimited image generations</li>
                  <li>• Higher resolution outputs</li>
                  <li>• Priority processing</li>
                  <li>• Advanced features</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowUsageLimitModal(false)}
                  className="px-4 py-2 rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    window.location.href = "/upgrade";
                  }}
                  className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
};
