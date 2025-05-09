import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

import { client } from "@/lib/hono";

type ResponseType = InferResponseType<(typeof client.api.projects)["$post"], 200>;
type RequestType = InferRequestType<(typeof client.api.projects)["$post"]>["json"];

// Define types for the for-user endpoint
interface CreateProjectForUserRequest extends RequestType {
  userId: string;
}

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.projects.$post({ json });

      if (!response.ok) {
        throw new Error("Something went wrong");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Project created.");

      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => {
      toast.error(
        "Failed to create project. The session token may have expired, logout and login again, and everything will work fine."
      );
    },
  });

  return mutation;
};

export const useCreateProjectForUser = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, CreateProjectForUserRequest>({
    mutationFn: async (json) => {
      const response = await fetch('/api/projects/for-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)
      });

      if (!response.ok) {
        throw new Error("Failed to create project for user");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Project created for new user.");
    },
    onError: () => {
      toast.error("Failed to create project for new user.");
    },
  });

  return mutation;
};
