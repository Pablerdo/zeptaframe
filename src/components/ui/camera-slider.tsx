"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

interface CameraSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  valueDisplay?: number;
  label?: string;
  showEndIcons?: boolean;
}

const CameraSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  CameraSliderProps
>(({ className, valueDisplay, label, showEndIcons = false, ...props }, ref) => {
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Display label and value if provided */}
      
      <div className="relative flex items-center w-full">
        {/* Start icon */}
        {showEndIcons && (
          <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-md mr-2">
            <ArrowLeftIcon className="w-4 h-4" />
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
            className="relative overflow-hidden rounded-md h-[24px] w-full grow bg-gray-800"
          >
            <div className="absolute rounded-md h-full w-full" />
            
            <SliderPrimitive.Range className="absolute h-full" />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb 
            className="block h-7 w-2 rounded-sm border-2 border-white bg-white shadow-lg ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          />
        </SliderPrimitive.Root>
        
        {/* End icon */}
        {showEndIcons && (
          <div className="flex items-center justify-center w-10 h-8 bg-gray-800 rounded-md ml-2">
            <ArrowRightIcon className="w-4 h-4" />
          </div>
        )}
        {(valueDisplay !== undefined) && (
          <div className={cn(
            "flex items-center text-sm font-medium ml-1"
          )}>
            {valueDisplay !== undefined && (
              <span className="px-1 py-1 rounded-md bg-gray-800 text-white min-w-[3rem] text-center">{valueDisplay.toFixed(1)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

CameraSlider.displayName = "CameraSlider"

export { CameraSlider } 