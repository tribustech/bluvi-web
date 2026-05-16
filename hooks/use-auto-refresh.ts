"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoRefreshOptions {
  intervalSeconds?: number;
  cooldownSeconds?: number;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
}

export function useAutoRefresh({
  intervalSeconds = 60,
  cooldownSeconds = 10,
  onRefresh,
  enabled = true,
}: UseAutoRefreshOptions) {
  const [countdown, setCountdown] = useState(intervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastManualRefresh = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const onVisibilityChange = () => {
      const paused = document.hidden;
      setIsPaused(paused);
      if (!paused) {
        setCountdown(intervalSeconds);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, intervalSeconds]);

  useEffect(() => {
    if (!enabled || isPaused) return;

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          void onRefresh();
          return intervalSeconds;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled, intervalSeconds, isPaused, onRefresh]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = window.setInterval(() => {
      setCooldownRemaining((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  const manualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastManualRefresh.current < cooldownSeconds * 1000) return;

    lastManualRefresh.current = now;
    setIsRefreshing(true);
    setCooldownRemaining(cooldownSeconds);

    try {
      await onRefresh();
    } finally {
      setCountdown(intervalSeconds);
      setIsRefreshing(false);
    }
  }, [cooldownSeconds, intervalSeconds, onRefresh]);

  return {
    countdown,
    isRefreshing,
    cooldownRemaining,
    canManualRefresh: cooldownRemaining === 0 && !isRefreshing,
    manualRefresh,
    isPaused,
  };
}
