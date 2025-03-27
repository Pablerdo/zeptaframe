"use client";

import Link from "next/link";
import { Loader, TriangleAlert } from "lucide-react";

import { useGetProject } from "@/features/projects/api/use-get-project";

import { CompositionStudio } from "@/features/editor/components/composition-studio";
import { Button } from "@/components/ui/button";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";

interface EditorProjectIdPageProps {
  params: {
    projectId: string;
  };
};

const EditorProjectIdPage = ({
  params,
}: EditorProjectIdPageProps) => {
  const { 
    data, 
    isLoading, 
    isError
  } = useGetProject(params.projectId);

  if (isLoading || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex flex-col gap-y-5 items-center justify-center">
        <TriangleAlert className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          Failed to fetch project
        </p>
        <Button asChild variant="secondary">
          <Link href="/">
            Back to Home
          </Link>
        </Button>
      </div>
    );
  }

  const isTrial = false;

  return (
    <UserStatusProvider 
      initialUserStatus={{
        isAuthenticated: !isTrial,
        userId: !isTrial ? data.userId : undefined,
      }}
    >
      <CompositionStudio initialData={data} isTrial={isTrial} />
    </UserStatusProvider>
  );
};
 
export default EditorProjectIdPage;
