"use client";

import { useEffect, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface SMSLogPayload {
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    from: string | null;
    to: string;
    message: string;
    status: string;
    messageSid: string | null;
    segments: number;
    conversationPhone: string | null;
    createdAt: string;
}

interface UseRealtimeSMSOptions {
    conversationPhone?: string;  // Filter to specific conversation
    onNewMessage?: (message: SMSLogPayload) => void;
    onStatusUpdate?: (messageSid: string, newStatus: string) => void;
    enabled?: boolean;
}

/**
 * Hook for real-time SMS updates using Supabase Realtime
 *
 * SETUP REQUIRED: Enable realtime on the SMSLog table in Supabase:
 * 1. Go to Supabase Dashboard > Database > Replication
 * 2. Enable replication for the "SMSLog" table
 * 3. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env
 */
export function useRealtimeSMS({
    conversationPhone,
    onNewMessage,
    onStatusUpdate,
    enabled = true,
}: UseRealtimeSMSOptions = {}) {
    const channelRef = useRef<RealtimeChannel | null>(null);

    const handleInsert = useCallback(
        (payload: { new: SMSLogPayload }) => {
            const newMessage = payload.new;

            // Filter by conversation if specified
            if (conversationPhone && newMessage.conversationPhone !== conversationPhone) {
                return;
            }

            onNewMessage?.(newMessage);
        },
        [conversationPhone, onNewMessage]
    );

    const handleUpdate = useCallback(
        (payload: { new: SMSLogPayload; old: { id: string; status?: string } }) => {
            const updated = payload.new;

            // Notify about status changes
            if (updated.messageSid && updated.status !== payload.old?.status) {
                onStatusUpdate?.(updated.messageSid, updated.status);
            }
        },
        [onStatusUpdate]
    );

    useEffect(() => {
        if (!enabled) return;

        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn("Supabase client not available for real-time updates");
            return;
        }

        // Create a unique channel name
        const channelName = conversationPhone
            ? `sms-conversation:${conversationPhone}`
            : "sms-all";

        // Subscribe to SMSLog changes
        const channel = supabase
            .channel(channelName)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "SMSLog",
                    ...(conversationPhone && {
                        filter: `conversationPhone=eq.${conversationPhone}`,
                    }),
                },
                handleInsert
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "SMSLog",
                    ...(conversationPhone && {
                        filter: `conversationPhone=eq.${conversationPhone}`,
                    }),
                },
                handleUpdate
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    console.log(`Real-time SMS subscription active: ${channelName}`);
                } else if (status === "CHANNEL_ERROR") {
                    console.error("Failed to subscribe to SMS updates");
                }
            });

        channelRef.current = channel;

        // Cleanup on unmount
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [enabled, conversationPhone, handleInsert, handleUpdate]);

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
