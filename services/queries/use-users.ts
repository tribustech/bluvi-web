"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/services/api/users";
import { queryKeys } from "./query-keys";

export function useUsers(search = "", page = 1) {
  return useQuery({
    queryKey: queryKeys.users.paginated(search, page),
    queryFn: () => getUsers(search, page),
  });
}
