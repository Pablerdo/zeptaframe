import { 
  ActiveWorkbenchTool, 
  Editor,
  BaseVideoModel,
  SupportedVideoModelId,
} from "@/features/editor/types";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
import { cn } from "@/lib/utils";
import { Film, Video, X } from "lucide-react";
import { videoModels } from "@/features/editor/utils/video-models";

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
        {Object.values(videoModels).map((model: BaseVideoModel) => {
          const isDisabled = model.id === "wan";
          
          return (
            <button
              key={model.id}
              onClick={() => !isDisabled && onSelectModel(model)}
              disabled={isDisabled}
              className={cn(
                "w-full flex p-3 border border-gray-300 dark:border-gray-700 rounded-lg mt-3 items-center gap-3 transition-colors",
                selectedModel.id === model.id 
                  ? "bg-blue-600 dark:bg-blue-600 border border-blue-900 dark:border-blue-800 text-white"
                  : "bg-transparent",
                isDisabled 
                  ? "opacity-50 cursor-not-allowed" 
                  : "hover:border-gray-600 dark:hover:border-gray-200"
              )}
            >
              <span className="font-medium">{model.name}</span>
              <span className={cn(
                "ml-auto text-sm", 
                selectedModel.id === model.id 
                  ? "text-blue-100" 
                  : "text-gray-500 dark:text-gray-400"
              )}>
                {model.credits.normal} credits
                {isDisabled && <span className="ml-2 text-xs">(Coming Soon)</span>}
              </span>
            </button>
          );
        })}
        
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-100">
            More models coming soon...
          </p>
        </div>
      </div>
    </aside>
  );
};
  