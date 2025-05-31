import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RightSidebarItemProps {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
};

export const RightSidebarItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  disabled,
  tooltip,
}: RightSidebarItemProps) => {
  const button = (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full h-full aspect-video p-3 py-4 flex flex-col rounded-xl transition-all duration-200 border",
        isActive 
          ? "bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-slate-600" 
          : "hover:bg-gray-50 dark:hover:bg-slate-800 border-gray-300 dark:border-slate-600",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
      )}
    >
      <Icon className={cn(
        "size-5 stroke-[1.5px] shrink-0",
        isActive && "text-blue-600 dark:text-blue-400",
        disabled && "text-gray-400"
      )} />
      <span className={cn(
        "mt-2 text-xs font-medium",
        isActive && "text-blue-600 dark:text-blue-400",
        disabled && "text-gray-400"
      )}>
        {label}
      </span>
    </Button>
  );

  if (tooltip && disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
