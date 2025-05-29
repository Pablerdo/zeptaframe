"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Loader, X } from "lucide-react";
import { CompositionStudio } from "@/features/editor/components/composition-studio";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";
import { generateProjectName } from "@/lib/utils";

export default function TryPage() {
  const [trialData, setTrialData] = useState<any>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  useEffect(() => {
    // Create or retrieve trial project
    const storedTrial = localStorage.getItem("trial_project");
    
    // Check if it's the first visit
    const hasVisitedBefore = localStorage.getItem("has_visited_before");
    
    if (!hasVisitedBefore) {
      setShowWelcomeModal(true);
      localStorage.setItem("has_visited_before", "true");
    }
    
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
  
  const dismissWelcomeModal = () => {
    setShowWelcomeModal(false);
  };
  
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
        isAuthenticated: !isTrial,
        userId: !isTrial ? trialData.userId : undefined,
      }}
    >
      <div className="relative h-full">
        <CompositionStudio initialData={trialData} isTrial={isTrial} />
        
        {/* Welcome Modal */}
        {showWelcomeModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 p-6 rounded-xl max-w-md w-full shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Welcome to Zeptaframe</h2>
                <button 
                  onClick={dismissWelcomeModal}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
              <p className="mb-6 text-zinc-200">
                This is a AI-native video editor that does not require text input (you can still use text if you want). <br />
                <br />
                Head into the image sidebar, choose an image, and animate any object you want over the canvas. <br />
                <br />
                Happy Editing!
              </p>
              <button 
                onClick={dismissWelcomeModal}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium w-full"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </UserStatusProvider>
  );
}
