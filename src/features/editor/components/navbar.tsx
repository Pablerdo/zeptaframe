"use client";

import { BsCloudCheck, BsCloudSlash } from "react-icons/bs";
import { useFilePicker } from "use-file-picker";
import { useMutationState } from "@tanstack/react-query";
import { useState, KeyboardEvent, useRef } from "react";
import {  
  Loader, 
  MousePointerClick, 
  Redo2, 
  Undo2,
  Pencil,
  Check,
  CreditCard,
  HelpCircle
} from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { UserButton } from "@/features/auth/components/user-button";
import { DarkModeToggle } from "@/features/editor/components/dark-mode-toggle";
import { Hint } from "@/components/hint";

import { ActiveTool, Editor } from "@/features/editor/types";
import { Logo } from "@/features/editor/components/logo";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

import { useUserStatus } from "@/features/auth/contexts/user-status-context";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { TutorialModal } from "./tutorial-modal";

interface NavbarProps {
  id: string;
  projectName: string;
  setProjectName: (name: string) => void;
  editor: Editor | undefined;
  activeTool: ActiveTool;
  onChangeActiveTool: (tool: ActiveTool) => void;
  isTrial?: boolean;
  setShowAuthModal: (showAuthModal: boolean) => void;
};

export const Navbar = ({
  projectName,
  setProjectName,
  id,
  editor,
  activeTool,
  onChangeActiveTool,
  isTrial,
  setShowAuthModal,
}: NavbarProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(projectName);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const { userStatus } = useUserStatus();
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  const handleClickSignUp = () => {
    setShowAuthModal(true);
  };

  const handleStartRename = () => {
    setEditedName(projectName);
    setIsEditingName(true);
  };

  const handleFinishRename = () => {
    if (editedName.trim() !== "") {
      setProjectName(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename();
    } else if (e.key === "Escape") {
      setIsEditingName(false);
    }
  };

  const data = useMutationState({
    filters: {
      mutationKey: ["project", { id }],
      exact: true,
    },
    select: (mutation) => mutation.state.status,
  });

  const currentStatus = data[data.length - 1];

  const isError = currentStatus === "error";
  const isPending = currentStatus === "pending";

  // const { openFilePicker } = useFilePicker({
  //   accept: ".json",
  //   onFilesSuccessfullySelected: ({ plainFiles }: any) => {
  //     if (plainFiles && plainFiles.length > 0) {
  //       const file = plainFiles[0];
  //       const reader = new FileReader();
  //       reader.readAsText(file, "UTF-8");
  //       reader.onload = () => {
  //         editor?.loadJson(reader.result as string);
  //       };
  //     }
  //   },
  // });

  const showTutorial = () => {
    setShowTutorialModal(true);
  };

  return (
    <nav className="w-full flex items-center p-4 h-[50px] gap-x-8 border-b-2 border-gray-300 dark:border-gray-900 lg:pl-[34px] bg-background text-foreground dark:shadow-dark-raised">
      <Logo isTrial={isTrial} />
      <div className="flex items-center gap-x-2">
        {isEditingName ? (
          <div className="flex items-center space-x-2">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleKeyPress}
              className="h-8 w-40 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFinishRename}
              className="h-8 w-8"
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-1">
            <div className="flex">
              <span className="text-sm whitespace-nowrap">{projectName}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleStartRename}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
      <div className="w-full flex items-center gap-x-1 h-full">
        {/* <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              File
              <ChevronDown className="size-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuItem
              onClick={() => openFilePicker()}
              className="flex items-center gap-x-2"
            >
              <CiFileOn className="size-8" />
              <div>
                <p>Open</p>
                <p className="text-xs text-muted-foreground">
                  Open a JSON file
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}
        <Separator orientation="vertical" className="mx-2" />
        <Hint label="Select" side="bottom" sideOffset={10}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChangeActiveTool("select")}
            className={cn(activeTool === "select" && "bg-accent/10")}
          >
            <MousePointerClick className="size-4" />
          </Button>
        </Hint>
        <Hint label="Undo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canUndo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onUndo()}
          >
            <Undo2 className="size-4" />
          </Button>
        </Hint>
        <Hint label="Redo" side="bottom" sideOffset={10}>
          <Button
            disabled={!editor?.canRedo()}
            variant="ghost"
            size="icon"
            onClick={() => editor?.onRedo()}
          >
            <Redo2 className="size-4" />
          </Button>
        </Hint>
        <Separator orientation="vertical" className="mx-2" />
        {isPending && ( 
          <div className="flex items-center gap-x-2">
            <Loader className="size-4 animate-spin text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              Saving...
            </div>
          </div>
        )}
        {!isPending && isError && ( 
          <div className="flex items-center gap-x-2">
            <BsCloudSlash className="size-[20px] text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              Failed to save
            </div>
          </div>
        )}
        {!isPending && !isError && ( 
          <div className="flex items-center gap-x-2">
            <BsCloudCheck className="size-[20px] text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              Saved
            </div>
          </div>
        )}
        <Button variant="ghost" className="flex items-center justify-center" onClick={() => showTutorial()}>
          <span className="text-sm text-muted-foreground underline">Watch Tutorial</span>
        </Button>

        <div className="ml-auto flex items-center gap-x-4">
          {isTrial && (
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleClickSignUp}
            >
              Sign Up
            </Button>
          )}

          {!isTrial && (
            <Button variant="default" className="bg-gray-600 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-800 text-white" onClick={() => setShowCreditsModal(true)}>
              <CreditCard className="size-4 mr-2" />
              Credits: {userStatus.credits}
            </Button>
          )}

          <Popover open={infoOpen} > {/*</div>onOpenChange={setInfoOpen}> */}
            <PopoverTrigger asChild>
              <div 
                className="text-sm px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-accent-foreground rounded-md cursor-pointer h-12 w-50 flex items-center justify-center"
                // ref={infoButtonRef}
                onMouseEnter={() => setInfoOpen(true)}
                onMouseLeave={(e) => {
                  // Only close if we're not leaving to go to the popover content
                  // const relatedTarget = e.relatedTarget as HTMLElement;
                  // if (!relatedTarget?.closest('[role="dialog"]')) {
                  //   setInfoOpen(false);
                  // }
                }}
              >
                <span className="text-sm">What&apos;s this?</span>
              </div>
            </PopoverTrigger><PopoverContent 
              className="max-w-[350px] text-white bg-slate-800 border-slate-800"
              sideOffset={0}
              onMouseLeave={(e) => {
                // Only close if we're not leaving to go to the button
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (relatedTarget !== infoButtonRef.current) {
                  setInfoOpen(false);
                }
              }}
            >
              <p className="text-sm">
                This is part of <a href="https://x.com/pablosalamancal" target="_blank" rel="noopener noreferrer" className="font-bold hover:cursor-pointer underline">Pablo Salamanca&apos;s</a> thesis project, which 
                aims to build the first fully visual based AI video editor. 
                <br />
                <br />
                Expect bugs, but hopefully you enjoy it. 
                <br />
                <br />
                Shoot me a message at
                <span className="font-bold cursor-pointer hover:underline" onClick={() => window.open("mailto:pablosalamanca88@gmail.com", "_blank")}> pablosalamanca88@gmail.com</span> if you have any questions or feedback.
              </p>
            </PopoverContent>
          </Popover>

          <DarkModeToggle />
          <Hint label="Join our Discord" side="bottom" sideOffset={10}>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8 mr-2"
            >
              <a href="https://discord.gg/yHDEzFQ5cK" target="_blank" rel="noopener noreferrer">
                <FaDiscord className="h-5 w-5" />
              </a>
            </Button>
          </Hint>
          {!isTrial && <UserButton />}
        </div>
      </div>

      <BuyCreditsModal 
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        projectId={id}
      />
      <TutorialModal 
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
      />
    </nav>
  );
};
