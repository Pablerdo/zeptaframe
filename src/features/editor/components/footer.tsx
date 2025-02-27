import { Minimize, ZoomIn, ZoomOut } from "lucide-react";

import { Editor } from "@/features/editor/types";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";

interface FooterProps {
  editor: Editor | undefined;
};

export const Footer = ({ editor }: FooterProps) => {
  return (
    <footer className="h-[52px] modern-toolbar w-full flex items-center overflow-x-auto z-[49] p-2 gap-x-1 shrink-0 px-4 flex-row-reverse mx-2 my-2">
      <Hint label="Reset" side="top" sideOffset={10}>
        <Button
          onClick={() => editor?.autoZoom()}
          size="icon"
          variant="tool"
          className="h-full"
        >
          <Minimize className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom in" side="top" sideOffset={10}>
        <Button
          onClick={() => editor?.zoomIn()}
          size="icon"
          variant="tool"
          className="h-full"
        >
          <ZoomIn className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom out" side="top" sideOffset={10}>
        <Button
          onClick={() => editor?.zoomOut()}
          size="icon"
          variant="tool"
          className="h-full"
        >
          <ZoomOut className="size-4" />
        </Button>
      </Hint>
    </footer>
  );
};
