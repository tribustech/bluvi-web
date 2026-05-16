import type { Notification } from "@/types";
import { getJson, postJson } from "./_shared";

export async function getNotifications(): Promise<Notification[]> {
  const response = await getJson<{ data: Notification[] }>("/notifications/me");
  return response.data ?? [];
}

export async function getUnreadNotificationsCount(): Promise<{ count: number }> {
  return getJson("/notifications/me/unread");
}

export async function markNotificationRead(notificationId: string) {
  return postJson(`/notifications/${notificationId}/mark-as-read`);
}
