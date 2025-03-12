"use client";

import { fabric } from "fabric";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/features/editor/hooks/use-editor";
import { ActiveTool, Editor as EditorType } from "@/features/editor/types";
import { cn } from "@/lib/utils";

interface WorkbenchProps {
  defaultState?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  clearSelectionCallback?: () => void;
  debouncedSave?: (values: {
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

export const Workbench = ({
  defaultState,
  defaultWidth,
  defaultHeight,
  clearSelectionCallback,
  debouncedSave,
  isActive,
  index,
  onActive,
  activeTool,
  onDelete,
  canDelete
}: WorkbenchProps) => {
  // Create refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const hasNotifiedActiveRef = useRef(false);
  
  // Initialize the editor with useEditor hook
  const { init, editor } = useEditor({
    defaultState,
    defaultWidth,
    defaultHeight,
    clearSelectionCallback,
    saveCallback: debouncedSave,
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

  // Notify parent component when this workbench becomes active
  // But only do it once per active state change to prevent loops
  useEffect(() => {
    if (editor && isActive) {
      onActive(editor, index);
    }
  }, [editor, isActive, index, onActive]);

  // Handle tool changes when this workbench is active
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
        // background: `radial-gradient(circle at center, rgba(128, 128, 128, 0.15) 0%, rgba(128, 128, 128, 0.03) 0%)`,
        // background: `radial-gradient(ellipse closest-side at 50% 50%, #ffffff 0%, #e0e0e0 100%  )`,
      }}
      onClick={handleContainerClick}
    >
      <canvas 
        ref={canvasRef} 
        className={cn(
          "border border-gray-200 dark:border-gray-700 rounded-xl",
          activeTool === "segment" ? "cursor-crosshair" : "cursor-default"
        )}
      />
      {/* workbench number indicator */}
      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>

      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors duration-200"
        title="Delete workbench"
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