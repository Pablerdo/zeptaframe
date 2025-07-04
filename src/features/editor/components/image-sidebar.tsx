import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Loader, Upload, X } from "lucide-react";

import { ActiveTool, Editor } from "@/features/editor/types";
import { ToolSidebarClose } from "@/features/editor/components/tool-sidebar-close";
import { ToolSidebarHeader } from "@/features/editor/components/tool-sidebar-header";

import { useGetImages } from "@/features/images/api/use-get-images";

import { cn } from "@/lib/utils";
import { UploadButton } from "@/lib/uploadthing";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ImageSidebarProps {
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
}

export const ImageSidebar = ({ editor, activeTool, onChangeActiveTool }: ImageSidebarProps) => {
  const { data, isLoading, isError, refetch } = useGetImages();

  const onClose = () => {
    onChangeActiveTool("select");
  };

  const refetchImages = () => {
    refetch();
  }

  return (
    <aside
      className={cn(
        "bg-editor-sidebar relative border-r z-[40] rounded-xl w-[320px] flex flex-col my-2",
        activeTool === "images" ? "visible" : "hidden"
      )}
    >

      <div className="relative">
        <ToolSidebarHeader title="Images" description="Add images to your canvas" />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Close sidebar"
        >
          <X className="h-6 w-6 text-gray-600 dark:text-gray-100" />
        </button>
      </div>
      <div className="p-4 border-b">
        <UploadButton
          appearance={{
            button: "w-full text-sm font-medium",
            allowedContent: "hidden",
          }}
          content={{
            button: "Upload Image",
          }}
          endpoint="imageUploader"
          onClientUploadComplete={(res) => {
            editor?.addImage(res[0].url);
            toast.success("Image uploaded successfully");
            refetchImages();
          }}
          onUploadError={(error) => {
            toast.error("Failed to upload image: maximum size exceeded");
          }}
        />
      </div>
      {isLoading && (
        <div className="flex items-center justify-center flex-1">
          <Loader className="size-4 text-muted-foreground animate-spin" />
        </div>
      )}
      {isError && (
        <div className="flex flex-col gap-y-4 items-center justify-center flex-1">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">Failed to fetch images</p>
        </div>
      )}
      <ScrollArea>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {data &&
              data.map((image) => {
                return (
                  <button
                    onClick={() => editor?.addImage(image.urls.regular)}
                    key={image.id}
                    className="relative w-full h-[100px] group hover:opacity-75 transition bg-muted rounded-sm overflow-hidden border"
                  >
                    <img
                      src={image?.urls?.small || image?.urls?.thumb}
                      alt={image.alt_description || "Image"}
                      className="object-cover"
                      loading="lazy"
                    />
                    <div
                      className="opacity-0 group-hover:opacity-100 absolute left-0 bottom-0 w-full text-[10px] truncate text-white hover:underline p-1 bg-black/50 text-left"
                    >
                      {image.user.name}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
};
