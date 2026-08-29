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
