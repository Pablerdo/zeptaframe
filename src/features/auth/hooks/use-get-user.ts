import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/hono";


interface RequestType {
  email: string;
}

export const useGetUserByEmail = (email: string) => {
  const query = useQuery({
    enabled: !!email,
    queryKey: ["email", { email }],
    queryFn: async () => {
      const response = await client.api.users.$get({
        query: {
          email,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch project");
      }

      const data  = await response.json();

      if (!data) {
        throw new Error("User not found");
      }

      return data;
    },
  });

  return query;
};