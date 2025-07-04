"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { Loader2, TriangleAlert } from "lucide-react";

import { useSignUp } from "@/features/auth/hooks/use-sign-up";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardTitle, CardHeader, CardContent, CardDescription } from "@/components/ui/card";

export const SignUpCard = () => {
  const [loading, setLoading] = useState(false);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [fromTrial, setFromTrial] = useState(false);

  // Check if user is coming from trial
  useEffect(() => {
    const isFromTrial = localStorage.getItem("from_trial") === "true";
    setFromTrial(isFromTrial);
    
    // Clear the flag
    if (isFromTrial) {
      localStorage.removeItem("from_trial");
    }
  }, []);

  const mutation = useSignUp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [conferenceCode, setConferenceCode] = useState("");
  const [codeError, setCodeError] = useState("");

  const onProviderSignUp = (provider: "github" | "google") => {
    setLoading(true);
    setLoadingGithub(provider === "github");
    setLoadingGoogle(provider === "google");

    signIn(provider, { callbackUrl: "/" });
  };

  const onCredentialSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setCodeError("");

    // Validate conference code if provided
    if (conferenceCode && conferenceCode !== "CVPR2025") {
      setCodeError("Invalid conference code. Please check and try again.");
      setLoading(false);
      return;
    }

    mutation.mutate(
      {
        name,
        email,
        password,
        fromTrial: fromTrial,
        conferenceCode: conferenceCode || undefined,
      },
      {
        onSuccess: () => {
          // If coming from trial, we want to convert the trial project to a real one
          if (fromTrial) {
            const trialProject = localStorage.getItem("trial_project");
            if (trialProject) {
              // We'll handle this after sign-in in the home page route
              localStorage.setItem("convert_trial", "true");
            }
          }
          
          signIn("credentials", {
            email,
            password,
            callbackUrl: "/",
          });
        },
        onError: () => {
          setLoading(false);
        }
      }
    );
  };

  return (
    <Card className="w-full h-full p-8">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          {fromTrial 
            ? "Sign up to save your project and access all features" 
            : "Use your email or another service to continue"}
        </CardDescription>
      </CardHeader>
      {!!mutation.error && (
        <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive mb-6">
          <TriangleAlert className="size-4" />
          <p>Something went wrong</p>
        </div>
      )}
      <CardContent className="space-y-5 px-0 pb-0">
        {/* Conference Code Section */}
        <div className="p-4 rounded-lg border border-zinc-200">
          <h3 className="text-sm font-medium mb-2 text-zinc-800">CVPR 2025 Attendee?</h3>
          <p className="text-xs text-zinc-600 mb-3">
            Enter the code <b>CVPR2025</b> for free access
          </p>
          <Input
            disabled={mutation.isPending || loading}
            value={conferenceCode}
            onChange={(e) => setConferenceCode(e.target.value.toUpperCase())}
            placeholder="Enter code (optional)"
            type="text"
          />
          {codeError && (
            <p className="text-red-400 text-xs mt-2">{codeError}</p>
          )}
        </div>

        <form onSubmit={onCredentialSignUp} className="space-y-2.5">
          <Input
            disabled={mutation.isPending || loading}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            type="text"
            required
          />
          <Input
            disabled={mutation.isPending || loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
          />
          <Input
            disabled={mutation.isPending || loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
            minLength={3}
            maxLength={20}
          />
          <Button
            className="w-full"
            type="submit"
            size="lg"
            disabled={loading || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-5 top-2.5 left-2.5 animate-spin" />
            ) : (
              "Continue"
            )}
          </Button>
        </form>
        <Separator />
        <div className="flex flex-col gap-y-2.5">
          <Button
            disabled={mutation.isPending || loading}
            onClick={() => onProviderSignUp("google")}
            variant="outline"
            size="lg"
            className="w-full relative"
          >
            {loadingGoogle ? (
              <Loader2 className="mr-2 size-5 top-2.5 left-2.5 absolute animate-spin" />
            ) : (
              <FcGoogle className="mr-2 size-5 top-2.5 left-2.5 absolute" />
            )}
            Continue with Google
          </Button>
          {/* <Button
            disabled={mutation.isPending || loading}
            onClick={() => onProviderSignUp("github")}
            variant="outline"
            size="lg"
            className="w-full relative"
          >
            {loadingGithub ? (
              <Loader2 className="mr-2 size-5 top-2.5 left-2.5 absolute animate-spin" />
            ) : (
              <FaGithub className="mr-2 size-5 top-2.5 left-2.5 absolute" />
            )}
            Continue with Github
          </Button> */}
        </div>
        <p className="text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" onClick={() => setLoading(true)}>
            <span className="text-sky-700 hover:underline">Sign in</span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
