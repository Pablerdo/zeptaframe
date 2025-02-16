  import { useRef, useEffect, useState } from "react";
  import {
    resizeCanvas,
    mergeMasks,
    maskImageCanvas,
    resizeAndPadBox,
    canvasToFloat32Array,
    float32ArrayToCanvas,
    sliceTensor,
    maskCanvasToFloat32Array
  } from "@/sam/lib/imageutils";

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

    const samWorker = useRef<Worker | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [imageEncoded, setImageEncoded] = useState(false);
    const [device, setDevice] = useState(null);
    const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
    const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });
    const [prevMaskArray, setPrevMaskArray] = useState<Float32Array | null>(null);
    const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
    const pointsRef = useRef<Array<{ x: number; y: number; label: number }>>([]);

    // Start encoding image
    const encodeImageClick = async () => {
      if (!samWorker.current || !editor?.canvas) return;
      
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get the workspace dimensions
      const workspaceWidth = workspace.width || 1024;
      const workspaceHeight = workspace.height || 1024;
      
      setImageSize({ w: workspaceWidth, h: workspaceHeight });
      
      // TODO: Get actual image data from workspace
      samWorker.current.postMessage({
        type: "encodeImage",
        // data: canvasToFloat32Array(resizeCanvas(image, imageSize)),
      });

      setLoading(true);
      setStatus("Encoding");
    };

    // Start decoding, prompt with mouse coords
    const imageClick = (e: fabric.IEvent<MouseEvent>) => {
      if (!imageEncoded || !editor?.canvas) return;

      const pointer = editor.canvas.getPointer(e.e);
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get the workspace object's position
      const workspaceLeft = workspace.left || 0;
      const workspaceTop = workspace.top || 0;

      // Calculate relative coordinates within the workspace
      const relativeX = Math.round(pointer.x - workspaceLeft);
      const relativeY = Math.round(pointer.y - workspaceTop);

      // Only process click if within workspace bounds
      if (relativeX >= 0 && relativeX <= imageSize.w && relativeY >= 0 && relativeY <= imageSize.h) {
        const point = {
          x: relativeX,
          y: relativeY,
          label: e.e.button === 0 ? 1 : 0,
        };

        pointsRef.current.push(point);

        // do we have a mask already? ie. a refinement click?
        if (prevMaskArray) {
          const maskShape = [1, 1, maskSize.w, maskSize.h];

          samWorker.current?.postMessage({
            type: "decodeMask",
            data: {
              points: pointsRef.current,
              maskArray: prevMaskArray,
              maskShape: maskShape,
            }
          });      
        } else {
          samWorker.current?.postMessage({
            type: "decodeMask",
            data: {
              points: pointsRef.current,
              maskArray: null,
              maskShape: null,
            }
          });      
        }
      }
    };

    
    const handleDecodingResults = (decodingResults: { 
      masks: { dims: number[]; }; 
      iou_predictions: { cpuData: number[]; }; 
    }) => {
      // SAM2 returns 3 mask along with scores -> select best one
      const maskTensors = decodingResults.masks;
      const [bs, noMasks, width, height] = maskTensors.dims;
      const maskScores = decodingResults.iou_predictions.cpuData;
      const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
      const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx)
      let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
      bestMaskCanvas = resizeCanvas(bestMaskCanvas, imageSize);
  
      setMask(bestMaskCanvas);
      setPrevMaskArray(bestMaskArray);
    };


    // Handle web worker messages
    const onWorkerMessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      if (type == "pong") {
        const { success, device } = data;

        if (success) {
          setLoading(false);
          setDevice(device);
          setStatus("Encode image");
        } else {
          setStatus("Error (check JS console)");
        }
      } else if (type == "downloadInProgress" || type == "loadingInProgress") {
        setLoading(true);
        setStatus("Loading model");
      } else if (type == "encodeImageDone") {
        // alert(data.durationMs)
        setImageEncoded(true);
        setLoading(false);
        setStatus("Ready. Click on image");
      } else if (type == "decodeMaskResult") {
        handleDecodingResults(data);
        setLoading(false);
        setStatus("Ready. Click on image");
      }
    };

    useEffect(() => {
      if (!samWorker.current) {
        samWorker.current = new Worker(new URL("../../sam/worker.js", import.meta.url), {
          type: "module",
        });
        samWorker.current.addEventListener("message", onWorkerMessage);
        samWorker.current.postMessage({ type: "ping" });
  
        setLoading(true);
      }
    }, [onWorkerMessage, handleDecodingResults]);


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
  