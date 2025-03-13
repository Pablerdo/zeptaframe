import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { ActiveWorkbenchTool, Editor } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface PromptRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
}

export const PromptRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
}: PromptRightSidebarProps) => {
  const onClose = () => {
    onChangeActiveWorkbenchTool("select");
  };

  const handleSavePrompt = () => {
    // TODO: Implement save prompt functionality
    console.log("Save prompt clicked");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
        activeWorkbenchTool === "prompt" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Prompt"
          description="Add general prompt details to enhance the video generation"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
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
    </aside>
  );
};
