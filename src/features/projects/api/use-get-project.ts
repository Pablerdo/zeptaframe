import { InferResponseType } from "hono";
import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export type ResponseType = {
  data: {
    json: string; // This will now store a structured JSON object
    name: string;
    userId: string;
    id: string;
    height: number;
    width: number;
    thumbnailUrl: string | null;
    isTemplate: boolean | null;
    isPro: boolean | null;
    createdAt: string;
    updatedAt: string;
  };
};

// Add a helper type to represent the structured JSON content
export interface ProjectJSON {
  metadata?: {
    version?: string;
    lastModified: string;
  };
  defaultSettings?: {
    width: number;
    height: number;
  };
  workbenches: {
    [id: string]: {
      json: string;
      width: number;
      height: number;
      promptData?: string; // JSON stringified PromptData
    }
  };
}

export const useGetProject = (id: string) => {
  const query = useQuery({
    enabled: !!id,
    queryKey: ["project", { id }],
    queryFn: async () => {
      const response = await client.api.projects[":id"].$get({
        param: {
          id,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch project");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
