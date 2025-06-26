"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Loader } from "lucide-react";
import { CompositionStudio } from "@/features/editor/components/composition-studio";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";
import { generateProjectName } from "@/lib/utils";

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
        name: generateProjectName(),
        json: "",
        width: 960,
        height: 640,
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
  
  const isTrial = true;

  return (
    <UserStatusProvider 
      initialUserStatus={{
        isAuthenticated: false,
        userId: undefined,
      }}
    >
      <CompositionStudio initialData={trialData} isTrial={isTrial} />
    </UserStatusProvider>
  );
}
