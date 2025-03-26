"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface CameraSliderVerticalProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  valueDisplay?: number;
  label?: string;
  showEndIcons?: boolean;
}

const CameraSliderVertical = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  CameraSliderVerticalProps
>(({ className, orientation = "horizontal", valueDisplay, label, showEndIcons = false, ...props }, ref) => {
  const isVertical = true;
  
  // Generate gradient colors for slider background
  const getGradientClass = () => {
    if (isVertical) {
      return "bg-gradient-to-t from-black via-blue-700 to-blue-500";
    }
    return "bg-gradient-to-r from-blue-500 via-blue-700 to-black";
  };

  return (
    <div className={cn(
      "flex items-center gap-2 flex-col h-full"
    )}>
      {/* Display label and value if provided */}
      {(valueDisplay !== undefined) && (
        <div className={cn(
          "flex text-sm font-medium"
        )}>
          {valueDisplay !== undefined && (
            <span className="px-1 py-1 rounded-md bg-gray-800 text-white min-w-[3rem] text-center">{valueDisplay.toFixed(1)}</span>
          )}
        </div>
      )}
      
      <div className={cn(
        "relative flex items-center h-full flex-col"
      )}>
        {/* Start icon */}
        {showEndIcons && (
          <div className={cn(
            "flex items-center justify-center w-10 h-8 bg-gray-800 rounded-md mb-2"
          )}>
            <ArrowUpIcon className="w-4 h-4" />
          </div>
        )}
        
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            "relative touch-none select-none h-full w-10 flex-col items-center justify-center",
            className
          )}
          orientation="vertical"
          {...props}
        >
          <SliderPrimitive.Track 
            className="relative overflow-hidden rounded-md h-full w-[24px] grow bg-gray-800"
          >
            <div className="absolute rounded-md h-full w-full" />

            <SliderPrimitive.Range 
              className="absolute w-full"
            />
          </SliderPrimitive.Track>
          
          <SliderPrimitive.Thumb 
            className={cn(
              "block border-2 ml-1 h-2 w-8 rounded-sm border-white bg-white shadow-lg ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            )} 
          />
        </SliderPrimitive.Root>
        {/* End icon */}
        {showEndIcons && (
          <div className={cn(
            "flex items-center justify-center w-10 h-8 bg-gray-800 rounded-md mt-2"
          )}>
            <ArrowDownIcon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  )
})

CameraSliderVertical.displayName = "CameraSliderVertical"

export { CameraSliderVertical } 