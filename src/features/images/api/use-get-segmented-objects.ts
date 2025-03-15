import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/hono";

export const useGetSegmentedObjects = () => {
  const query = useQuery({
    queryKey: ["segmented-objects"],
    queryFn: async () => {
      const response = await client.api["segmented-objects"].$get();

      if (!response.ok) {
        throw new Error("Failed to fetch segmented objects");
      }

      const { data } = await response.json();
      return data;
    },
  });

  return query;
};
