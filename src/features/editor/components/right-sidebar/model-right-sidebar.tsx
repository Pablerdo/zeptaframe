import { 
  ActiveWorkbenchTool, 
  Editor,
  BaseVideoModel,
  SupportedVideoModelId,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { Film, Video, X } from "lucide-react";
import { videoModels } from "@/features/editor/utils/videoModels";

interface ModelRightSidebarProps {
  editor: Editor | undefined;
  activeWorkbenchTool: ActiveWorkbenchTool;
  onChangeActiveWorkbenchTool: (tool: ActiveWorkbenchTool) => void;
  selectedModel: BaseVideoModel;
  onSelectModel: (model: BaseVideoModel) => void;
};

export const ModelRightSidebar = ({
  editor,
  activeWorkbenchTool,
  onChangeActiveWorkbenchTool,
  selectedModel,
  onSelectModel,
}: ModelRightSidebarProps) => {
  
  const onClose = () => onChangeActiveWorkbenchTool("select");

  return (
    <aside
      className={cn(
        "bg-editor-sidebar h-full relative border-r border-l z-[40] w-full flex flex-col",
        activeWorkbenchTool === "model" ? "visible" : "hidden",
      )}
    >
      <div className="relative">
        <ToolSidebarHeader
          title="Video Models"
          description="Select a model for video generation"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {Object.values(videoModels).map((model: BaseVideoModel) => (
          <button
            key={model.id}
            onClick={() => onSelectModel(model)}
            className={cn(
              "w-full p-3 rounded-lg flex items-center gap-3 transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              selectedModel.id === model.id 
                ? "bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800"
                : "bg-transparent border border-transparent"
            )}
          >
            <span className="font-medium">{model.name}</span>
          </button>
        ))}
        
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            More models coming soon...
          </p>
        </div>
      </div>
    </aside>
  );
};
  