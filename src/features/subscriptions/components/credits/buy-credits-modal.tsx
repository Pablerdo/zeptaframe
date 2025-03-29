"use client";

import Image from "next/image";
import { CheckCircle2, Loader2 } from "lucide-react";

import { useBuyCredits } from "@/features/subscriptions/api/use-buy-credits";
import { generationPrices } from "@/features/subscriptions/utils";

import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCredits?: number;
  actionLabel?: string;
  projectId: string | null;
}

export const BuyCreditsModal = ({ 
  isOpen, 
  onClose,
  requiredCredits,
  actionLabel,
  projectId
}: BuyCreditsModalProps) => {
  const { mutate, isPending } = useBuyCredits(projectId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader className="flex items-center space-y-4">

          <DialogTitle className="text-center">
            Increase Balance
          </DialogTitle>
          <DialogDescription className="text-center">
            {requiredCredits ? (
              <>
                You need <span className="font-semibold text-blue-500">{requiredCredits} more credits</span> to {actionLabel || "continue"}
              </>
            ) : (
              "Purchase additional credits to cover GPU usage"
            )}
          </DialogDescription>
        </DialogHeader>
        <Separator />
        
        <div className="flex items-center justify-center my-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800 flex flex-col items-center">
            <CreditCard className="size-12 text-blue-500 mb-2" />
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">500 Credits</div>
            <div className="text-xl font-semibold mt-1 mb-3">${generationPrices.fiveHundredCreditsDollarPrice}.00 USD</div>
          </div>
        </div>
        
        <ul className="space-y-2">
          <li className="flex items-center">
            <CheckCircle2 className="size-5 mr-2 fill-blue-500 text-white" />
            <p className="text-sm text-muted-foreground">
              Generate images: {generationPrices.image} credit per image
            </p>
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="size-5 mr-2 fill-blue-500 text-white" />
            <p className="text-sm text-muted-foreground">
              Create videos based on compute mode: 
              <ul className="ml-1 list-disc list-inside">
                <li>{generationPrices.flashVideoCredits} credits (Flash)</li>
                <li>{generationPrices.normalVideoCredits} credits (Normal)</li>
                <li>{generationPrices.ultraVideoCredits} credits (Ultra)</li>
              </ul>
            </p>
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="size-5 mr-2 fill-blue-500 text-white" />
            <p className="text-sm text-muted-foreground">
              Credits never expire
            </p>
          </li>
        </ul>
        
        <DialogFooter className="pt-2 mt-4 gap-y-2">
          <Button
            className="w-full"
            onClick={() => mutate()}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Processing...
              </>
            ) : (
              'Get Credits'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 