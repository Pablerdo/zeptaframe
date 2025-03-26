import { ActiveTool, Editor, STROKE_COLOR } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ColorPicker } from "@/features/editor/components/color-picker";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

interface StrokeColorSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const StrokeColorSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: StrokeColorSidebarProps) => {
  const value = editor?.getActiveStrokeColor() || STROKE_COLOR;

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const onChange = (value: string) => {
    editor?.changeStrokeColor(value);
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r rounded-xl z-[40] w-[360px] h-full flex flex-col my-2",
        activeTool === "stroke-color" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Stroke color"
          description="Add stroke color to your element"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-6 w-6 text-gray-600 dark:text-gray-100" />
        </button>
      </div>
      <ScrollArea>
        <div className="p-4 space-y-6">
          <ColorPicker
            value={value}
            onChange={onChange}
          />
        </div>
      </ScrollArea>
    </aside>
  );
};
