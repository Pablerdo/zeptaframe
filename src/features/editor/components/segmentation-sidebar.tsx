import { 
    ActiveTool, 
    Editor,
    SegmentedObject, 
  } from "@/features/editor/types";
  import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
  import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";
  
  import { cn } from "@/lib/utils";
  import { Label } from "@/components/ui/label";
  import { Button } from "@/components/ui/button";
  import { Slider } from "@/components/ui/slider";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { X, Check } from "lucide-react";
  interface SegmentationSidebarProps {
    editor: Editor | undefined;
    activeTool: ActiveTool;
    onChangeActiveTool: (tool: ActiveTool) => void;
    segmentationPoints: { x: number; y: number }[];
    onCancelSegmentation: () => void;
  };
  
  export const SegmentationSidebar = ({
    editor,
    activeTool,
    onChangeActiveTool,
    segmentationPoints,
    onCancelSegmentation,
  }: SegmentationSidebarProps) => {
    
    const handleSubmitSegmentation = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return;
  
      // // Create a new segmented object
      // const newSegmentedObject: SegmentedObject = {
      //   id: crypto.randomUUID(),
      //   url: '', // This would be set after processing the segmentation
      //   canvasId: initialData.id,
      //   coordinatePath: {
      //     coordinates: points
      //   }
      // };
  
      // // Add to segmented objects
      // setSegmentedObjects(prev => [...prev, newSegmentedObject]);
  
      // // Clear the segmentation mode
      // clearSegmentation();
  
      // // TODO: Here you would typically:
      // // 1. Send the points to your segmentation API
      // // 2. Get back the segmented image
      // // 3. Update the newSegmentedObject with the result
      // // 4. Update the canvas with the segmented image
      
      // // For now, we'll just save the current state
      // mutate({
      //   width: initialData.width,
      //   height: initialData.height,
      //   json: initialData.json
      // });
    };
    
    const onClose = () => {
      onCancelSegmentation();
      onChangeActiveTool("select");
      //editor?.clearSegmentationPoints();
    };
  
    return (
      <aside
        className={cn(
          "bg-white relative border-r z-[40] w-[360px] h-full flex flex-col",
          activeTool === "segment" ? "visible" : "hidden",
        )}
      >
        <ToolSidebarHeader
          title="Segmentation"
          description="Place coordinates to segment the image"
        />
        <ScrollArea>
          <div className="p-4 space-y-4 border-b">
            <Label className="text-sm">
              Points placed: {segmentationPoints.length}
            </Label>
          </div>
          
        <div className="shrink-0 h-[56px] border-b bg-white w-full flex items-center overflow-x-auto z-[49] p-2 gap-x-2">
          <div className="flex items-center h-full justify-center">
            <Button
                onClick={onCancelSegmentation}
                size="sm"
                variant="destructive"
                className="flex items-center gap-x-2"
            >
              <X className="size-4" />
                Cancel
            </Button>
          </div>
            <div className="flex items-center h-full justify-center">
              <Button
                  onClick={() => handleSubmitSegmentation(segmentationPoints)}
                  size="sm"
                  variant="default"
                  className="flex items-center gap-x-2"
                  disabled={segmentationPoints.length === 0}
              >
                <Check className="size-4" />
                  Done
              </Button>
          </div>
        </div>
        </ScrollArea>
        <ToolSidebarClose onClick={onClose} />
      </aside>
    );
  };
  