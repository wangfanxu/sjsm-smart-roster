import type { Locale } from "@/i18n/config";
import type { Assignment } from "./types";

/**
 * Returns the current date as YYYY-MM-DD in the environment's local time
 * zone. This is only used to proactively disable past dates in the UI date
 * picker; the server remains the source of truth (it evaluates dates in
 * Asia/Singapore and will still reject a past `serviceDate`).
 */
export function todayIsoDate(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Compares two YYYY-MM-DD strings lexicographically, which is safe for this format. */
export function isPastDate(candidateIsoDate: string, todayIso: string = todayIsoDate()): boolean {
  return candidateIsoDate < todayIso;
}

const dateFormatterCache = new Map<Locale, Intl.DateTimeFormat>();

function dateFormatterFor(locale: Locale): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  dateFormatterCache.set(locale, formatter);
  return formatter;
}

/** Formats a YYYY-MM-DD calendar date and an HH:MM time for display in the given locale. */
export function formatServiceDateTime(serviceDate: string, serviceTime: string, locale: Locale): string {
  const [year, month, day] = serviceDate.split("-").map(Number);
  const formattedDate = dateFormatterFor(locale).format(new Date(year, month - 1, day));
  return `${formattedDate} · ${serviceTime}`;
}

/** Formats a standalone YYYY-MM-DD calendar date for display in the given locale. */
export function formatCalendarDate(serviceDate: string, locale: Locale): string {
  const [year, month, day] = serviceDate.split("-").map(Number);
  return dateFormatterFor(locale).format(new Date(year, month - 1, day));
}

/** Sorts assignments chronologically by start time, defensively (the API already orders them). */
export function sortAssignmentsChronologically(assignments: readonly Assignment[]): Assignment[] {
  return [...assignments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
