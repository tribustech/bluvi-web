import type { User } from "@/types";
import { getJson } from "./_shared";

export async function getUsers(search = "", page = 1, pageSize = 20): Promise<{
  data: User[];
  meta?: { pagination?: { page: number; pageSize: number; total: number } };
}> {
  return getJson("/users", {
    search,
    page,
    pageSize,
  });
}
