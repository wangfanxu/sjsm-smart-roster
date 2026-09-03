import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatServiceDateTime,
  isPastDate,
  sortAssignmentsChronologically,
  todayIsoDate,
} from "./date-utils";
import type { Assignment } from "./types";

describe("todayIsoDate", () => {
  it("formats a date as YYYY-MM-DD using local calendar fields", () => {
    expect(todayIsoDate(new Date(2026, 8, 5))).toBe("2026-09-05");
    expect(todayIsoDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("isPastDate", () => {
  it("treats dates before today as past", () => {
    expect(isPastDate("2026-08-27", "2026-08-28")).toBe(true);
  });

  it("treats today as not past", () => {
    expect(isPastDate("2026-08-28", "2026-08-28")).toBe(false);
  });

  it("treats future dates as not past", () => {
    expect(isPastDate("2026-08-29", "2026-08-28")).toBe(false);
  });
});

describe("formatServiceDateTime", () => {
  it("includes the service time alongside the formatted date", () => {
    const formatted = formatServiceDateTime("2026-09-05", "09:00", "en");
    expect(formatted).toContain("09:00");
    expect(formatted).toContain("2026");
  });

  it("renders for the Chinese locale without throwing", () => {
    const formatted = formatServiceDateTime("2026-09-05", "09:00", "zh");
    expect(formatted).toContain("09:00");
  });
});

describe("formatCalendarDate", () => {
  it("formats a calendar date without a time component", () => {
    const formatted = formatCalendarDate("2026-09-05", "en");
    expect(formatted).toContain("2026");
    expect(formatted).not.toContain("09:00");
  });
});

describe("sortAssignmentsChronologically", () => {
  it("orders assignments by startsAt ascending without mutating the input", () => {
    const assignments: Assignment[] = [
      {
        assignmentId: "b",
        serviceId: "svc-b",
        startsAt: "2026-09-12T01:00:00.000Z",
        serviceDate: "2026-09-12",
        serviceTime: "09:00",
        title: "Second",
        role: "Usher",
        teammates: [],
        openReplacementRequestId: null,
      },
      {
        assignmentId: "a",
        serviceId: "svc-a",
        startsAt: "2026-09-05T01:00:00.000Z",
        serviceDate: "2026-09-05",
        serviceTime: "09:00",
        title: "First",
        role: "Drummer",
        teammates: [],
        openReplacementRequestId: null,
      },
    ];

    const sorted = sortAssignmentsChronologically(assignments);

    expect(sorted.map((assignment) => assignment.assignmentId)).toEqual(["a", "b"]);
    expect(assignments.map((assignment) => assignment.assignmentId)).toEqual(["b", "a"]);
  });
});
