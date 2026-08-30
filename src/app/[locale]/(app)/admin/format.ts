import type { Locale } from "@/i18n/config";

const SINGAPORE_TIME_ZONE = "Asia/Singapore";

export function formatDateTime(isoValue: string, locale: Locale): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
    timeZone: SINGAPORE_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(isoValue: string, locale: Locale): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
    timeZone: SINGAPORE_TIME_ZONE,
    dateStyle: "medium",
  }).format(date);
}

/**
 * Every Saturday's calendar date (YYYY-MM-DD) between two plain dates,
 * inclusive. Walks in UTC so the plain date strings never shift across a
 * local-timezone boundary.
 */
export function saturdaysBetween(startsOn: string, endsOn: string): string[] {
  if (!startsOn || !endsOn || startsOn > endsOn) return [];
  const result: string[] = [];
  let current = new Date(`${startsOn}T00:00:00Z`);
  const end = new Date(`${endsOn}T00:00:00Z`);
  while (current.getTime() <= end.getTime()) {
    if (current.getUTCDay() === 6) result.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return result;
}

/**
 * Combines a plain calendar date and a wall-clock time into an ISO-8601
 * string with an explicit Singapore (+08:00) offset, so administrators never
 * need to reason about their own browser's timezone when scheduling a
 * service. Singapore has no daylight saving, so the offset is constant.
 */
export function toSingaporeIsoString(dateValue: string, timeValue: string): string | null {
  if (!dateValue || !timeValue) return null;
  const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
  return `${dateValue}T${normalizedTime}+08:00`;
}

/**
 * The inverse of toSingaporeIsoString: splits any ISO instant into the
 * Singapore-local calendar date and wall-clock time, for pre-filling a
 * date/time form pair. Singapore has no daylight saving, so a fixed +8h
 * shift is exact.
 */
export function splitSingaporeIsoString(isoValue: string): Readonly<{ date: string; time: string }> {
  const shifted = new Date(new Date(isoValue).getTime() + 8 * 60 * 60 * 1000);
  return { date: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 16) };
}
