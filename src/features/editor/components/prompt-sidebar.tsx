import { useEffect, useState } from "react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface PromptSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const PromptSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: PromptSidebarProps) => {
  const [prompt, setPrompt] = useState("");

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const handleAutoPrompt = () => {
    // TODO: Implement auto prompt functionality
    console.log("Auto prompt clicked");
  };

  const handleSavePrompt = () => {
    // TODO: Implement save prompt functionality
    console.log("Save prompt clicked");
  };

  return (
    <aside
      className={cn(
        "bg-white relative border-r z-[40] w-[360px] h-full flex flex-col",
        activeTool === "prompt" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Prompt"
        description="Create and manage your prompts"
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Textarea
            placeholder="Enter your prompt here..."
            className="min-h-[400px] resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleAutoPrompt}
              variant="outline"
              className="flex-1"
            >
              Auto Prompt
            </Button>
            <Button 
              onClick={handleSavePrompt}
              className="flex-1"
            >
              Save Prompt
            </Button>
          </div>
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
