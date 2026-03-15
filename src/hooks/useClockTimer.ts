"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Format milliseconds into human-readable duration
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

/**
 * Format date to time string
 */
export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get time difference label for early/late clock-in
 */
export function getTimeDiffLabel(
  minutes: number | null
): { text: string; color: string } | null {
  if (minutes === null) return null;
  if (minutes > 5) {
    return { text: `${minutes}m early`, color: "#4ade80" };
  } else if (minutes < -5) {
    return { text: `${Math.abs(minutes)}m late`, color: "#f87171" };
  }
  return { text: "On time", color: "#fbbf24" };
}

interface UseClockTimerOptions {
  /** Clock-in timestamp */
  clockInTime: Date | null;
  /** Whether currently clocked in */
  isClocked: boolean;
  /** Update interval in ms (default: 60000) */
  intervalMs?: number;
}

interface UseClockTimerReturn {
  /** Formatted elapsed time string (e.g., "2h 30m") */
  elapsedTime: string;
  /** Raw elapsed milliseconds */
  elapsedMs: number;
  /** Manually refresh the timer */
  refresh: () => void;
}

/**
 * Hook for tracking elapsed shift time
 *
 * Usage:
 *   const { elapsedTime } = useClockTimer({
 *     clockInTime: shift?.clockIn,
 *     isClocked: status?.isClocked ?? false,
 *   });
 */
export function useClockTimer({
  clockInTime,
  isClocked,
  intervalMs = 60000,
}: UseClockTimerOptions): UseClockTimerReturn {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const calculateElapsed = useCallback(() => {
    if (!clockInTime) return 0;
    return Date.now() - new Date(clockInTime).getTime();
  }, [clockInTime]);

  const refresh = useCallback(() => {
    setElapsedMs(calculateElapsed());
  }, [calculateElapsed]);

  useEffect(() => {
    if (!isClocked || !clockInTime) {
      setElapsedMs(0);
      return;
    }

    // Initial calculation
    refresh();

    // Set up interval for updates
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [isClocked, clockInTime, intervalMs, refresh]);

  return {
    elapsedTime: elapsedMs > 0 ? formatDuration(elapsedMs) : "",
    elapsedMs,
    refresh,
  };
}

export default useClockTimer;
