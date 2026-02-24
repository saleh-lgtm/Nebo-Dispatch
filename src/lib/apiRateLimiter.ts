/**
 * API Rate Limiter using sliding window algorithm
 * Provides protection against brute force and DoS attacks
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
    default: { requests: 100, windowMs: 60 * 1000 },      // 100 req/min
    auth: { requests: 5, windowMs: 60 * 1000 },           // 5 req/min for login
    api: { requests: 60, windowMs: 60 * 1000 },           // 60 req/min for API
    webhook: { requests: 200, windowMs: 60 * 1000 },      // 200 req/min for webhooks
    sensitive: { requests: 10, windowMs: 60 * 1000 },     // 10 req/min for sensitive ops
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    limit: number;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
    identifier: string,
    type: RateLimitType = "default"
): RateLimitResult {
    const config = RATE_LIMITS[type];
    const now = Date.now();
    const key = `${type}:${identifier}`;

    const entry = rateLimitStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
        cleanupExpiredEntries();
    }

    if (!entry || now > entry.resetTime) {
        // First request or window expired
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.requests - 1,
            resetIn: config.windowMs,
            limit: config.requests,
        };
    }

    if (entry.count >= config.requests) {
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetIn: entry.resetTime - now,
            limit: config.requests,
        };
    }

    // Increment counter
    entry.count++;
    return {
        allowed: true,
        remaining: config.requests - entry.count,
        resetIn: entry.resetTime - now,
        limit: config.requests,
    };
}

/**
 * Get client identifier from request (IP + optional user ID)
 */
export function getClientIdentifier(
    request: Request,
    userId?: string
): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "unknown";

    return userId ? `${ip}:${userId}` : ip;
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
    return {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(result.resetIn / 1000).toString(),
    };
}

/**
 * Rate limit middleware wrapper for API routes
 */
export function withRateLimit<T>(
    handler: (request: Request) => Promise<Response>,
    type: RateLimitType = "default"
): (request: Request) => Promise<Response> {
    return async (request: Request) => {
        const identifier = getClientIdentifier(request);
        const result = checkRateLimit(identifier, type);

        if (!result.allowed) {
            return new Response(
                JSON.stringify({
                    error: "Too many requests",
                    retryAfter: Math.ceil(result.resetIn / 1000),
                }),
                {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": Math.ceil(result.resetIn / 1000).toString(),
                        ...getRateLimitHeaders(result),
                    },
                }
            );
        }

        const response = await handler(request);

        // Add rate limit headers to successful response
        const headers = new Headers(response.headers);
        Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Reset rate limit for a specific identifier (useful for testing)
 */
export function resetRateLimit(identifier: string, type: RateLimitType = "default"): void {
    rateLimitStore.delete(`${type}:${identifier}`);
}
