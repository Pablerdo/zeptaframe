"use client";

import { fabric } from "fabric";
import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { ActiveTool, Editor as EditorType } from "@/features/editor/types";
import { cn } from "@/lib/utils";

interface WorkspaceProps {
  defaultState?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  clearSelectionCallback?: () => void;
  saveCallback?: (values: {
    json: string;
    height: number;
    width: number;
  }) => void;
  isActive: boolean;
  index: number;
  onActive: (editor: EditorType, index: number) => void;
  activeTool: ActiveTool;
  onDelete: (index: number) => void;
  canDelete: boolean;
}

export const Workspace = ({
  defaultState,
  defaultWidth,
  defaultHeight,
  clearSelectionCallback,
  saveCallback,
  isActive,
  index,
  onActive,
  activeTool,
  onDelete,
  canDelete
}: WorkspaceProps) => {
  // Create refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  
  // Initialize the editor with useEditor hook (at component top level)
  const { init, editor } = useEditor({
    defaultState,
    defaultWidth,
    defaultHeight,
    clearSelectionCallback,
    saveCallback,
  });

  // Initialize canvas when component mounts
  useEffect(() => {
    if (canvasRef.current && containerRef.current && !isInitializedRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        controlsAboveOverlay: true,
        preserveObjectStacking: true,
      });
      
      init({
        initialCanvas: canvas,
        initialContainer: containerRef.current,
      });
      
      isInitializedRef.current = true;
    }
  }, [init]);

  // Notify parent component when editor is ready or when active status changes
  useEffect(() => {
    if (editor && isActive) {
      onActive(editor, index);
    }
  }, [editor, isActive, index, onActive]);

  // Handle tool changes when this workspace is active
  useEffect(() => {
    if (isActive && editor) {
      if (activeTool === "draw") {
        editor.enableDrawingMode();
      } else if (activeTool === "segment") {
        editor.enableSegmentationMode();
      } else {
        // Disable special modes when not active
        editor.disableDrawingMode();
        editor.disableSegmentationMode();
      }
    }
  }, [isActive, activeTool, editor]);

  // Prevent canvas from being reset or losing content
  const handleContainerClick = (e: React.MouseEvent) => {
    // Prevent default only if clicking directly on the container (not canvas elements)
    if (e.target === containerRef.current) {
      e.preventDefault();
    }
  };

  // Handle delete button click
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent container click
    if (canDelete) {
      onDelete(index);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn("modern-canvas relative min-w-full max-w-full flex-shrink-0 h-full rounded-xl shadow-soft overflow-hidden mx-4")}
      style={{
        scrollSnapAlign: "start",
        opacity: isActive ? 1 : 0.98,
      }}
      onClick={handleContainerClick}
    >
      <canvas 
        ref={canvasRef} 
        className={cn(
          "border border-gray-200 dark:border-gray-700",
          activeTool === "segment" ? "cursor-crosshair" : "cursor-default"
        )}
      />
      {/* Workspace number indicator */}
      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>

      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors duration-200"
        title="Delete workspace"
        disabled={!canDelete}
        style={{
          opacity: canDelete ? 1 : 0.5,
          cursor: canDelete ? 'pointer' : 'not-allowed'
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      
    </div>
  );
}; 