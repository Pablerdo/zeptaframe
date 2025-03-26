import { useState, useEffect } from "react";

import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "../components/auth-modal";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { generationPrices } from "@/features/subscriptions/utils";

import { ActiveTool, Editor, ImageGeneration } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

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
    const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
    const [requiredCredits, setRequiredCredits] = useState(0);

    const { userStatus, hasEnoughCredits, deductCredits } = useUserStatus();

    const [textPrompt, setTextPrompt] = useState("");
    
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
      
      // Check if user has enough credits
      const imagePrice = generationPrices.image;
      if (!hasEnoughCredits(imagePrice)) {
        // Calculate needed credits
        const needed = imagePrice - userStatus.credits;
        setRequiredCredits(needed);
        setShowBuyCreditsModal(true);
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
        
        if (data.images && data.images.length > 0) {
          editor?.addImage(data.images[0].imageURL);

          // Deduct credits
          deductCredits(imagePrice);
          
          // add image to imageGenerations array
          const imageGeneration: ImageGeneration = {
            id: crypto.randomUUID(), // TODO: get imageUUID from database instead of generating a new one
            imageUrl: data.images[0].imageURL,
            status: "success",
            projectId: projectId,
          }
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
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
          
          {/* Buy Credits Modal */}
          <BuyCreditsModal
            isOpen={showBuyCreditsModal}
            onClose={() => setShowBuyCreditsModal(false)}
            requiredCredits={requiredCredits}
            actionLabel="generate an image"
            projectId={projectId}
          />
        </aside>
    );
};
