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
    workbenchIndex: number,
  }) => void;
  onClearSelection: () => void;
  activeTool: ActiveTool;
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
}: ScrollableWorkbenchViewerProps) => {

  return (
      <div 
      ref={editorsContainerRef}
      className="flex-1 overflow-x-auto mt-2 mx-2 scroll-smooth" 
      style={{
        scrollSnapType: "x mandatory",
        display: "flex",
        WebkitOverflowScrolling: "touch",
      }}
      >
      {/* Render workbenches based on workbench IDs array */}
      {workbenchIds.map((id, index) => {
        // Parse workbench data for this index
        let workbenchState, workbenchWidth, workbenchHeight;
        
        try {
          const data = JSON.parse(initialData.json || '{"workbenches":[]}');
          if (data.workbenches && data.workbenches[index]) {
            const workbench = data.workbenches[index];
            workbenchState = workbench.json;
            workbenchWidth = workbench.width;
            workbenchHeight = workbench.height;
          } else if (index === 0) {
            // Fallback for first workbench if in old format
            workbenchState = initialData.json;
            workbenchWidth = initialData.width;
            workbenchHeight = initialData.height;
          }
        } catch (error) {
          console.error(`Error parsing workbench data for index ${index}:`, error);
          if (index === 0) {
            // Fallback for first workbench
            workbenchState = initialData.json;
            workbenchWidth = initialData.width;
            workbenchHeight = initialData.height;
          }
        }
        
        return (
          <Workbench
            key={id}
            index={index}
            isActive={index === activeWorkbenchIndex}
            onActive={handleSetActiveEditor}
            onDelete={handleDeleteWorkbench}
            canDelete={workbenchIds.length > 1}
            defaultState={workbenchState}
            defaultWidth={workbenchWidth}
            defaultHeight={workbenchHeight}
            clearSelectionCallback={onClearSelection}
            debouncedSave={debouncedSave}
            activeTool={activeTool}
          />
        );
      })}
      </div>
)
}