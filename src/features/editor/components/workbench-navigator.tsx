import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WorkbenchNavigatorProps {
  workbenchIds: string[];
  activeWorkbenchIndex: number;
  setActiveWorkbenchIndex: (index: number) => void;
}

export const WorkbenchNavigator = ({
  workbenchIds,
  activeWorkbenchIndex,
  setActiveWorkbenchIndex
}: WorkbenchNavigatorProps) => {
  return (
    <div className="flex items-center gap-2 flex-grow justify-left px-4">
      <div className="flex items-center gap-3">
        {/* Left arrow */}
        <button
          onClick={() => activeWorkbenchIndex > 0 && setActiveWorkbenchIndex(activeWorkbenchIndex - 1)}
          className={cn(
            "p-1 rounded-full transition-colors",
            activeWorkbenchIndex > 0 
              ? "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700" 
              : "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
          )}
          disabled={activeWorkbenchIndex === 0}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={3} />
        </button>
        
        {/* Dots */}
        <div className="flex items-center gap-1">
          {workbenchIds.map((id, index) => (
            <div
              key={id}
              onClick={() => setActiveWorkbenchIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors duration-200 cursor-pointer",
                index === activeWorkbenchIndex 
                  ? "bg-blue-500" 
                  : "bg-zinc-500/50 hover:bg-zinc-400"
              )}
            />
          ))}
        </div>
        
        {/* Right arrow */}
        <button
          onClick={() => activeWorkbenchIndex < workbenchIds.length - 1 && setActiveWorkbenchIndex(activeWorkbenchIndex + 1)}
          className={cn(
            "p-1 rounded-full transition-colors",
            activeWorkbenchIndex < workbenchIds.length - 1 
              ? "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700" 
              : "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
          )}
          disabled={activeWorkbenchIndex === workbenchIds.length - 1}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
