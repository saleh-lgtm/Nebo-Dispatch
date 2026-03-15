/**
 * Engagement Types
 */

export interface ChartData {
  date: string;
  total: number;
  [key: string]: string | number;
}

export interface DispatcherInfo {
  id: string;
  name: string;
  color: string;
}

export interface DispatcherEngagement {
  userId: string;
  userName: string;
  totalActions: number;
  totalPoints: number;
  breakdown: Record<string, number>;
}

export interface EngagementStats {
  totalActions: number;
  totalPoints: number;
  topPerformer: DispatcherEngagement | null;
  dispatchers: DispatcherEngagement[];
}

/**
 * Chart colors for dispatcher lines
 */
export const CHART_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

/**
 * Get color for dispatcher by index
 */
export function getDispatcherColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
