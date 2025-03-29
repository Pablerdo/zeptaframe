"use client";

import { useSession, signOut } from "next-auth/react";
import { CreditCard, Crown, Loader, LogOut, User } from "lucide-react";

import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// import { usePaywall } from "@/features/subscriptions/hooks/use-paywall";
//import { useBilling } from "@/features/subscriptions/api/use-billing";
//import { useBuyCredits } from "@/features/subscriptions/api/use-buy-credits";
import { useState } from "react";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";

export const UserButton = () => {
  // const { shouldBlock, triggerPaywall, isLoading } = usePaywall();
  // const mutation = useBilling();
  // const mutation = useBuyCredits(null);
  const session = useSession();
  const [isBuyCreditsModalOpen, setIsBuyCreditsModalOpen] = useState(false);

  const onClick = () => {
    // if (shouldBlock) {
    //   setShowCreditsModal(true);
    //   return;
    // }
    setIsBuyCreditsModalOpen(true);
    // mutation.mutate();
  };

  if (session.status === "loading") {
    return <Loader className="size-4 animate-spin text-muted-foreground" />
  }

  if (session.status === "unauthenticated" || !session.data) {
    return null;
  }

  const name = session.data?.user?.name!;
  const imageUrl = session.data?.user?.image;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="outline-none relative">
          <Avatar className="size-10 hover:opcaity-75 transition">
            <AvatarImage alt={name} src={imageUrl || ""} />
            <AvatarFallback className="bg-blue-500 font-medium text-white flex items-center justify-center">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem className="h-10 cursor-default">
            <User className="size-4 mr-2" />
            <div className="flex flex-col">
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{session.data.user?.email}</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onClick}
            className="h-10"
          >
            <CreditCard className="size-4 mr-2" />
            Get Credits
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-10" onClick={() => signOut()}>
            <LogOut className="size-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BuyCreditsModal 
        isOpen={isBuyCreditsModalOpen}
        onClose={() => setIsBuyCreditsModalOpen(false)}
        projectId={null}
      />
    </>
  );
};
