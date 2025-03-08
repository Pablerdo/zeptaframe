import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick: () => void;
};

export const SidebarItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}: SidebarItemProps) => {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full h-full aspect-video p-3 py-4 flex flex-col rounded-xl transition-all duration-200 border",
        isActive 
          ? "bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-slate-600" 
          : "hover:bg-gray-50 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-700"
      )}
    >
      <Icon className={cn(
        "size-5 stroke-[1.5px] shrink-0",
        isActive && "text-blue-600 dark:text-blue-400"
      )} />
      <span className={cn(
        "mt-2 text-xs font-medium",
        isActive && "text-blue-600 dark:text-blue-400"
      )}>
        {label}
      </span>
    </Button>
  );
};
