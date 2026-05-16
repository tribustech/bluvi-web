"use client";

import { useQuery } from "@tanstack/react-query";
import { getSponsors } from "@/services/api/sponsors";
import { queryKeys } from "./query-keys";

export function useSponsors() {
  return useQuery({
    queryKey: queryKeys.sponsors.all,
    queryFn: getSponsors,
  });
}
