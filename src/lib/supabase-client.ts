import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client for real-time subscriptions
// Uses the anon key which is safe to expose in the browser

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn(
            'Supabase real-time not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
        return null;
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });

    return supabaseClient;
}
