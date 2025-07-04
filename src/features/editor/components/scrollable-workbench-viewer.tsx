import { ActiveTool } from "../types";
import { Workbench } from "./workbench";
import { ResponseType } from "@/features/projects/api/use-get-project";
import { Editor as EditorType } from "@/features/editor/types";
import { ProjectJSON } from "@/features/projects/api/use-get-project";
import { cn } from "@/lib/utils";

interface ScrollableWorkbenchViewerProps {
  editorsContainerRef: React.RefObject<HTMLDivElement>;
  workbenchIds: string[];
  activeWorkbenchIndex: number;
  handleSetActiveEditor: (editor: EditorType, index: number) => void;
  handleDeleteWorkbench: (index: number) => void;
  initialData: ResponseType["data"];
  debouncedSave: (values: { 
    workbenchId: string,
    json: string,
    height: number,
    width: number,
    promptData: string,
  }) => void;
  onClearSelection: () => void;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  samWorker: React.RefObject<Worker | null>;
  samWorkerLoading: boolean;
  setSamWorkerLoading: (samWorkerLoading: boolean) => void;
  prevMaskArray: Float32Array | null;
  setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
  mask: HTMLCanvasElement | null;
  setMask: (mask: HTMLCanvasElement | null) => void;
  maskBinary: HTMLCanvasElement | null;
  setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
  maskCentroid: { x: number; y: number } | null;
  setMaskCentroid: (centroid: { x: number; y: number } | null) => void;
  projectData: ProjectJSON;
  fadingWorkbenchIndex?: number | null;
  setAllowEncodeWorkbenchImage: (allowEncodeWorkbenchImage: boolean) => void;
  samWorkerInitialized: boolean;
  isTrial: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
  lastEncodedWorkbenchId: string;
  setLastEncodedWorkbenchId: (lastEncodedWorkbenchId: string) => void;
  timelineCollapsed: boolean;
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
  setSamWorkerLoading,
  prevMaskArray,
  setPrevMaskArray,
  mask,
  setMask,
  maskBinary,
  setMaskBinary,
  maskCentroid,
  setMaskCentroid,
  projectData,
  fadingWorkbenchIndex,
  setAllowEncodeWorkbenchImage,
  samWorkerInitialized,
  isTrial,
  setShowAuthModal,
  lastEncodedWorkbenchId,
  setLastEncodedWorkbenchId,
  timelineCollapsed,
}: ScrollableWorkbenchViewerProps) => {

  return (
      <div 
      ref={editorsContainerRef}
      className="flex-1 overflow-x-auto mt-2 mx-2 scroll-smooth relative hide-scrollbar" 
      style={{
        scrollSnapType: "x mandatory",
        display: "flex",
        WebkitOverflowScrolling: "touch",
        gap: "20px",
      }}
      >
      {/* Hide scrollbar for webkit browsers */}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {/* Render workbenches based on workbench IDs array */}
      {workbenchIds.map((id, index) => {
        const workbenchData = projectData.workbenches[id];
        const isFading = index === fadingWorkbenchIndex;
        
        return (
          <div 
            key={id} 
            className={`transition-all duration-300 ease-in-out ${isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            style={{
              flex: "0 0 100%", 
              width: "100%", 
              minWidth: "100%",
              scrollSnapAlign: "start",
              boxSizing: "border-box",
            }}
          >
            <Workbench
              projectId={initialData.id}
              index={index}
              isActive={index === activeWorkbenchIndex}
              workbenchId={id}
              onActive={handleSetActiveEditor}
              onDelete={handleDeleteWorkbench}
              canDelete={workbenchIds.length > 1}
              defaultState={workbenchData.json}
              defaultWidth={workbenchData.width}
              defaultHeight={workbenchData.height}
              defaultPromptData={workbenchData.promptData}
              clearSelectionCallback={onClearSelection}
              debouncedSave={(values) => debouncedSave({
                workbenchId: id,
                ...values
              })}
              activeTool={activeTool}
              onChangeActiveTool={onChangeActiveTool}
              samWorker={samWorker}
              samWorkerLoading={samWorkerLoading}
              setSamWorkerLoading={setSamWorkerLoading}
              prevMaskArray={prevMaskArray}
              setPrevMaskArray={setPrevMaskArray}
              mask={mask}
              setMask={setMask}
              maskBinary={maskBinary}
              setMaskBinary={setMaskBinary}
              setAllowEncodeWorkbenchImage={setAllowEncodeWorkbenchImage}
              samWorkerInitialized={samWorkerInitialized}
              isTrial={isTrial}
              setShowAuthModal={setShowAuthModal}
              lastEncodedWorkbenchId={lastEncodedWorkbenchId}
              setLastEncodedWorkbenchId={setLastEncodedWorkbenchId}
              maskCentroid={maskCentroid}
              setMaskCentroid={setMaskCentroid}
              timelineCollapsed={timelineCollapsed}
            />
          </div>
        );
      })}
      </div>
  )
}