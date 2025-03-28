"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

interface CameraSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  valueDisplay?: number;
  label?: string;
  showEndIcons?: boolean;
  onValueDisplayChange?: (value: number) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const CameraSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  CameraSliderProps
>(({ className, valueDisplay, label, showEndIcons = false, onValueDisplayChange, leftIcon, rightIcon, ...props }, ref) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(valueDisplay?.toFixed(1) || '0.0');
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onValueDisplayChange) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && newValue >= -1 && newValue <= 1) {
        onValueDisplayChange(newValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Display label and value if provided */}
      
      <div className="relative flex items-center w-full">
        {/* Start icon */}
        {showEndIcons && (
          <div className="flex items-center justify-center w-10 h-8 bg-muted dark:bg-gray-800 rounded-md mr-2">
            {leftIcon}
          </div>
        )}
        
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            "relative touch-none select-none w-full h-10 flex items-center",
            className
          )}
          orientation="horizontal"
          {...props}
        >
          <SliderPrimitive.Track 
            className="relative overflow-hidden rounded-md h-[24px] w-full grow bg-muted dark:bg-gray-800"
          >
            <div className="absolute rounded-md h-full w-full" />
            
            <SliderPrimitive.Range className="absolute h-full" />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb 
            className="block h-7 w-2 rounded-sm border-2 border-primary bg-background dark:bg-white shadow-lg ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          />
        </SliderPrimitive.Root>
        
        {/* End icon */}
        {showEndIcons && (
          <div className="flex items-center justify-center w-10 h-8 bg-muted dark:bg-gray-800 rounded-md ml-2">
            {rightIcon}
          </div>
        )}
        {(valueDisplay !== undefined) && (
          <div className={cn("flex items-center text-sm font-medium ml-1")}>
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="px-1 py-1 rounded-md bg-muted dark:bg-gray-800 text-foreground dark:text-white min-w-[3rem] text-center"
                autoFocus
              />
            ) : (
              <span 
                onClick={handleClick}
                className="px-1 py-1 rounded-md bg-muted dark:bg-gray-800 text-foreground dark:text-white min-w-[3rem] text-center cursor-pointer hover:bg-secondary dark:hover:bg-gray-700"
              >
                {valueDisplay.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

CameraSlider.displayName = "CameraSlider"

export { CameraSlider } 