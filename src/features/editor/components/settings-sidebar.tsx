import { useEffect, useMemo, useState } from "react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { ColorPicker } from "@/features/editor/components/color-picker";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

interface SettingsSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const SettingsSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: SettingsSidebarProps) => {
  const workspace = editor?.getWorkspace();

  // const initialWidth = useMemo(() => `${workspace?.width ?? 0}`, [workspace]);
  // const initialHeight = useMemo(() => `${workspace?.height ?? 0}`, [workspace]);
  const initialBackground = useMemo(() => workspace?.fill ?? "#ffffff", [workspace]);

  // const [width, setWidth] = useState(initialWidth);
  // const [height, setHeight] = useState(initialHeight);
  const [background, setBackground] = useState(initialBackground);

  // useEffect(() => {
  //   setBackground(initialBackground);
  // }, [initialBackground]);

  // const changeWidth = (value: string) => setWidth(value);
  // const changeHeight = (value: string) => setHeight(value);
  const changeBackground = (value: string) => {
    setBackground(value);
    editor?.changeBackground(value);
  };

  // const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();

  //   editor?.changeSize({
  //     width: parseInt(width, 10),
  //     height: parseInt(height, 10),
  //   });
  // }

  const onClose = () => {
    onChangeActiveTool("select");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[320px] flex flex-col my-2",
        activeTool === "settings" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Settings"
          description="Change the look of your workspace"
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
        <form className="space-y-4 p-4"> {/* //</ScrollArea>onSubmit={onSubmit}> */}
          <div className="space-y-2">
          <div className="space-y-2">
            <Label>
              Width
            </Label>
            <Input
              placeholder="Width"
              value="960" //locked at 960 for now
              type="number"
              disabled
            />
          </div>
            <Label>
              Height
            </Label>
            <Input
              placeholder="Height"
              value="640" //locked at 640 for now
              type="number"
              disabled
            />
          </div>
          <Button type="submit" className="w-full" disabled>
            Resize
          </Button>
        </form>
        <div className="p-4">
          <ColorPicker
            value={background as string} // We dont support gradients or patterns
            onChange={changeBackground}
          />
        </div>
      </ScrollArea>
    </aside>
  );
};
