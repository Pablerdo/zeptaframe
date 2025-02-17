  import { useRef, useEffect, useState } from "react";
  import { fabric } from "fabric";

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
  };
  
  export const SegmentationSidebar = ({
    editor,
    activeTool,
    onChangeActiveTool,
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

    const [mouseCoordinates, setMouseCoordinates] = useState<{ x: number; y: number } | null>(null);
    const [mouseRealCoordinates, setMouseRealCoordinates] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
      // Call encodeImageClick when entering segmentation mode
      if (activeTool === "segment" && editor?.canvas) {
        encodeImageClick();
        console.log("called encodeImageClick");
      }
    }, [activeTool, editor?.canvas]);

    useEffect(() => {
      // useEffect to handle mouse movement and click events for segmentation
      console.log("useEffect canvas");
      if (!editor?.canvas || activeTool !== "segment") return;
      console.log("useEffect canvas after if");

      // Start decoding, prompt with mouse coords
      const imageClick = (e: fabric.IEvent) => {
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
        
        console.log("Clicked on image");
        console.log("relativeX", relativeX);
        console.log("relativeY", relativeY);
        console.log("imageSize.w", imageSize.w);
        console.log("imageSize.h", imageSize.h);
        // Only process click if within workspace bounds
        if (relativeX >= 0 && relativeX <= imageSize.w && relativeY >= 0 && relativeY <= imageSize.h) {
          const point = {
            x: relativeX,
            y: relativeY,
            label: 1, /// Check again
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
  
      editor.canvas.on('mouse:down', imageClick);
  
      return () => {
        editor.canvas.off('mouse:down', imageClick);
      };
    }, [editor?.canvas, activeTool]);

    // Start encoding image
    const encodeImageClick = async () => {
      if (!samWorker.current || !editor?.canvas) return;
      
      const workspace = editor.getWorkspace();
      if (!workspace) return;

      // Get the workspace dimensions
      const workspaceWidth = workspace.width || 720;
      const workspaceHeight = workspace.height || 480;
      
      // Create a temporary canvas with the workspace content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = workspaceWidth;
      tempCanvas.height = workspaceHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Draw the workspace content onto the temp canvas
      const workspaceImage = editor.canvas.toDataURL({
        format: 'png',
        quality: 1,
        left: workspace.left || 0,
        top: workspace.top || 0,
        width: workspaceWidth,
        height: workspaceHeight
      });

      const img = new Image();
      img.onload = () => {
        tempCtx?.drawImage(img, 0, 0, workspaceWidth, workspaceHeight);
        
        samWorker.current?.postMessage({
          type: "encodeImage",
          data: canvasToFloat32Array(resizeCanvas(tempCanvas, imageSize)),
        });

        setLoading(true);
        setStatus("Encoding");
        console.log("Encoding image");
      };

      img.src = workspaceImage;
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

      // Add mask to canvas if in segment mode
      if (activeTool === "segment" && editor?.canvas) {
        const workspace = editor.getWorkspace();
        if (!workspace) return;

        // Convert the mask canvas to a Fabric image
        fabric.Image.fromURL(bestMaskCanvas.toDataURL(), (maskImage) => {
          // Position the mask at the workspace coordinates
          maskImage.set({
            left: workspace.left || 0,
            top: workspace.top || 0,
            width: workspace.width,
            height: workspace.height,
            selectable: false,
            evented: false,
            opacity: 0.5
          });

          // Remove any existing mask before adding the new one
          const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
          existingMasks.forEach(mask => editor.canvas.remove(mask));

          // Add metadata to identify this as a mask
          maskImage.data = { isMask: true };
          
          editor.canvas.add(maskImage);
          editor.canvas.renderAll();
        });
      }
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
        console.log("Encode image done");
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
        samWorker.current = new Worker(new URL("../../../sam/worker.js", import.meta.url), {
          type: "module",
        });
        samWorker.current.addEventListener("message", onWorkerMessage);
        samWorker.current.postMessage({ type: "ping" });
        console.log("Worker started");
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
              Points placed: 
            </Label>
          </div>
          
        <div className="shrink-0 h-[56px] border-b bg-white w-full flex items-center overflow-x-auto z-[49] p-2 gap-x-2">
          <div className="flex items-center h-full justify-center">
            <Button
                // onClick={onCancelSegmentation}
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
                  // onClick={() => handleSubmitSegmentation(segmentationPoints)}
                  size="sm"
                  variant="default"
                  className="flex items-center gap-x-2"
                  // disabled={segmentationPoints.length === 0}
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
  