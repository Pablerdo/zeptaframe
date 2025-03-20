import { useState, useEffect } from "react";

import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { AuthModal } from "../components/auth-modal";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

// import { useGenerateImage } from "@/features/ai/api/use-generate-image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, Info } from "lucide-react";

interface GenerateImageSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  isTrial: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
};

export const GenerateImageSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
  isTrial,
  setShowAuthModal,
}: GenerateImageSidebarProps) => {

  const { userStatus, canGenerateImage, incrementImageUsage } = useUserStatus();
  // const mutation = useGenerateImage();

  const [value, setValue] = useState("");
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);

  const onSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    // Check permissions based on user status
    if (!userStatus.isAuthenticated) {
      // Show authentication modal instead of redirecting
      setShowAuthModal(true);
      return;
    }
    
    // Check usage limits for free users
    if (!canGenerateImage()) {
      // Show usage limit modal
      setShowUsageLimitModal(true);
      return;
    }

    // If user is authenticated and has generations remaining
    // mutation.mutate({ prompt: value }, {
    //   onSuccess: ({ data }) => {
    //     editor?.addImage(data);
    //     incrementImageUsage(); // Increment usage counter on success
    //   }
    // });
  };

  // Handle successful authentication
  const handleAuthSuccess = () => {
    // After successful authentication, try to generate image again
    onSubmit(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>);
  };

  const onClose = () => {
    onChangeActiveTool("select");
  };

  return (
    <>
      <aside
        className={cn(
          "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[360px] flex flex-col my-2",
          activeTool === "generate-image" ? "visible" : "hidden",
        )}
      >
        <ToolSidebarHeader
          title="Generate Image"
          description="Generate an image using AI. Coming soon..."
        />
        <ScrollArea>
          <form onSubmit={onSubmit} className="p-4 space-y-6">
            <Textarea
              // disabled={mutation.isPending}
              placeholder="An astronaut riding a horse on mars, hd, dramatic lighting"
              cols={30}
              rows={10}
              required
              minLength={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              // disabled={mutation.isPending || !userStatus.isAuthenticated || !canGenerateImage()}
              // disabled={true} // Currently disabled as feature is coming soon
              type="submit"
              className="w-full"
              onClick={() => setShowAuthModal(true)}
            > 
              Generate
            </Button>
          </form>
        </ScrollArea>
        <ToolSidebarClose onClick={onClose} />
      </aside>

      {/* Usage Limit Modal */}
      {showUsageLimitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg w-full max-w-md p-6 animate-in fade-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Daily Limit Reached</h3>
            <p className="text-gray-300 mb-4">
              You've used all {userStatus.dailyImageGenerations.limit} of your daily image generations on the free plan.
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
    </>
  );
};
