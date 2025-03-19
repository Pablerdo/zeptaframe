"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Loader } from "lucide-react";
import { CompositionStudio } from "@/features/editor/components/composition-studio";

export default function TryPage() {
  const [trialData, setTrialData] = useState<any>(null);
  
  useEffect(() => {
    // Create or retrieve trial project
    const storedTrial = localStorage.getItem("trial_project");
    
    if (storedTrial) {
      setTrialData(JSON.parse(storedTrial));
    } else {
      const newTrial = {
        id: `trial-${uuidv4()}`,
        name: "Untitled Trial Project",
        json: "",
        width: 720,
        height: 480,
      };
      
      localStorage.setItem("trial_project", JSON.stringify(newTrial));
      setTrialData(newTrial);
    }
  }, []);
  
  if (!trialData) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="size-6 animate-spin" />
      </div>
    );
  }
  
  return <CompositionStudio initialData={trialData} isTrial={true} />;
}
