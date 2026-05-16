"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { useNotifications, useUnreadNotifications } from "@/services/queries/use-notifications";
import { markNotificationRead } from "@/services/api/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/services/queries/query-keys";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

export function NotificationBell() {
  const { data: unread } = useUnreadNotifications();
  const { data: notifications, refetch } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const count = unread?.count ?? 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
      void refetch();
    } catch {
      // silent fail
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full border border-gray-2 bg-white p-2 text-gray-7 transition hover:bg-gray-1"
        aria-label="Notificari"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-5 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card bg-white shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
          <div className="flex items-center justify-between border-b border-gray-1 px-4 py-3">
            <p className="text-sm font-bold text-gray-7">Notificari</p>
            {count > 0 && (
              <span className="rounded-full bg-red-1 px-2 py-0.5 text-xs font-bold text-red-5">
                {count} necitite
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!notifications?.length ? (
              <div className="px-4 py-8 text-center text-sm text-gray-5">
                Nu ai notificari.
              </div>
            ) : (
              <div className="space-y-1 p-1.5">
                {notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.documentId}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left transition hover:bg-gray-1",
                      !n.read && "bg-indigo-1/50",
                    )}
                    onClick={() => {
                      if (!n.read) void handleMarkRead(n.documentId);
                      if (n.href) window.location.href = n.href;
                    }}
                  >
                    <div className={cn(
                      "mt-1 h-2 w-2 flex-shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-indigo-5",
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", n.read ? "text-gray-5" : "font-bold text-gray-7")}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 truncate text-xs text-gray-5">{n.body}</p>
                      )}
                      {n.createdAt && (
                        <p className="mt-1 text-xs text-gray-6">{timeAgo(n.createdAt)}</p>
                      )}
                    </div>
                    {!n.read && (
                      <Check className="mt-1 h-4 w-4 flex-shrink-0 text-gray-5" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
