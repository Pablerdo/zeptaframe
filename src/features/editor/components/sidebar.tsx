"use client";

import { 
  LayoutTemplate,
  ImageIcon,
  Pencil,
  Settings,
  Shapes,
  Sparkles,
  Type,
  ArrowUpRight,
  Crosshair,
  MessageSquare,
} from "lucide-react";


import { ActiveTool } from "@/features/editor/types";
import { SidebarItem } from "@/features/editor/components/sidebar-item";

interface SidebarProps {
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
};

export const Sidebar = ({
  activeTool,
  onChangeActiveTool,
}: SidebarProps) => {
  return (
    <aside className="modern-sidebar w-[100px] h-full flex flex-col py-3 mx-2">
      <ul className="flex flex-col space-y-2 px-2">
        {/* <SidebarItem
          icon={LayoutTemplate}
          label="Design"
          isActive={activeTool === "templates"}
          onClick={() => onChangeActiveTool("templates")}
        /> */}
        <SidebarItem
          icon={ImageIcon}
          label="Image"
          isActive={activeTool === "images"}
          onClick={() => onChangeActiveTool("images")}
        />
        <SidebarItem
          icon={Type}
          label="Text"
          isActive={activeTool === "text"}
          onClick={() => onChangeActiveTool("text")}
        />
        <SidebarItem
          icon={Shapes}
          label="Shapes"
          isActive={activeTool === "shapes"}
          onClick={() => onChangeActiveTool("shapes")}
        />
        <SidebarItem
          icon={Pencil}
          label="Draw"
          isActive={activeTool === "draw"}
          onClick={() => onChangeActiveTool("draw")}
        />
        {/* <SidebarItem
          icon={Sparkles}
          label="AI"
          isActive={activeTool === "ai"}
          onClick={() => onChangeActiveTool("ai")}
        /> */}
        <SidebarItem
          icon={Crosshair}
          label="Segment"
          isActive={activeTool === "segment"}
          onClick={() => onChangeActiveTool("segment")}
        />
        {/* <SidebarItem
          icon={ArrowUpRight}
          label="Control Motion"
          isActive={activeTool === "control-motion"}
          onClick={() => onChangeActiveTool("control-motion")}
        /> */}
        <SidebarItem
          icon={MessageSquare}
          label="Prompt"
          isActive={activeTool === "prompt"}
          onClick={() => onChangeActiveTool("prompt")}
        />
        <SidebarItem
          icon={Settings}
          label="Settings"
          isActive={activeTool === "settings"}
          onClick={() => onChangeActiveTool("settings")}
        />
      </ul>
    </aside>
  );
};
