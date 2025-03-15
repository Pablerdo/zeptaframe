import { fabric } from "fabric";
import { useCallback, useRef, useState } from "react";
import { SegmentedMask, SupportedVideoModelId } from "@/features/editor/types";
import { JSON_KEYS } from "@/features/editor/types";
import { defaultVideoModelId } from "../utils/videoModels";
import { precisionReplacer } from "../utils/json-helpers";

interface UseHistoryProps {
  canvas: fabric.Canvas | null;
  editorState?: {
    segmentedMasks: SegmentedMask[];
    prompt: string;
    selectedModelId: SupportedVideoModelId;
    cameraControl?: Record<string, any>;
  };
  saveCallback?: (values: {
    json: string;
    height: number;
    width: number;
    promptData: string;
  }) => void;
};

export const useHistory = ({ canvas, saveCallback, editorState }: UseHistoryProps) => {
  const [historyIndex, setHistoryIndex] = useState(0);
  const canvasHistory = useRef<string[]>([]);
  const skipSave = useRef(false);

  const canUndo = useCallback(() => {
    return historyIndex > 0;
  }, [historyIndex]);

  const canRedo = useCallback(() => {
    return historyIndex < canvasHistory.current.length - 1;
  }, [historyIndex]);

  const save = useCallback((skip = false) => {
    if (!canvas) return;

    const currentState = canvas.toJSON(JSON_KEYS);

    const json = JSON.stringify(currentState, precisionReplacer);

    if (!skip && !skipSave.current) {
      canvasHistory.current.push(json);
      setHistoryIndex(canvasHistory.current.length - 1);
    }

    const workspace = canvas
      .getObjects()
      .find((object) => object.name === "clip");
    const height = workspace?.height || 0;
    const width = workspace?.width || 0;

    // Create promptData from editor state
    const promptData = JSON.stringify({
      segmentedMasks: editorState?.segmentedMasks || [],
      cameraControl: editorState?.cameraControl || {},
      textPrompt: editorState?.prompt || "",
      selectedModelId: editorState?.selectedModelId || defaultVideoModelId
    });

    saveCallback?.({ json, height, width, promptData });
  }, 
  [
    canvas,
    saveCallback,
    editorState
  ]);

  const undo = useCallback(() => {
    if (canUndo()) {
      skipSave.current = true;
      canvas?.clear().renderAll();

      const previousIndex = historyIndex - 1;
      const previousState = JSON.parse(
        canvasHistory.current[previousIndex]
      );

      canvas?.loadFromJSON(previousState, () => {
        canvas.renderAll();
        setHistoryIndex(previousIndex);
        skipSave.current = false;
      });
    }
  }, [canUndo, canvas, historyIndex]);

  const redo = useCallback(() => {
    if (canRedo()) {
      skipSave.current = true;
      canvas?.clear().renderAll();

      const nextIndex = historyIndex + 1;
      const nextState = JSON.parse(
        canvasHistory.current[nextIndex]
      );

      canvas?.loadFromJSON(nextState, () => {
        canvas.renderAll();
        setHistoryIndex(nextIndex);
        skipSave.current = false;
      });
    }
  }, [canvas, historyIndex, canRedo]);

  return { 
    save,
    canUndo,
    canRedo,
    undo,
    redo,
    setHistoryIndex,
    canvasHistory,
  };
};
