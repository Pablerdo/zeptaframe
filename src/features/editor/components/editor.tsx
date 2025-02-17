"use client";

import { fabric } from "fabric";
import debounce from "lodash.debounce";
import { useCallback, useEffect, useRef, useState } from "react";

import { ResponseType } from "@/features/projects/api/use-get-project";
import { useUpdateProject } from "@/features/projects/api/use-update-project";

import { 
  ActiveTool, 
  CoordinatePath, 
  SegmentedObject, 
  selectionDependentTools
} from "@/features/editor/types";
import { Navbar } from "@/features/editor/components/navbar";
import { Footer } from "@/features/editor/components/footer";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { Sidebar } from "@/features/editor/components/sidebar";
import { Toolbar } from "@/features/editor/components/toolbar";
import { ShapeSidebar } from "@/features/editor/components/shape-sidebar";
import { FillColorSidebar } from "@/features/editor/components/fill-color-sidebar";
import { StrokeColorSidebar } from "@/features/editor/components/stroke-color-sidebar";
import { StrokeWidthSidebar } from "@/features/editor/components/stroke-width-sidebar";
import { OpacitySidebar } from "@/features/editor/components/opacity-sidebar";
import { TextSidebar } from "@/features/editor/components/text-sidebar";
import { FontSidebar } from "@/features/editor/components/font-sidebar";
import { ImageSidebar } from "@/features/editor/components/image-sidebar";
import { FilterSidebar } from "@/features/editor/components/filter-sidebar";
import { DrawSidebar } from "@/features/editor/components/draw-sidebar";
import { ControlMotionSidebar } from "@/features/editor/components/control-motion-sidebar";
import { AiSidebar } from "@/features/editor/components/ai-sidebar";
import { TemplateSidebar } from "@/features/editor/components/template-sidebar";
import { RemoveBgSidebar } from "@/features/editor/components/remove-bg-sidebar";
import { SettingsSidebar } from "@/features/editor/components/settings-sidebar";
import { SegmentationSidebar } from "@/features/editor/components/segmentation-sidebar";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorProps {
  initialData: ResponseType["data"];
};

export const Editor = ({ initialData }: EditorProps) => {
  const { mutate } = useUpdateProject(initialData.id);
  const [segmentedObjects, setSegmentedObjects] = useState<SegmentedObject[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleSegmentedObjectChange = (objectId: string, path: CoordinatePath) => {
    setSegmentedObjects(prev => prev.map(obj => 
      obj.id === objectId 
        ? { ...obj, coordinatePath: path }
        : obj
    ));
    
    mutate({
      width: initialData.width,
      height: initialData.height,
      json: initialData.json
    });
  };

  const debouncedSave = useCallback(
    debounce(
      (values: { 
        json: string,
        height: number,
        width: number,
      }) => {
        mutate(values);
    },
    500
  ), [mutate]);

  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");

  const onClearSelection = useCallback(() => {
    if (selectionDependentTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [activeTool]);

  const { init, editor } = useEditor({
    defaultState: initialData.json,
    defaultWidth: initialData.width,
    defaultHeight: initialData.height,
    clearSelectionCallback: onClearSelection,
    saveCallback: debouncedSave,
  });


  const onChangeActiveTool = useCallback((tool: ActiveTool) => {
    if (tool === "draw") {
      editor?.enableDrawingMode();
    }

    if (activeTool === "draw") {
      editor?.disableDrawingMode();
    }

    if (tool === "segment") {
      editor?.enableSegmentationMode();
    }

    if (activeTool === "segment") {
      // editor?.clearSegmentationPoints();
      editor?.disableSegmentationMode();

      // clearSegmentation();
    }

    if (tool === activeTool) {
      return setActiveTool("select");
    }

    setActiveTool(tool);
  }, [activeTool, editor]);

  const canvasRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      controlsAboveOverlay: true,
      preserveObjectStacking: true,
    });

    init({
      initialCanvas: canvas,
      initialContainer: containerRef.current!,
    });

    return () => {
      canvas.dispose();
    };
  }, [init]);

  const onAddButtonClick = () => {
    // TODO: Implement add functionality
    console.log("Add button clicked");
  };

  return (
    <div className="h-full flex flex-col">
      <Navbar
        id={initialData.id}
        editor={editor}
        activeTool={activeTool}
        onChangeActiveTool={onChangeActiveTool}
      />
      <div className="absolute h-[calc(100%-68px)] w-full top-[68px] flex">
        <Sidebar
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <SegmentationSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
          // onCancelSegmentation={clearSegmentation}
        />
        <ShapeSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FillColorSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeColorSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <StrokeWidthSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <OpacitySidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TextSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FontSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <ImageSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <TemplateSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <FilterSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <AiSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <RemoveBgSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <ControlMotionSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
          segmentedObjects={segmentedObjects}
          onSegmentedObjectChange={handleSegmentedObjectChange}
        />
        <DrawSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <SettingsSidebar
          editor={editor}
          activeTool={activeTool}
          onChangeActiveTool={onChangeActiveTool}
        />
        <main className="bg-muted flex-1 overflow-auto relative flex flex-col">
          <Toolbar
            editor={editor}
            activeTool={activeTool}
            onChangeActiveTool={onChangeActiveTool}
          />
          <div className="flex-1 h-[calc(100%-124px)] bg-muted relative" ref={containerRef}>
            <canvas 
              ref={canvasRef} 
              className={activeTool === "segment" ? "cursor-crosshair" : "cursor-default"}
            />
            <button
              onClick={onAddButtonClick}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 rounded-xl border-2 border-black/80 flex items-center justify-center bg-white shadow-lg hover:shadow-xl hover:scale-105 hover:bg-zinc-50 transition-all duration-200 group"
            >
              <span className="text-4xl font-bold text-black/80 group-hover:text-black transition-colors">+</span>
            </button>
          </div>
          <div className={cn(
            "bg-zinc-800 flex flex-col transition-all duration-300 absolute bottom-0 left-0 right-0",
            timelineCollapsed ? "h-[96px]" : "h-[400px]"  // Adjust total height
          )}>
            <div 
              className="flex items-center justify-between p-4 border-b border-zinc-700 cursor-pointer hover:bg-zinc-750"
              onClick={() => setTimelineCollapsed(!timelineCollapsed)}
            >
              <span className="text-zinc-400 text-xs font-medium tracking-wide uppercase">
                Generated video timeline
              </span>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-zinc-400 transition-all",
                  timelineCollapsed && "rotate-180"
                )}
              />
            </div>
            <div className={cn(
              "flex-1 overflow-x-auto border-t border-zinc-700 transition-all",
              timelineCollapsed && "h-0"
            )}>
            <div className="min-w-[800px] h-full p-4">
              {/* Timeline content will go here */}
            </div>
          </div>
        </div>
          <Footer editor={editor} />
        </main>
      </div>
    </div>
  );
};
