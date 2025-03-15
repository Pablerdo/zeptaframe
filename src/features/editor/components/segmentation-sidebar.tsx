import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Loader, Upload } from "lucide-react";

import { ActiveTool, Editor, SegmentedObject } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { useGetSegmentedObjects } from "@/features/images/api/use-get-segmented-objects";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface SegmentationSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  samWorker: React.RefObject<Worker | null>;

}

export const SegmentationSidebar = ({ 
  editor, 
  activeTool, 
  onChangeActiveTool,
  samWorker 
}: SegmentationSidebarProps) => {
  // const { data, isLoading, isError } = useGetImages();
  const { data, isLoading, isError } = useGetSegmentedObjects();

  const onClose = () => {
    onChangeActiveTool("select");
  };

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[360px] flex flex-col my-2",
        activeTool === "segment" ? "visible" : "hidden"
      )}
    >
      <ToolSidebarHeader title="Segmented Objects" description="Crop objects from your canvas and save them. Coming soon..." />
      <div className="p-4 border-b">
        <Button
          onClick={() => void 0}
        >
          Segment Object
        </Button>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center flex-1">
          <Loader className="size-4 text-muted-foreground animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex flex-col gap-y-4 items-center justify-center flex-1">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">Failed to fetch segmented objects</p>
        </div>
      )}
      <ScrollArea>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {data &&
              data.map((segmentedObject: any) => {
                return (
                  <button
                    onClick={() => editor?.addImage(segmentedObject.url)}
                    key={segmentedObject.id}
                    className="relative w-full h-[100px] group hover:opacity-75 transition bg-muted rounded-sm overflow-hidden border"
                  >
                    <img
                      src={segmentedObject.url}
                      alt={segmentedObject.name || "Segmented Object"}
                      className="object-cover"
                      loading="lazy"
                    />
                  </button>
                );
              })}
          </div>
        </div>
      </ScrollArea>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
};






// import { useRef, useEffect, useState, useCallback, Dispatch, SetStateAction } from "react";
// import { fabric } from "fabric";

// import { 
//   ActiveTool, 
//   Editor,
// } from "@/features/editor/types";
// import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
// import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

// import { cn } from "@/lib/utils";
// import { Label } from "@/components/ui/label";
// import { Button } from "@/components/ui/button";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { X, Check, Loader2, Trash2, Pencil, Plus, ChevronRight } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { interpolatePoints, interpolatePosition, smoothTrajectory } from "@/features/editor/utils";

// interface SegmentationSidebarProps {
//   editor: Editor | undefined;
//   activeTool: ActiveTool;
//   onChangeActiveTool: (tool: ActiveTool) => void;
//   samWorker: React.RefObject<Worker | null>;
//   samWorkerLoading: boolean;
//   prevMaskArray: Float32Array | null;
//   setPrevMaskArray: (prevMaskArray: Float32Array | null) => void;
//   mask: HTMLCanvasElement | null;
//   setMask: (mask: HTMLCanvasElement | null) => void;
//   maskBinary: HTMLCanvasElement | null;
//   setMaskBinary: (maskBinary: HTMLCanvasElement | null) => void;
// };

// export const SegmentationSidebar = ({
//   editor,
//   activeTool,
//   onChangeActiveTool,
//   samWorker,
//   samWorkerLoading,
//   prevMaskArray,
//   setPrevMaskArray,
//   mask,
//   setMask,
//   maskBinary,
//   setMaskBinary,
// }: SegmentationSidebarProps) => {

//   const [imageSize, setImageSize] = useState({ w: 1024, h: 1024 });
//   const [maskSize, setMaskSize] = useState({ w: 256, h: 256 });
//   const pointsRef = useRef<Array<{ x: number; y: number; label: number }>>([]);
//   const [isSegmentationActive, setIsSegmentationActive] = useState(false);

//   const onClose = () => {
//     setIsSegmentationActive(false);
//     onChangeActiveTool("select");
//   };

//   // Add this effect to handle canvas interactivity
//   useEffect(() => {
//     if (!editor?.canvas) return;
    
//     if (activeTool !== "segment") {
//       // Reset to default cursors when sidebar is closed
//       editor.canvas.hoverCursor = 'default';
//       editor.canvas.defaultCursor = 'default';
//       editor.canvas.selection = true;
//       editor.canvas.forEachObject((obj) => {
//         if (!obj.data?.isMask) {
//           obj.selectable = true;
//           obj.evented = true;
//         }
//       });
//     } else if (samWorkerLoading) {
//       // Disable all canvas interactions while loading
//       editor.canvas.selection = false;
//       editor.canvas.forEachObject((obj) => {
//         obj.selectable = false;
//         obj.evented = false;
//       });
//       editor.canvas.hoverCursor = 'progress';
//       editor.canvas.defaultCursor = 'progress';
//     } else {
//       // Disable all interactions when sidebar is open but not actively segmenting
//       editor.canvas.selection = false;
//       editor.canvas.forEachObject((obj) => {
//         obj.selectable = false;
//         obj.evented = false;
//       });
//       editor.canvas.hoverCursor = 'crosshair';
//       editor.canvas.defaultCursor = 'crosshair';
//     }
    
//     editor.canvas.renderAll();
//   }, [samWorkerLoading, editor?.canvas, activeTool]);

//   const handleNewMask = () => {
//     // Stop all active animations first
//     Object.values(activeAnimations).forEach(animation => animation.stop());
//     setActiveAnimations({});
    
//     // Deapply all masks from canvas
//     if (editor?.canvas) {
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
//     }
    
//     setIsSegmentationActive(true);
//     if (editor) {
//       // Create a completely new array with a unique ID for the in-progress mask
//       const updatedMasks = [
//         { id: crypto.randomUUID(), url: '', binaryUrl: '', name: 'New Object', inProgress: true },
//         ...editor.segmentedMasks.map(mask => ({ ...mask, isApplied: false }))
//       ];

//       // Force update by creating a new array
//       editor.setSegmentedMasks([...updatedMasks]);
      
//       // Add a setTimeout to check if state updated
//       setTimeout(() => {
//         console.log("segmentedMasks after update:", editor.segmentedMasks);
//       }, 0);
      
//       // Reset any current mask
//       setMask(null);
//       // setSamWorkerLoading(false);
//     }
//   };

//   const handleSaveInProgressMask = () => {
//     console.log("handleSaveInProgressMask");
//     console.log("mask", mask);
//     console.log("maskBinary", maskBinary);
//     console.log("editor", editor);
//     console.log("editor.segmentedMasks", editor?.segmentedMasks);
//     if (mask && maskBinary && editor) {
//       const maskDataUrl = mask.toDataURL('image/png');
//       const maskBinaryDataUrl = maskBinary.toDataURL('image/png');
//       const newMaskId = crypto.randomUUID();
      
//       // Get count of actual saved masks (excluding the stub)
//       const savedMasksCount = editor.segmentedMasks.filter(mask => mask.url).length;

//       console.log("segmentedMasks before setup", editor.segmentedMasks);

//       // First update the state with a new array
//       const updatedMasks = [
//         { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: false }, // New stub at top
//         ...editor.segmentedMasks.map((mask, index) => 
//           index === 0 ? 
//           { 
//             ...mask, 
//             id: newMaskId,
//             url: maskDataUrl, 
//             binaryUrl: maskBinaryDataUrl,
//             inProgress: false, 
//             isApplied: true,
//             name: `Object ${savedMasksCount + 1}` 
//           } : {
//             ...mask,
//             isApplied: false
//           }
//         ).filter(mask => !mask.inProgress)
//       ];
//       editor.setSegmentedMasks([...updatedMasks]);

//       console.log("segmentedMasks after setup", editor.segmentedMasks);
//       // Then set up the mask in Fabric.js
//       if (editor.canvas) {
//         // Remove any existing masks
//         const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//         existingMasks.forEach(mask => editor.canvas.remove(mask));

//         // Create new mask image
//         fabric.Image.fromURL(maskDataUrl, (maskImage) => {
//           const workspace = editor.getWorkspace();
//           if (!workspace) return;

//           // Set all basic properties
//           maskImage.set({
//             left: workspace.left || 0,
//             top: workspace.top || 0,
//             width: workspace.width || 720,
//             height: workspace.height || 480,
//             selectable: false,
//             evented: false,
//             opacity: 0.9,
//           });

//           // Explicitly set the data property with both isMask and url
//           maskImage.data = { 
//             isMask: true, 
//             url: maskDataUrl 
//           };

//           // Add to canvas and ensure data is set
//           editor.canvas.add(maskImage);
          
//           // Double check the data is set
//           const addedObject = editor.canvas.getObjects().find(obj => obj.data?.isMask);
//           console.log('New mask saved with data:', addedObject?.data);
//           setIsSegmentationActive(false);
//           editor.canvas.renderAll();
//         });

//         // Reset current mask state
//         setMask(null);
//         setPrevMaskArray(null);
//         pointsRef.current = [];
//         setIsSegmentationActive(false);
//       }
//     }
//   };

//   const handleCancelInProgressMask = () => {
//     // Remove mask from canvas
//     if (editor?.canvas) {
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
//     }
    
//     // Reset current mask state
//     setMask(null);
//     setPrevMaskArray(null);
//     pointsRef.current = [];
//     setIsSegmentationActive(false);
    
//     // Reset the top stub to "New Mask" state
//     if (editor) {
//       const updatedMasks = [
//         { id: "", url: '', binaryUrl: '', name: 'New Object', inProgress: false },
//         ...editor.segmentedMasks.filter(mask => !mask.inProgress)
//       ];
//       editor.setSegmentedMasks(updatedMasks);
//     }
//   };

//   const handleApplyMask = (maskUrl: string, index: number) => {
//     if (!editor?.canvas) return;

//     // Get the actual index in the full segmentedMasks array
//     const actualIndex = editor.segmentedMasks.findIndex(mask => mask.url === maskUrl);
    
//     // If the mask is already applied, just remove it and update state
//     if (editor.segmentedMasks[actualIndex].isApplied) {
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
      
//       const updatedMasks = editor.segmentedMasks.map(mask => ({
//         ...mask,
//         isApplied: false
//       }));
//       editor.setSegmentedMasks(updatedMasks);
//       return;
//     }

//     // Otherwise, apply the new mask
//     const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//     existingMasks.forEach(mask => editor.canvas.remove(mask));
    
//     setIsSegmentationActive(false);
//     setMask(null);
//     setPrevMaskArray(null);
//     pointsRef.current = [];

//     fabric.Image.fromURL(maskUrl, (maskImage) => {
//       const workspace = editor.getWorkspace();
//       if (!workspace) return;

//       // Set all basic properties
//       maskImage.set({
//         left: workspace.left || 0,
//         top: workspace.top || 0,
//         width: workspace.width || 720,
//         height: workspace.height || 480,
//         selectable: false,
//         evented: false,
//         opacity: 0.9
//       });

//       // Explicitly set the data property with both isMask and url
//       maskImage.data = { 
//         isMask: true, 
//         url: maskUrl 
//       };

//       // Add to canvas and ensure data is set
//       editor.canvas.add(maskImage);
      
//       // Double check the data is set
//       const addedObject = editor.canvas.getObjects().find(obj => obj.data?.isMask);
//       console.log('Mask applied with data:', addedObject?.data);
      
//       editor.canvas.renderAll();

//       // Update state to reflect which mask is applied
//       const updatedMasks = editor.segmentedMasks.map((mask, i) => ({
//         ...mask,
//         isApplied: i === actualIndex,
//         inProgress: false
//       }));
//       editor.setSegmentedMasks(updatedMasks);
//     });
//   };

//   // Update click handling to only work when segmentation is active
//   useEffect(() => {
//     console.log("isSegmentationActive", isSegmentationActive);
//     console.log("activeTool", activeTool);
//     // Add this isSegmentationActive check
//     if (!editor?.canvas || activeTool !== "segment") return;

//     const imageClick = (e: fabric.IEvent) => {
//       console.log("imageClick", isSegmentationActive);
//       console.log("samWorkerLoading", samWorkerLoading);
//       console.log("editor?.canvas", editor?.canvas);
//       console.log("isSegmentationActive", isSegmentationActive);

//       if (samWorkerLoading || !editor?.canvas ||  !isSegmentationActive) return;

//       console.log("click detected, inside imageClick");
//       const pointer = editor.canvas.getPointer(e.e);
//       const workspace = editor.getWorkspace();
//       if (!workspace) return;

//       // Get the workspace object's position
//       const workspaceLeft = workspace.left || 0;
//       const workspaceTop = workspace.top || 0;

//       // Calculate relative coordinates within the workspace
//       const relativeX = Math.round(pointer.x - workspaceLeft);
//       const relativeY = Math.round(pointer.y - workspaceTop);
      
//       // Only process click if within workspace bounds
//       if (relativeX >= 0 && relativeX <= imageSize.w && relativeY >= 0 && relativeY <= imageSize.h) {

//         // Get workspace dimensions
//         const workspaceWidth = workspace.width || 720;
//         const workspaceHeight = workspace.height || 480;


//         // Normalize coordinates from workspace dimensions to target size
//         const normalizedX = Math.round((relativeX / workspaceWidth) * imageSize.w);
//         const normalizedY = Math.round((relativeY / workspaceHeight) * imageSize.h);
        

//         const point = {
//           x: normalizedX,
//           y: normalizedY,
//           label: 1,
//         };

//         pointsRef.current.push(point);
//         console.log("click detected, inside imageClick");
//         // do we have a mask already? ie. a refinement click?
//         if (prevMaskArray) {
//           const maskShape = [1, 1, maskSize.w, maskSize.h];

//           samWorker.current?.postMessage({
//             type: "decodeMask",
//             data: {
//               points: pointsRef.current,
//               maskArray: prevMaskArray,
//               maskShape: maskShape,
//             }
//           });      
//         } else {
//           samWorker.current?.postMessage({
//             type: "decodeMask",
//             data: {
//               points: pointsRef.current,
//               maskArray: null,
//               maskShape: null,
//             }
//           });      
//         }
//       }
//     };

//     editor.canvas.on('mouse:down', imageClick);
//     return () => {
//       editor.canvas.off('mouse:down', imageClick);
//     };
//   }, [editor?.canvas, activeTool, samWorkerLoading, isSegmentationActive]);

//   // editor?.canvas, activeTool, imageEncoded, imageSize.w, imageSize.h, maskSize.w, maskSize.h
//   // Clear masks when sidebar closes
//   useEffect(() => {
//     if (activeTool !== "segment" && editor?.canvas) {
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
      
//     }
//   }, [activeTool, editor?.canvas]);



//   const handleDeleteMask = (index: number) => {
//     if (!editor) return;
    
//     // Get the mask URL before removing it from state
//     const maskToDelete = editor.segmentedMasks[index];
//     if (maskToDelete?.url && activeAnimations[maskToDelete.url]) {
//       // Stop the animation for this specific mask
//       activeAnimations[maskToDelete.url].stop();
//       // Remove it from active animations
//       setActiveAnimations(prev => {
//         const newAnimations = { ...prev };
//         delete newAnimations[maskToDelete.url];
//         return newAnimations;
//       });
//     }
    
//     // Continue with deletion
//     const updatedMasks = editor.segmentedMasks.filter((_, i) => i !== index);
//     editor.setSegmentedMasks(updatedMasks);
    
//     if (editor.canvas) {
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
//     }
//   };

//   const handleStartRename = (index: number) => {
//     if (editor) {
//       const updatedMasks = editor.segmentedMasks.map((mask, i) => 
//         i === index ? { ...mask, isEditing: true } : mask
//       );
//       editor.setSegmentedMasks(updatedMasks);
//     }
//   };

//   const handleFinishRename = (index: number, newName: string) => {
//     if (editor) {
//       const updatedMasks = editor.segmentedMasks.map((mask, i) => 
//         i === index ? { ...mask, name: newName, isEditing: false } : mask
//       );
//       editor.setSegmentedMasks(updatedMasks);
//     }
//   };

//   const handleKeyPress = (event: React.KeyboardEvent, index: number, newName: string) => {
//     if (event.key === 'Enter') {
//       handleFinishRename(index, newName);
//     }
//   };

//   // Update effect for sidebar open/close
//   useEffect(() => {
//     if (activeTool !== "segment" && editor?.canvas) {
//       // Clear masks from canvas
//       const existingMasks = editor.canvas.getObjects().filter(obj => obj.data?.isMask);
//       existingMasks.forEach(mask => editor.canvas.remove(mask));
//       editor.canvas.renderAll();
      
//       // Reset all masks' applied status
//       if (editor) {
//         const updatedMasks = editor.segmentedMasks.map(mask => ({
//           ...mask,
//           isApplied: false
//         }));
//         editor.setSegmentedMasks(updatedMasks);
//       }
//     }
//   }, [activeTool, editor?.canvas]);


//   return (
//     <aside
//       className={cn(
//         "bg-editor-sidebar relative border-r rounded-xl z-[40] w-[360px] flex flex-col my-2",
//         activeTool === "segment" ? "visible" : "hidden",
//       )}
//     >
//       <ToolSidebarHeader
//         title="Segment Objects"
//         description="Click on object to save it"
//       />

//       <ScrollArea>
//         <div className="p-4 space-y-4 border-b">
//           <Label className="text-sm">
//             Segmented Objects 
//           </Label>
          
//           {/* Add loading and status indicator */}
//           <div className="mt-4 space-y-2">
//             {samWorkerLoading && (
//               <div className="flex items-center space-x-2 text-muted-foreground">
//                 <Loader2 className="w-4 h-4 animate-spin" />
//                 <span className="text-sm">{status}</span>
//               </div>
//             )}
//             {!samWorkerLoading && status && (
//               <div className="text-sm text-muted-foreground">
//                 {status}
//               </div>
//             )}
//           </div>

//           {/* Segmented masks list */}
//           <div className="space-y-2">
//             {/* Always show the "New Object" stub at the top */}
//             <div className="flex items-center justify-between p-2 border rounded-md">
//               <div className="flex items-center space-x-2">
//                 <span className="text-sm">New Object</span>
//               </div>
//               <div className="flex items-center space-x-2">
//                 {isSegmentationActive ? (
//                   <>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={handleSaveInProgressMask}
//                       disabled={!mask}
//                     >
//                       <Check className="w-4 h-4 mr-1" />
//                       Save Mask as Object
//                     </Button>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={handleCancelInProgressMask}
//                     >
//                       <X className="w-4 h-4 mr-1" />
//                       Cancel
//                     </Button>
//                   </>
//                 ) : (
//                   <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={handleNewMask}
//                     disabled={samWorkerLoading}
//                   >
//                     <Plus className="w-4 h-4 mr-1" />
//                     New Mask
//                   </Button>
//                 )}
//               </div>
//             </div>

//             {/* Empty state message */}
//             {editor?.segmentedMasks.length === 0 && (
//               <div className="p-6 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-md mt-3 bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center space-y-3">
//                 <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
//                   <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//                     <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
//                     <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
//                     <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
//                     <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
//                     <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
//                     <line x1="12" y1="22.08" x2="12" y2="12"></line>
//                   </svg>
//                 </div>
//                 <div>
//                   <h4 className="text-base font-medium text-foreground">No segmented objects yet</h4>
//                   <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
//                     Create your first object by clicking &quot;New Mask&quot; above to start segmenting content.
//                   </p>
//                 </div>
//               </div>
//             )}

//           </div>
//         </div>
//       </ScrollArea>
      
//       <ToolSidebarClose onClick={onClose} />
//     </aside>
//   );
// };
  