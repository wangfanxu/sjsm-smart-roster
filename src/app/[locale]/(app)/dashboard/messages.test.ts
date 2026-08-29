import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getDashboardMessages } from "./messages";

describe("dashboard messages", () => {
  it("provides non-empty copy for every locale", () => {
    for (const locale of locales) {
      const messages = getDashboardMessages(locale);

      for (const [key, value] of Object.entries(messages)) {
        if (typeof value === "string") {
          expect(value.length, `${locale}.${key} should not be empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has a label for every availability status in every locale", () => {
    for (const locale of locales) {
      const { availabilityStatusOptions } = getDashboardMessages(locale);
      expect(Object.keys(availabilityStatusOptions).sort()).toEqual([
        "available",
        "preferred",
        "unavailable",
      ]);
    }
  });

  it("keeps the same message keys across locales", () => {
    const [first, ...rest] = locales.map((locale) => Object.keys(getDashboardMessages(locale)).sort());
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });
});
