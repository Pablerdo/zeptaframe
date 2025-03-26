"use client";

import { CreditCard, Crown, Home, MessageCircleQuestion } from "lucide-react";
import { usePathname } from "next/navigation";

// import { usePaywall } from "@/features/subscriptions/hooks/use-paywall";
// import { useCheckout } from "@/features/subscriptions/api/use-checkout";
// import { useBilling } from "@/features/subscriptions/api/use-billing";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { SidebarItem } from "./sidebar-item";
import { BuyCreditsModal } from "@/features/subscriptions/components/credits/buy-credits-modal";
import { useState } from "react";

export const SidebarRoutes = () => {
  // const mutation = useCheckout();
  // const billingMutation = useBilling();
  // const { shouldBlock, isLoading, triggerPaywall } = usePaywall();

  const pathname = usePathname();

  const [isBuyCreditsModalOpen, setIsBuyCreditsModalOpen] = useState(false);
  const onClick = () => {
    console.log("clicked");

    setIsBuyCreditsModalOpen(true);
    // if (shouldBlock) {
    //   triggerPaywall();
    //   return;
    // }

    // billingMutation.mutate();
  };

  return (
    <>
      <div className="flex flex-col gap-y-4 flex-1">
        <ul className="flex flex-col gap-y-1 px-3">
          <SidebarItem href="/" icon={Home} label="Home" isActive={pathname === "/"} />
        </ul>
        <div className="px-3">
          <Separator />
        </div>
        <ul className="flex flex-col gap-y-1 px-3">
          <SidebarItem href={pathname} icon={CreditCard} label="Get Credits" onClick={onClick} />
          <SidebarItem
            href="mailto:support@zeptaframe.com"
            icon={MessageCircleQuestion}
            label="Get Help"
          />
        </ul>
        
      </div>
      <BuyCreditsModal
        isOpen={isBuyCreditsModalOpen}
        onClose={() => setIsBuyCreditsModalOpen(false)}
        requiredCredits={undefined}
        actionLabel="cover GPU usage"
        projectId={null}
      />
    </>
  );
};
