/**
 * Pagination Utilities
 *
 * Standardized pagination for database queries.
 * Prevents unbounded queries from crashing the server.
 *
 * Usage:
 *   import { paginationParams, paginatedResponse } from "@/lib/pagination";
 *
 *   const { skip, take } = paginationParams({ page: 2, limit: 20 });
 *   const items = await prisma.item.findMany({ skip, take });
 *   const total = await prisma.item.count();
 *   return paginatedResponse(items, { page: 2, limit: 20, total });
 */

// ============================================
// Types
// ============================================

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationParams {
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================
// Constants
// ============================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Domain-specific limits for large tables
export const ROUTE_PRICE_LIMIT = 50;
export const AFFILIATE_PRICING_LIMIT = 100;
export const AUDIT_LOG_LIMIT = 50;
export const CONFIRMATION_LIMIT = 50;

// ============================================
// Core Functions
// ============================================

/**
 * Convert page/limit to Prisma skip/take
 * Enforces MAX_LIMIT to prevent memory issues
 */
export function paginationParams(
  input: PaginationInput = {},
  maxLimit = MAX_LIMIT
): PaginationParams {
  const page = Math.max(1, input.page ?? DEFAULT_PAGE);
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), maxLimit);

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build pagination metadata from query results
 */
export function paginationMeta(
  input: PaginationInput,
  total: number
): PaginationMeta {
  const page = Math.max(1, input.page ?? DEFAULT_PAGE);
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Wrap data array with pagination metadata
 */
export function paginatedResponse<T>(
  data: T[],
  input: PaginationInput & { total: number }
): PaginatedResponse<T> {
  return {
    data,
    meta: paginationMeta(input, input.total),
  };
}

// ============================================
// Cursor-based Pagination (for large datasets)
// ============================================

export interface CursorInput {
  cursor?: string;
  limit?: number;
}

export interface CursorParams {
  take: number;
  skip?: number;
  cursor?: { id: string };
}

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorResponse<T> {
  data: T[];
  meta: CursorMeta;
}

/**
 * Convert cursor input to Prisma cursor params
 * Use for very large tables (RoutePrice, AuditLog)
 */
export function cursorParams(
  input: CursorInput = {},
  maxLimit = MAX_LIMIT
): CursorParams {
  const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), maxLimit);

  if (input.cursor) {
    return {
      take: limit + 1, // Fetch one extra to check hasMore
      skip: 1,
      cursor: { id: input.cursor },
    };
  }

  return {
    take: limit + 1,
  };
}

/**
 * Build cursor response from query results
 */
export function cursorResponse<T extends { id: string }>(
  data: T[],
  limit: number
): CursorResponse<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return {
    data: items,
    meta: {
      nextCursor,
      hasMore,
    },
  };
}

// ============================================
// Search Params Helpers
// ============================================

/**
 * Parse pagination from URL search params
 * For use in page.tsx server components
 */
export function parsePaginationFromParams(
  searchParams: Record<string, string | string[] | undefined>
): PaginationInput {
  const page = searchParams.page;
  const limit = searchParams.limit;

  return {
    page: typeof page === "string" ? parseInt(page, 10) || DEFAULT_PAGE : DEFAULT_PAGE,
    limit: typeof limit === "string" ? parseInt(limit, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT,
  };
}

/**
 * Build query string from pagination params
 * For use in client components for navigation
 */
export function buildPaginationQuery(input: PaginationInput): string {
  const params = new URLSearchParams();
  if (input.page && input.page !== DEFAULT_PAGE) {
    params.set("page", String(input.page));
  }
  if (input.limit && input.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(input.limit));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
