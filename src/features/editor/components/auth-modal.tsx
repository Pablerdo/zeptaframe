"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useSignUp } from "@/features/auth/hooks/use-sign-up";
import { useCreateProjectForUser } from "@/features/projects/api/use-create-project";

type AuthMode = "signin" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  projectId?: string;
  isTrial?: boolean;
}

export function AuthModal({
  isOpen,
  onClose,
  defaultMode = "signin",
  projectId,
  isTrial,
}: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const signUpMutation = useSignUp();
  const createProjectForUserMutation = useCreateProjectForUser();

  // Save trial project data when modal opens
  useEffect(() => {
    if (isOpen && isTrial) {
      // Store a flag to indicate we're coming from trial
      localStorage.setItem("from_trial", "true");
    }
  }, [isOpen, isTrial]);

  // Function to create a project in the database from trial data
  const createProjectFromTrial = async (id: string): Promise<string> => {
    try {
      // Get trial project data from localStorage
      const trialProjectData = localStorage.getItem("trial_project");
      
      if (!trialProjectData) {
        throw new Error("No trial project data found");
      }
      
      const parsedData = JSON.parse(trialProjectData);
      
      // Create a real project in the database with specific userId using our hook
      const result = await createProjectForUserMutation.mutateAsync({
        name: parsedData.name || "Untitled Project 1",
        json: parsedData.json,
        width: parsedData.width || 720,
        height: parsedData.height || 480,
        userId: id
      });
      
      // Clear trial data from localStorage
      localStorage.removeItem("trial_project");
      localStorage.removeItem("from_trial");
      
      if (!result.data?.id) {
        throw new Error("Failed to get project ID from response");
      }
      
      return result.data.id;
    } catch (error) {
      console.error("Error creating project from trial:", error);
      throw error;
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const validateInputs = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

    if (!password.trim()) {
      setError("Password is required");
      return false;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Name is required");
        return false;
      }
      
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return false;
      }
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateInputs()) return;

    setIsSubmitting(true);
    setError(null);
    
    // Set flag to prevent beforeunload warning
    localStorage.setItem("isAuthNavigating", "true");

    signUpMutation.mutate(
      {
        name,
        email,
        password,
        fromTrial: isTrial,
      },
      {
        onSuccess: async (response) => {
          try {
            if (isTrial) {
              console.log("Converting unauthed to authed user");
              console.log(response);
              // Type assertion for the response structure
              const userResponse = response as { id: string, email: string, name: string };
              const userId = userResponse.id;
              
              if (!userId) {
                console.error("Response missing userId:", response);
                throw new Error("Failed to get user ID from response");
              }
              
              // Create a real project from the trial data
              const newProjectId = await createProjectFromTrial(userId);
              
              // Sign in and redirect to the new project
              await signIn("credentials", {
                email,
                password,
                callbackUrl: `/editor/${newProjectId}`,
                redirect: true
              });
            } else {
              // If not trial, just sign in normally
              handleSignin(false);
            }
            
          } catch (err) {
            console.error("Error in signup success handler:", err);
            setError("Failed to create project. Please try again.");
            setIsSubmitting(false);
          }
        },
        onError: (error) => {
          setError(error.message || "Failed to sign up");
          setIsSubmitting(false);
        }
      }
    );
  };

  const handleSignin = async (shouldValidate = true) => {
    if (shouldValidate && !validateInputs()) return;

    setIsSubmitting(true);
    setError(null);
    
    // Set flag to prevent beforeunload warning
    localStorage.setItem("isAuthNavigating", "true");

    try {
      // For direct sign-in, we handle trial projects differently
      if (isTrial) {
        // First, try to authenticate the user
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false
        });

        if (result?.error) {
          throw new Error(result.error);
        }
        
        // If authentication was successful, get the user's ID and create project
        try {
          
          // Need to fetch the user ID after successful authentication
          const userResponse = await fetch('/api/user');
          if (!userResponse.ok) {
            throw new Error("Failed to get user data");
          }
          
          const userData = await userResponse.json();
          const userId = userData.id;
          
          if (!userId) {
            throw new Error("Failed to get user ID");
          }
          
          // Create project from trial data
          const newProjectId = await createProjectFromTrial(userId);
          
          // Redirect to the new project
          router.push(`/projects/${newProjectId}`);
        } catch (projectErr) {
          console.error("Error creating project:", projectErr);
          // If project creation fails, just go to home page
          router.push('/');
        }
      } else {
        // For existing projects, we can redirect directly
        await signIn("credentials", {
          email,
          password,
          callbackUrl: projectId ? `/projects/${projectId}` : "/",
          redirect: true
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      handleSignup();
    } else {
      handleSignin();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "signin" ? "Sign in" : "Create an account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Enter your credentials to access your account"
              : "Sign up to generate videos, images, and save your projects"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} key={mode}>
          <div className="grid gap-4 py-4">
            {mode === "signup" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <div className="col-span-3">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <div className="col-span-3">
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete={mode === "signin" ? "username" : "email"}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={toggleShowPassword}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {error && (
              <div className="col-span-4 text-red-500 text-sm">{error}</div>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={toggleMode}
              disabled={isSubmitting || signUpMutation.isPending}
            >
              {mode === "signin" ? "Need an account?" : "Already have an account?"}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || signUpMutation.isPending}
            >
              {isSubmitting || signUpMutation.isPending
                ? "Processing..."
                : mode === "signin"
                ? "Sign in"
                : "Sign up"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 