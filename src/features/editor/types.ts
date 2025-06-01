import { fabric } from "fabric";
import { ITextboxOptions } from "fabric/fabric-impl";
import * as material from "material-colors";

export const JSON_KEYS = [
  "name",
  "gradientAngle",
  "selectable",
  "hasControls",
  "linkData",
  "editable",
  "extensionType",
  "extension",
  "scaleX",
  "scaleY",
];

export const filters = [
  "none",
  "polaroid",
  "sepia",
  "kodachrome",
  "contrast",
  "brightness",
  "greyscale",
  "brownie",
  "vintage",
  "technicolor",
  "pixelate",
  "invert",
  "blur",
  "sharpen",
  "emboss",
  "removecolor",
  "blacknwhite",
  "vibrance",
  "blendcolor",
  "huerotate",
  "resize",
  "saturation",
  "gamma",
];

export const fonts = [
  "Arial",
  "Arial Black",
  "Verdana",
  "Helvetica",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Courier New",
  "Brush Script MT",
  "Palatino",
  "Bookman",
  "Comic Sans MS",
  "Impact",
  "Lucida Sans Unicode",
  "Geneva",
  "Lucida Console",
];

export const selectionDependentTools = [
  "fill",
  "font",
  "filter",
  "opacity",
  "remove-bg",
  "stroke-color",
  "stroke-width",
];

export const colors = [
  material.red["500"],
  material.pink["500"],
  material.purple["500"],
  material.deepPurple["500"],
  material.indigo["500"],
  material.blue["500"],
  material.lightBlue["500"],
  material.cyan["500"],
  material.teal["500"],
  material.green["500"],
  material.lightGreen["500"],
  material.lime["500"],
  material.yellow["500"],
  material.amber["500"],
  material.orange["500"],
  material.deepOrange["500"],
  material.brown["500"],
  material.blueGrey["500"],
  "transparent",
];

export type ActiveTool =
  | "select"
  | "shapes"
  | "text"
  | "images"
  | "draw"
  | "fill"
  | "stroke-color"
  | "stroke-width"
  | "font"
  | "opacity"
  | "filter"
  | "settings"
  | "generate-image"
  | "remove-bg"
  | "templates"
  | "segment"
  | "crop";

export type ActiveWorkbenchTool = 
  | "select"
  | "animate"
  | "camera-control"
  | "prompt"
  | "model"
  | "first-frame";

export type ActiveSegmentationTool = 
  | "none"
  | "auto"
  | "manual"

export const FILL_COLOR = "rgba(0,0,0,1)";
export const STROKE_COLOR = "rgba(0,0,0,1)";
export const STROKE_WIDTH = 2;
export const STROKE_DASH_ARRAY = [];
export const FONT_FAMILY = "Arial";
export const FONT_SIZE = 32;
export const FONT_WEIGHT = 400;

export const CIRCLE_OPTIONS = {
  radius: 225,
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
};

export const RECTANGLE_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 400,
  height: 400,
  angle: 0,
};

export const DIAMOND_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 600,
  height: 600,
  angle: 0,
};

export const TRIANGLE_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 400,
  height: 400,
  angle: 0,
};

export const TEXT_OPTIONS = {
  type: "textbox",
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  fontSize: FONT_SIZE,
  fontFamily: FONT_FAMILY,
};

export interface EditorHookProps {
  defaultState?: string;
  defaultHeight?: number;
  defaultWidth?: number;
  defaultPromptData?: PromptData;
  clearSelectionCallback?: () => void;
  saveCallback?: (values: {
    json: string;
    height: number;
    width: number;
    promptData: string;
  }) => void;
}


export interface Workbench {
  id: string;
  canvasRef: React.RefObject<HTMLCanvasElement> | { current: null };
  containerRef: React.RefObject<HTMLDivElement> | { current: null };
  editor?: Editor;
}

export type BuildEditorProps = {
  undo: () => void;
  redo: () => void;
  save: (skip?: boolean) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  autoZoom: () => void;
  copy: () => void;
  paste: () => void;
  canvas: fabric.Canvas;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  selectedObjects: fabric.Object[];
  strokeDashArray: number[];
  fontFamily: string;
  setStrokeDashArray: (value: number[]) => void;
  setFillColor: (value: string) => void;
  setStrokeColor: (value: string) => void;
  setStrokeWidth: (value: number) => void;
  setFontFamily: (value: string) => void;
  workspaceURL: string | null;
  setWorkspaceURL: (value: string | null) => void;
};

export interface VideoExport {
  id: string;
  projectId: string;
  status: 'pending' | 'success' | 'error';
  videoUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  jobId?: string;
}

export interface VideoGeneration {
  id: string;
  projectId: string;
  workbenchId: string;
  runId: string;
  status: 'pending' | 'success' | 'error';
  videoUrl?: string | null;
  lastFrameUrl?: string | null;
  modelId?: string;
  computeMode?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface ImageGeneration {
  id: string;
  projectId: string;
  status: 'pending' | 'success' | 'error';
  imageUrl?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type WorkflowMode = "text-only" | "animation" | "ffe";

export type SupportedVideoModelId = 
  | "wan"
  | "skyreels"
  | "cogvideox"

export type BaseVideoModel = {
  id: SupportedVideoModelId;
  name: string;
  durations: number[];
};
  
export type CameraControl = {
  horizontalTruck: number;
  verticalTruck: number;
  dolly: number;
  horizontalPan: number;
  verticalPan: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface CoordinatePath {
  coordinates: Coordinate[];
}

export interface RotationKeyframe {
  trajectoryProgress: number; // 0.0 to 1.0
  rotation: number; // -180 to 180 degrees
}

export interface ScaleKeyframe {
  trajectoryProgress: number; // 0.0 to 1.0
  scale: number; // 0.1 to 3.0 (10% to 300%)
}

export interface SegmentedObject {
  id: string;
  url: string;
  name: string;
}

export type ComputeMode = "ultra" | "normal" | "flash";

export interface SegmentedMask {
  id: string;
  url: string;
  binaryUrl: string;
  name: string;
  isEditingName?: boolean;
  inProgress?: boolean;
  isApplied?: boolean;
  centroid?: { x: number; y: number };
  trajectory?: {
    points: Array<{x: number, y: number}>;
    isVisible: boolean;
  };
  originalTrajectory?: {
    points: Array<{x: number, y: number}>;
    isVisible: boolean;
  };
  rotation?: number;
  rotationKeyframes?: RotationKeyframe[];
  scaleKeyframes?: ScaleKeyframe[];
  rotationTrajectory?: number[]; // Generated from keyframes
  scaleTrajectory?: number[]; // Generated from keyframes
  isTextDetailsOpen?: boolean;
  textDetails?: string;
  zIndex?: number; // Z-dimension ordering (0 = bottom, higher = on top)
}

export interface PromptData {
  segmentedMasks: SegmentedMask[];
  cameraControl?: {
    // Stub for future implementation
    type?: string;
    parameters?: Record<string, any>;
  };
  generalTextPrompt: string;
  selectedModelId: SupportedVideoModelId;
}

export interface Editor {
  savePng: () => void;
  saveJpg: () => void;
  saveSvg: () => void;
  saveJson: () => void;
  loadJson: (json: string) => void;
  getJson: () => string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  autoZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getWorkspace: () => fabric.Object | undefined;
  changeBackground: (value: string) => void;
  changeSize: (value: { width: number; height: number }) => void;
  enableDrawingMode: () => void;
  disableDrawingMode: () => void;
  enableSegmentationMode: (drawMode: boolean) => void;
  disableSegmentationMode: () => void;
  enableCropMode: () => void;
  disableCropMode: () => void;
  onCopy: () => void;
  onPaste: () => void;
  changeImageFilter: (value: string) => void;
  addImage: (value: string) => void;
  delete: () => void;
  changeFontSize: (value: number) => void;
  getActiveFontSize: () => number;
  changeTextAlign: (value: string) => void;
  getActiveTextAlign: () => string;
  changeFontUnderline: (value: boolean) => void;
  getActiveFontUnderline: () => boolean;
  changeFontLinethrough: (value: boolean) => void;
  getActiveFontLinethrough: () => boolean;
  changeFontStyle: (value: string) => void;
  getActiveFontStyle: () => string;
  changeFontWeight: (value: number) => void;
  getActiveFontWeight: () => number;
  getActiveFontFamily: () => string;
  changeFontFamily: (value: string) => void;
  addText: (value: string, options?: ITextboxOptions) => void;
  getActiveOpacity: () => number;
  changeOpacity: (value: number) => void;
  bringForward: () => void;
  sendBackwards: () => void;
  changeStrokeWidth: (value: number) => void;
  changeFillColor: (value: string) => void;
  changeStrokeColor: (value: string) => void;
  changeStrokeDashArray: (value: number[]) => void;
  addCircle: () => void;
  addSoftRectangle: () => void;
  addRectangle: () => void;
  addTriangle: () => void;
  addInverseTriangle: () => void;
  addDiamond: () => void;
  canvas: fabric.Canvas;
  getActiveFillColor: () => string;
  getActiveStrokeColor: () => string;
  getActiveStrokeWidth: () => number;
  getActiveStrokeDashArray: () => number[];
  selectedObjects: fabric.Object[];
  workspaceURL: string | null;
  setWorkspaceURL: (value: string | null) => void;
}
