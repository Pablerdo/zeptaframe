import { useRef, useEffect, useState, useCallback, Dispatch, SetStateAction } from "react";
import { fabric } from "fabric";

import {
  resizeCanvas,
  mergeMasks,
  maskImageCanvas,
  resizeAndPadBox,
  canvasToFloat32Array,
  float32ArrayToCanvas,
  sliceTensor,
  maskCanvasToFloat32Array,
  float32ArrayToBinaryMask
} from "@/app/sam/lib/imageutils";

import { 
  ActiveTool, 
  Editor,
} from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Check, Loader2, Trash2, Pencil, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { interpolatePoints, interpolatePosition, smoothTrajectory } from "@/features/editor/utils";
import { SegmentedMask } from "@/features/editor/types";

interface CameraControlSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const CameraControlSidebar = ({
  editor,
  activeTool,
  onChangeActiveTool,
}: CameraControlSidebarProps) => {

  const onClose = () => {
    onChangeActiveTool("select");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r rounded-xl z-[40] w-[360px] flex flex-col my-2",
        activeTool === "camera-control" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Camera Control"
        description="Coming soon..."
      />
   
      
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};
  