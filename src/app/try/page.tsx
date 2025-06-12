"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Loader, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CompositionStudio } from "@/features/editor/components/composition-studio";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";
import { generateProjectName } from "@/lib/utils";

export default function TryPage() {
  const router = useRouter();
  const [trialData, setTrialData] = useState<any>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [conferenceCode, setConferenceCode] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [showGeneratedCredentials, setShowGeneratedCredentials] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  
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
  
  const handleCodeSubmit = async () => {
    setIsValidatingCode(true);
    setCodeError("");
    
    try {
      // Simple validation - check if code is CVPR2025
      if (conferenceCode !== "CVPR2025") {
        setCodeError("Invalid conference code. Please check and try again.");
        setIsValidatingCode(false);
        return;
      }
      
      // Require email when conference code is provided
      if (!userEmail.trim()) {
        setCodeError("Email is required when using a conference code.");
        setIsValidatingCode(false);
        return;
      }
      
      // Require password when conference code is provided
      if (!userPassword.trim()) {
        setCodeError("Password is required when using a conference code.");
        setIsValidatingCode(false);
        return;
      }
      
      // Generate credentials if no email provided
      const sessionId = uuidv4().substring(0, 8);
      const email = userEmail || `cvpr-${sessionId}@temp.conf`;
      const password = userPassword;
      
      // Create user account
      const createUserResponse = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: userEmail ? userEmail : `CVPR-${sessionId}`,
          password,
          conferenceCode: "CVPR2025",
        }),
      });
      
      const userData = await createUserResponse.json();
      
      if (createUserResponse.ok) {
        // Store session info
        localStorage.setItem("cvpr_session", JSON.stringify({
          userId: userData.id,
          email,
          hasProvidedEmail: !!userEmail,
          createdAt: new Date().toISOString(),
        }));
        
        // Sign in the user with their credentials
        await signIn("credentials", {
          email,
          password,
          redirect: false, // Don't redirect automatically
        });
        
        // If no email provided, show generated credentials
        if (!userEmail) {
          setGeneratedEmail(email);
          setGeneratedPassword(password);
          setShowGeneratedCredentials(true);
        } else {
          setShowWelcomeModal(false);
          router.push("/");
        }
      } else {
        // Handle error properly - it might be an object
        const errorMessage = typeof userData.error === 'string' 
          ? userData.error 
          : userData.error?.message || JSON.stringify(userData.error) || "Failed to create account";
        setCodeError(errorMessage);
      }
    } catch (error) {
      setCodeError("An error occurred. Please try again.");
    } finally {
      setIsValidatingCode(false);
    }
  };
  
  const dismissWelcomeModal = () => {
    // If they dismiss without code, continue as regular trial user
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
              </div>
              
              {!showGeneratedCredentials ? (
                <>
                  {/* Conference Code Section */}
                  <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                    <h3 className="text-sm font-medium mb-2 text-zinc-300">CVPR 2025 Attendee?</h3>
                    <p className="text-xs text-white mb-3">
                      Enter the code <b>CVPR2025</b> for free access
                    </p>
                    <input
                      type="text"
                      value={conferenceCode}
                      onChange={(e) => setConferenceCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                    
                    {/* Email Section */}
                    <div className="mt-4">
                      <p className="text-xs text-zinc-400 mb-2">
                        Email <span className="text-red-400">*</span> 
                      </p>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Password Section */}
                    <div className="mt-4">
                      <p className="text-xs text-zinc-400 mb-2">
                        Password <span className="text-red-400">*</span> 
                      </p>
                      <input
                        type="password"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>


                    
                    {codeError && (
                      <p className="text-red-400 text-xs mt-2">{codeError}</p>
                    )}
                    <button
                      onClick={handleCodeSubmit}
                      disabled={!conferenceCode || !userEmail.trim() || !userPassword.trim() || isValidatingCode}
                      className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      {isValidatingCode ? "Validating..." : "Apply Code"}
                    </button>
                  </div>
                  
                  <p className="mb-6 text-zinc-200">
                    This platform is an AI video generator that implements <b>Go-with-the-flow</b>. <br />
                    <br />
                    Head into the image sidebar, choose an image, and animate any object you want over the canvas! <br />
                    <br />
                    Happy Creating!
                  </p>
                  {/* <button 
                    onClick={dismissWelcomeModal}
                    disabled
                    className="bg-blue-700 disabled:bg-zinc-700 hover:bg-zinc-700 px-4 py-2 rounded-lg font-medium w-full"
                  >
                    Continue Without Code
                  </button>  */}
                </>
              ) : (
                /* Generated Credentials Display */
                <div className="text-center">
                  <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                    <h3 className="text-lg font-medium mb-2 text-red-300">Save These Credentials!</h3>
                    <p className="text-sm text-zinc-300 mb-3">
                      This is the ONLY time you will see them. Your conference account expires June 20th.
                    </p>
                    <div className="bg-zinc-800 p-3 rounded-md text-left space-y-2 font-mono text-sm">
                      <div>
                        <span className="text-zinc-500">Email:</span>
                        <div className="text-white">{generatedEmail}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500">Password:</span>
                        <div className="text-white">{generatedPassword}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Email: ${generatedEmail}\nPassword: ${generatedPassword}`);
                      }}
                      className="mt-3 text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-md"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    You now have 400 free credits to use Zeptaframe!
                  </p>
                  <button
                    onClick={() => {
                      setShowWelcomeModal(false);
                      router.push("/");
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium w-full"
                  >
                    Start Creating
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </UserStatusProvider>
  );
}
