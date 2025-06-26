import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { ActiveWorkbenchTool, Editor } from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface TextPromptRightSidebarProps {
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  generalTextPrompt: string;
  onGeneralTextPromptChange: (prompt: string) => void;
}

export const TextPromptRightSidebar = ({
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  generalTextPrompt,
  onGeneralTextPromptChange,
}: TextPromptRightSidebarProps) => {
  
  const onClose = () => {
    onChangeActiveWorkbenchTool("select");
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
          <X className="h-5 w-5 text-gray-600 dark:text-gray-100" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> If an animation is provided, the system will generate a complete prompt based on the movement. Otherwise, provide guidance for the system to generate a prompt.
            
            </p>
          </div>

          <Textarea
            placeholder="Enter your prompt here (max 25 words, the rest is automatically generated)..."
            className="min-h-[400px] resize-none"
            value={generalTextPrompt}
            onChange={(e) => {
              const words = e.target.value.trim().split(/\s+/);
              if (words.length <= 25 || e.target.value === '') {
                onGeneralTextPromptChange(e.target.value);
              }
            }}
          />
        </div>
      </ScrollArea>
    </aside>
  );
};
