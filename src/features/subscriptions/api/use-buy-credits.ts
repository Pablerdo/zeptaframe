"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useBuyCredits = (projectId: string | null) => {
  const mutation = useMutation({
    mutationFn: async () => {

      const response = await fetch("/api/subscriptions/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate checkout");
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      toast.error(`Failed to initiate checkout: ${error.message}`);
    },
  });

  return mutation;
}; 