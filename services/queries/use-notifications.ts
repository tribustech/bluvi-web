"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/notifications";
import { queryKeys } from "./query-keys";

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: api.getNotifications,
    refetchInterval: 60 * 1000,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: api.getUnreadNotificationsCount,
    refetchInterval: 60 * 1000,
  });
}
