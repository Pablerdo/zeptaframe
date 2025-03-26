"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useCreditsSuccessModal } from "@/features/subscriptions/store/use-credits-success-modal";
//import { useUserStatus } from "@/features/auth/contexts/user-status-context";

import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

export const SuccessCreditsModal = () => {
  const { isOpen, onClose } = useCreditsSuccessModal();
  // const { refreshUsage } = useUserStatus(); // To refresh credit count
  
  const handleClose = async () => {
    // Refresh the user's credits to show the updated balance
    // await refreshUsage();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader className="flex items-center space-y-4">
          <CreditCard className="size-10 text-blue-500" />
          <DialogTitle className="text-center">
            Credits added!
          </DialogTitle>
          <DialogDescription className="text-center">
            You have successfully added 500 credits to your account
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2 mt-4 gap-y-2">
          <Button
            className="w-full"
            onClick={handleClose}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
