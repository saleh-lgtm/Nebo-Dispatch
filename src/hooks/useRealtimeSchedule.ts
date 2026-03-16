"use client";

import { useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface SchedulePayload {
    id: string;
    userId: string;
    date: string;
    startHour: number;
    endHour: number;
    isPublished: boolean;
    weekStart: string | null;
    createdAt: string;
    updatedAt: string;
}

interface UseRealtimeScheduleOptions {
    weekStart?: Date;
    onInsert?: (schedule: SchedulePayload) => void;
    onUpdate?: (schedule: SchedulePayload) => void;
    onDelete?: (oldRecord: { id: string }) => void;
    onAnyChange?: () => void;
    enabled?: boolean;
}

/**
 * Hook for real-time Schedule updates using Supabase Realtime
 *
 * SETUP REQUIRED: Enable realtime on the Schedule table in Supabase:
 * 1. Go to Supabase Dashboard > Database > Replication
 * 2. Enable replication for the "Schedule" table
 * 3. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
 */
export function useRealtimeSchedule({
    weekStart,
    onInsert,
    onUpdate,
    onDelete,
    onAnyChange,
    enabled = true,
}: UseRealtimeScheduleOptions = {}) {
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Helper to check if a schedule is in the current week
    const isInCurrentWeek = useCallback(
        (dateStr: string) => {
            if (!weekStart) return true; // No filter, accept all

            const scheduleDate = new Date(dateStr);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            return scheduleDate >= weekStart && scheduleDate < weekEnd;
        },
        [weekStart]
    );

    const handleInsert = useCallback(
        (payload: { new: SchedulePayload }) => {
            const newSchedule = payload.new;

            // Filter by week if specified
            if (!isInCurrentWeek(newSchedule.date)) {
                return;
            }

            onInsert?.(newSchedule);
            onAnyChange?.();
        },
        [isInCurrentWeek, onInsert, onAnyChange]
    );

    const handleUpdate = useCallback(
        (payload: { new: SchedulePayload; old: { id: string } }) => {
            const updated = payload.new;

            // Filter by week if specified
            if (!isInCurrentWeek(updated.date)) {
                return;
            }

            onUpdate?.(updated);
            onAnyChange?.();
        },
        [isInCurrentWeek, onUpdate, onAnyChange]
    );

    const handleDelete = useCallback(
        (payload: { old: { id: string } }) => {
            onDelete?.(payload.old);
            onAnyChange?.();
        },
        [onDelete, onAnyChange]
    );

    useEffect(() => {
        if (!enabled) return;

        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn("Supabase client not available for real-time schedule updates");
            return;
        }

        // Create a unique channel name based on week
        const channelName = weekStart
            ? `schedule-week:${weekStart.toISOString().slice(0, 10)}`
            : "schedule-all";

        // Subscribe to Schedule changes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase channel types are incomplete
        const channel = (supabase.channel(channelName) as any)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "Schedule",
                },
                handleInsert
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "Schedule",
                },
                handleUpdate
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "Schedule",
                },
                handleDelete
            )
            .subscribe((status: string) => {
                if (status === "SUBSCRIBED") {
                    console.log(`Real-time Schedule subscription active: ${channelName}`);
                } else if (status === "CHANNEL_ERROR") {
                    console.error("Failed to subscribe to Schedule updates");
                }
            });

        channelRef.current = channel;

        // Cleanup on unmount or when dependencies change
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [enabled, weekStart, handleInsert, handleUpdate, handleDelete]);

    // Return function to manually unsubscribe
    const unsubscribe = useCallback(() => {
        const supabase = getSupabaseClient();
        if (supabase && channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    return { unsubscribe };
}
