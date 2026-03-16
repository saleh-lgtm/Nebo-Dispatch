// Scheduler Types - Timezone-Free Architecture
// All hours are Central Time (implicit, no conversion needed)

// ============ Enums (mirror Prisma) ============

export type Market = "DFW" | "AUS" | "SAT";
export type ShiftType = "MORNING" | "AFTERNOON" | "NIGHT" | "CUSTOM";

// ============ Server Data Types ============

export interface Dispatcher {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ScheduleRecord {
  id: string;
  userId: string;
  userName: string | null;
  date: Date;
  startHour: number;
  endHour: number;
  market: Market | null;
  shiftType: ShiftType;
  isPublished: boolean;
  notes: string | null;
}

export interface ScheduleInput {
  userId: string;
  date: Date;
  startHour: number;
  endHour: number;
  market?: Market | null;
  shiftType?: ShiftType;
  notes?: string | null;
}

export interface WeekScheduleData {
  schedules: ScheduleRecord[];
  weekStart: Date;
  weekEnd: Date;
  isPublished: boolean;
}

// ============ Validation Types ============

export type ValidationErrorType =
  | "overlap"
  | "time_off"
  | "consecutive_days"
  | "no_coverage"
  | "invalid_hours"
  | "overtime";

export interface ValidationError {
  type: ValidationErrorType;
  severity: "error" | "warning";
  message: string;
  userId?: string;
  date?: Date;
}

// ============ Client Grid Types ============

export interface GridShift {
  id: string;
  odayIndex: number; // 0=Mon, 1=Tue, ..., 6=Sun
  startHour: number;
  endHour: number;
  duration: number;
  market: Market | null;
  shiftType: ShiftType;
  isPublished: boolean;
  isOvernight: boolean;
  displayText: string; // "6A-2P" or "10P-6A"
}

export interface DispatcherRow {
  id: string;
  name: string;
  email: string | null;
  weeklyHours: number;
  shifts: GridShift[];
}

export interface SchedulerState {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  dispatchers: DispatcherRow[];
  isPublished: boolean;
  marketFilter: Market | "ALL";
  hasUnsavedChanges: boolean;
  validationErrors: ValidationError[];
}

// ============ Template Types ============

export interface TemplateShiftInput {
  dayOfWeek: number; // 0=Mon, 1=Tue, ..., 6=Sun
  startHour: number;
  endHour: number;
  market?: Market | null;
  shiftType?: ShiftType;
  dispatcherId?: string | null;
}

export interface TemplateShift extends TemplateShiftInput {
  id: string;
  order: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdById: string;
  createdByName: string | null;
  shifts: TemplateShift[];
  createdAt: Date;
  updatedAt: Date;
}

// ============ Coverage Types ============

export interface DayCoverage {
  date: Date;
  dayName: string;
  dayIndex: number;
  shifts: number;
  hours: number;
  markets: Market[];
  gaps: number[]; // Hours with no coverage
}

export interface WeekCoverageReport {
  byDay: DayCoverage[];
  totalHours: number;
  dispatcherHours: { userId: string; name: string; hours: number }[];
}

// ============ Helper Constants ============

export const MARKET_COLORS: Record<Market, string> = {
  DFW: "#E8553A",
  AUS: "#2D9CDB",
  SAT: "#27AE60",
};

export const SHIFT_PRESETS: Record<Exclude<ShiftType, "CUSTOM">, { startHour: number; endHour: number }> = {
  MORNING: { startHour: 6, endHour: 14 },
  AFTERNOON: { startHour: 14, endHour: 22 },
  NIGHT: { startHour: 22, endHour: 6 },
};

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// ============ Helper Functions ============

/**
 * Format hour to display string (e.g., 6 -> "6A", 14 -> "2P", 0 -> "12A")
 */
export function formatHour(h: number): string {
  if (h === 0) return "12A";
  if (h < 12) return `${h}A`;
  if (h === 12) return "12P";
  return `${h - 12}P`;
}

/**
 * Format hour to full display (e.g., 6 -> "6:00 AM")
 */
export function formatHourFull(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

/**
 * Format shift to short display (e.g., "6A-2P" or "10P-6A")
 */
export function formatShiftShort(startHour: number, endHour: number): string {
  return `${formatHour(startHour)}-${formatHour(endHour)}`;
}

/**
 * Calculate shift duration accounting for overnight shifts
 */
export function getShiftDuration(startHour: number, endHour: number): number {
  if (endHour > startHour) {
    return endHour - startHour;
  }
  // Overnight: 22-6 = (24 - 22) + 6 = 8
  return (24 - startHour) + endHour;
}

/**
 * Check if shift is overnight (ends before or at start time)
 */
export function isOvernightShift(startHour: number, endHour: number): boolean {
  return endHour <= startHour;
}

/**
 * Get Monday of the week containing a date (UTC-based)
 * Uses UTC methods to match database UTC midnight dates
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get array of dates for a week (Mon-Sun) - UTC-based
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format week range (e.g., "Mar 11 - 17, 2024") - UTC-based
 */
export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  // Use UTC dates for consistent display
  const startMonth = new Date(weekStart).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = new Date(weekEnd).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const year = weekStart.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getUTCDate()} - ${weekEnd.getUTCDate()}, ${year}`;
  }
  return `${startMonth} ${weekStart.getUTCDate()} - ${endMonth} ${weekEnd.getUTCDate()}, ${year}`;
}

/**
 * Get day index (0=Mon, 6=Sun) from a date relative to week start
 * Uses Math.round to handle any sub-day rounding from timezone offsets
 */
export function getDayIndex(date: Date, weekStart: Date): number {
  const diffTime = date.getTime() - weekStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(6, diffDays));
}

/**
 * Add days to a date (UTC-based arithmetic)
 * Uses UTC methods to match database UTC midnight dates
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parse ISO date string to Date
 */
export function parseDateISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
