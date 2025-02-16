import { useState, useEffect } from "react";
import { 
    ActiveTool, 
    CoordinatePath, 
    Editor, 
    SegmentedObject, 
  } from "@/features/editor/types";
  import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
  import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
  import { SplineCanvas } from "@/features/editor/components/spline-canvas";
  
  import { cn } from "@/lib/utils";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Eye, Layers, Trash2 } from "lucide-react";

  interface ControlMotionSidebarProps {
    editor: Editor | undefined;
    activeTool: ActiveTool;
    onChangeActiveTool: (tool: ActiveTool) => void;
    segmentedObjects: SegmentedObject[];
    onSegmentedObjectChange: (objectId: string, path: CoordinatePath) => void;
  };
  
  export const ControlMotionSidebar = ({
    editor,
    activeTool,
    onChangeActiveTool,
    segmentedObjects,
    onSegmentedObjectChange,
  }: ControlMotionSidebarProps) => {

    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

    const selectedObject = segmentedObjects.find(obj => obj.id === selectedObjectId);

    const handlePathChange = (path: CoordinatePath) => {
        if (selectedObjectId) {
          onSegmentedObjectChange(selectedObjectId, path);
        }
      };

    // const handlePathChange = (path: CoordinatePath) => {
    //     if (selectedObjectId) {
    //         setCoordinatePaths(prev => ({
    //         ...prev,
    //         [selectedObjectId]: path
    //         }));
    //     }
    // };

    const onClose = () => {
      editor?.disableDrawingMode();
      onChangeActiveTool("select");
    };
  
    return (
      <aside
        className={cn(
          "bg-white relative border-r z-[40] w-[420px] h-full flex flex-col",
          activeTool === "control-motion" ? "visible" : "hidden",
        )}
      >
        <ToolSidebarHeader
          title="Control Motion"
          description="Drag the segmented object to control the motion"
        />
        <ScrollArea>
          <div className="p-4 space-y-6">
            <SplineCanvas 
              coordinates={selectedObjectId ? selectedObject?.coordinatePath.coordinates : undefined}
              onChange={handlePathChange}
            />
          </div>
        </ScrollArea>
        <div className="flex-1 border-t border-zinc-100">
          <div className="p-3 border-b border-zinc-100">
            <h3 className="text-xs font-medium text-zinc-500">Segmented Objects</h3>
          </div>
          <ScrollArea className="flex-1 h-[200px]">
            <div className="p-2 space-y-1">
                {/* TODO: Add segmented objects */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between p-2 rounded-md hover:bg-zinc-100 cursor-pointer"
                >
                  <div className="flex items-center gap-x-2">
                    <div className="size-8 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                      <Layers className="size-4 text-zinc-500" />
                    </div>
                    <span className="text-sm text-zinc-600">Object {i}</span>
                  </div>
                  <div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded hover:bg-zinc-200">
                      <Eye className="size-3 text-zinc-500" />
                    </button>
                    <button className="p-1 rounded hover:bg-zinc-200">
                      <Trash2 className="size-3 text-zinc-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <ToolSidebarClose onClick={onClose} />
      </aside>
    );
  };
  