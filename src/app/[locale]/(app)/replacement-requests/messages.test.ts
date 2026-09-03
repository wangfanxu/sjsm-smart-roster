import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getReplacementRequestsMessages, statusLabel } from "./messages";

describe("replacement-requests messages", () => {
  it("provides non-empty copy for every locale", () => {
    for (const locale of locales) {
      const messages = getReplacementRequestsMessages(locale);
      for (const [key, value] of Object.entries(messages)) {
        expect(value.length, `${locale}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the same message keys across locales", () => {
    const [first, ...rest] = locales.map((locale) =>
      Object.keys(getReplacementRequestsMessages(locale)).sort(),
    );
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });
});

describe("statusLabel", () => {
  it("maps every status to a non-empty label in every locale", () => {
    for (const locale of locales) {
      const messages = getReplacementRequestsMessages(locale);
      expect(statusLabel("open", messages)).toBe(messages.statusOpen);
      expect(statusLabel("approved", messages)).toBe(messages.statusApproved);
      expect(statusLabel("declined", messages)).toBe(messages.statusDeclined);
      expect(statusLabel("cancelled", messages)).toBe(messages.statusCancelled);
    }
  });
});
