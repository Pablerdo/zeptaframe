import { X } from "lucide-react";

import { 
  ActiveWorkbenchTool, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";


interface CameraControlRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  cameraControl: Record<string, any>;
  setCameraControl: (cameraControl: Record<string, any>) => void;
};

export const CameraControlRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  cameraControl,
  setCameraControl,
}: CameraControlRightSidebarProps) => {
  
  const onClose = () => {
    onChangeActiveWorkbenchTool("select");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
        activeWorkbenchTool === "camera-control" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Camera Control"
          description="Coming soon..."
        />
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      {/* Future camera control UI goes here */}
    </aside>
  );
};
  