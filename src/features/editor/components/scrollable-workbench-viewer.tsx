import { ActiveTool } from "../types";
import { Workbench } from "./workbench";
import { ResponseType } from "@/features/projects/api/use-get-project";
import { Editor as EditorType } from "@/features/editor/types";

interface ScrollableWorkbenchViewerProps {
  editorsContainerRef: React.RefObject<HTMLDivElement>;
  workbenchIds: string[];
  activeWorkbenchIndex: number;
  handleSetActiveEditor: (editor: EditorType, index: number) => void;
  handleDeleteWorkbench: (index: number) => void;
  initialData: ResponseType["data"];
  debouncedSave: (values: { 
    json: string,
    height: number,
    width: number,
  }) => void;
  onClearSelection: () => void;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  samWorker: React.RefObject<Worker | null>;
  samWorkerLoading: boolean;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
}


export const ScrollableWorkbenchViewer = ({
  editorsContainerRef,
  workbenchIds,
  activeWorkbenchIndex,
  handleSetActiveEditor,
  handleDeleteWorkbench,
  initialData,
  debouncedSave,
  onClearSelection,
  activeTool,
  onChangeActiveTool,
  samWorker,
  samWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
}: ScrollableWorkbenchViewerProps) => {

  return (
      <div 
      ref={editorsContainerRef}
      className="flex-1 overflow-x-auto mt-2 mx-2 scroll-smooth" 
      style={{
        scrollSnapType: "x mandatory",
        display: "flex",
        WebkitOverflowScrolling: "touch",
        gap: "20px",
      }}
      >
      {/* Render workbenches based on workbench IDs array */}
      {workbenchIds.map((id, index) => {
        return (
          <div 
            key={id} 
            style={{
              flex: "0 0 100%", 
              width: "100%", 
              minWidth: "100%",
              scrollSnapAlign: "start",
              boxSizing: "border-box",
            }}
          >
            <Workbench
              index={index}
              isActive={index === activeWorkbenchIndex}
              onActive={handleSetActiveEditor}
              onDelete={handleDeleteWorkbench}
              canDelete={workbenchIds.length > 1}
              defaultState={initialData.json}
              defaultWidth={720}
              defaultHeight={480}
              clearSelectionCallback={onClearSelection}
              debouncedSave={debouncedSave}
              activeTool={activeTool}
              onChangeActiveTool={onChangeActiveTool}
              samWorker={samWorker}
              samWorkerLoading={samWorkerLoading}
              prevMaskArray={prevMaskArray}
              setPrevMaskArray={setPrevMaskArray}
              mask={mask}
              setMask={setMask}
              maskBinary={maskBinary}
              setMaskBinary={setMaskBinary}
            />
          </div>
        );
      })}
      </div>
)
}