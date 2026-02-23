/**
 * SMS Rate Limiter with Token Bucket Algorithm
 * Twilio default rate limit: 80 messages per second (MPS)
 * We use a conservative 50 MPS to leave headroom
 */

interface RateLimiterConfig {
    maxTokens: number;      // Max burst capacity
    refillRate: number;     // Tokens added per second
    retryAttempts: number;  // Max retry attempts
    initialDelay: number;   // Initial retry delay in ms
}

const DEFAULT_CONFIG: RateLimiterConfig = {
    maxTokens: 50,          // Allow burst of 50 messages
    refillRate: 50,         // Refill 50 tokens/second (50 MPS)
    retryAttempts: 3,       // Retry up to 3 times
    initialDelay: 1000,     // Start with 1 second delay
};

class SMSRateLimiter {
    private tokens: number;
    private lastRefill: number;
    private config: RateLimiterConfig;

    constructor(config: Partial<RateLimiterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.tokens = this.config.maxTokens;
        this.lastRefill = Date.now();
    }

    /**
     * Refill tokens based on time elapsed
     */
    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // seconds
        const tokensToAdd = elapsed * this.config.refillRate;

        this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    /**
     * Try to acquire a token for sending an SMS
     * @returns true if token acquired, false if rate limited
     */
    public tryAcquire(): boolean {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }

        return false;
    }

    /**
     * Wait until a token is available
     * @returns Promise that resolves when token is acquired
     */
    public async acquire(): Promise<void> {
        while (!this.tryAcquire()) {
            // Calculate wait time until next token
            const waitTime = Math.ceil(1000 / this.config.refillRate);
            await this.sleep(waitTime);
        }
    }

    /**
     * Get current available tokens (for monitoring)
     */
    public getAvailableTokens(): number {
        this.refill();
        return Math.floor(this.tokens);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance for global rate limiting
let rateLimiter: SMSRateLimiter | null = null;

export function getSMSRateLimiter(): SMSRateLimiter {
    if (!rateLimiter) {
        rateLimiter = new SMSRateLimiter();
    }
    return rateLimiter;
}

/**
 * Twilio error codes that are transient and should be retried
 */
const RETRYABLE_ERROR_CODES = [
    20429, // Too Many Requests
    20500, // Internal Server Error
    20503, // Service Unavailable
    30001, // Queue overflow
    30002, // Account suspended (may be temporary)
    30008, // Unknown error
];

/**
 * Check if a Twilio error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code: number }).code;
        return RETRYABLE_ERROR_CODES.includes(code);
    }

    // Network errors are retryable
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('socket hang up')
        );
    }

    return false;
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        initialDelay?: number;
        maxDelay?: number;
        shouldRetry?: (error: unknown) => boolean;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        shouldRetry = isRetryableError,
    } = options;

    let lastError: unknown;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts || !shouldRetry(error)) {
                throw error;
            }

            console.warn(
                `SMS send attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`,
                error instanceof Error ? error.message : error
            );

            await new Promise(resolve => setTimeout(resolve, delay));

            // Exponential backoff with jitter
            delay = Math.min(delay * 2 + Math.random() * 1000, maxDelay);
        }
    }

    throw lastError;
}

/**
 * Rate-limited SMS send wrapper
 * Acquires a token before allowing the send operation
 */
export async function rateLimitedSend<T>(
    sendFn: () => Promise<T>
): Promise<T> {
    const limiter = getSMSRateLimiter();

    // Wait for rate limit token
    await limiter.acquire();

    // Execute with retry logic
    return withRetry(sendFn);
}

export { SMSRateLimiter };
