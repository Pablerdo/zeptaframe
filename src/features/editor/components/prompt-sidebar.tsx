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
  const onClose = () => {
    onChangeActiveTool("select");
  };

  const handleSavePrompt = () => {
    // TODO: Implement save prompt functionality
    console.log("Save prompt clicked");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[360px] flex flex-col my-2",
        activeTool === "prompt" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Prompt"
        description="Add general prompt details to enhance the video generation"
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="text-sm text-muted-foreground rounded-md bg-muted p-3 mb-2">
            <p>The system will automatically generate a prompt based on your scene. 
            You can add additional details below to further customize the results.</p>
          </div>
          <Textarea
            placeholder="Enter your prompt here..."
            className="min-h-[400px] resize-none"
            value={editor?.prompt}
            onChange={(e) => editor?.setPrompt(e.target.value)}
          />
          <div className="flex w-full">
            <Button 
              onClick={handleSavePrompt}
              className="w-full"
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
