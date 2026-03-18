/**
 * Front API Client
 *
 * Handles authentication, rate limiting (50 req/min), pagination, and in-memory caching.
 * Base URL: https://api2.frontapp.com
 */

const FRONT_API_BASE = "https://api2.frontapp.com";
const RATE_LIMIT_DELAY_MS = 1250; // ~48 req/min to stay under 50
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache
const cache = new Map<string, { data: unknown; expiresAt: number }>();

let lastRequestTime = 0;

function getApiKey(): string {
    const key = process.env.FRONT_API_KEY;
    if (!key) throw new Error("FRONT_API_KEY not set");
    return key;
}

async function rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
}

export async function frontFetch<T>(
    path: string,
    options?: { skipCache?: boolean }
): Promise<T> {
    const cacheKey = path;

    // Check cache
    if (!options?.skipCache) {
        const cached = cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data as T;
        }
    }

    await rateLimit();

    const res = await fetch(`${FRONT_API_BASE}${path}`, {
        headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
        },
    });

    if (res.status === 429) {
        // Rate limited — wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return frontFetch<T>(path, { skipCache: true });
    }

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Front API ${res.status}: ${body}`);
    }

    const data = await res.json();

    // Cache the result
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data as T;
}

/**
 * Paginate through all results from a Front API list endpoint.
 * Front uses _pagination.next for cursor-based pagination.
 */
export async function frontFetchAll<T>(
    path: string,
    maxPages: number = 20
): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = `${FRONT_API_BASE}${path}`;
    let page = 0;

    while (nextUrl && page < maxPages) {
        await rateLimit();

        const res: Response = await fetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${getApiKey()}`,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            if (res.status === 429) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue; // Retry same page
            }
            break;
        }

        const data: { _results?: T[]; _pagination?: { next?: string | null } } = await res.json();
        if (data._results) {
            results.push(...data._results);
        }

        nextUrl = data._pagination?.next ?? null;
        page++;
    }

    return results;
}

/**
 * Clear the in-memory cache (useful for admin settings page)
 */
export function clearFrontCache(): void {
    cache.clear();
}

// Front API response types

export interface FrontTeammate {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    is_admin: boolean;
    is_available: boolean;
    is_blocked: boolean;
}

export interface FrontEvent {
    id: string;
    type: string;
    emitted_at: number;
    conversation?: {
        id: string;
        subject: string;
        status: string;
        assignee?: { id: string; email: string } | null;
        tags?: Array<{ name: string }>;
    };
    source?: {
        _meta: { type: string };
        data: Array<{ id: string; name: string }>;
    };
    target?: {
        _meta: { type: string };
        data: {
            id: string;
            type: string;
            is_inbound: boolean;
            created_at: number;
            author?: { id: string; email: string; first_name: string; last_name: string } | null;
        };
    };
}

export interface FrontConversation {
    id: string;
    subject: string;
    status: string;
    assignee?: { id: string; email: string } | null;
    tags: Array<{ name: string }>;
    created_at: number;
    updated_at: number;
    waiting_since: number;
}
