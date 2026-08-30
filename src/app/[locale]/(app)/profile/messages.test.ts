import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getProfileMessages, systemRoleLabel } from "./messages";

describe("profile messages", () => {
  it("provides non-empty copy for every locale", () => {
    for (const locale of locales) {
      const messages = getProfileMessages(locale);

      for (const [key, value] of Object.entries(messages)) {
        expect(value.length, `${locale}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the same message keys across locales", () => {
    const [first, ...rest] = locales.map((locale) => Object.keys(getProfileMessages(locale)).sort());
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });
});

describe("systemRoleLabel", () => {
  it("maps every system role to a non-empty label in every locale", () => {
    for (const locale of locales) {
      const messages = getProfileMessages(locale);
      expect(systemRoleLabel("volunteer", messages)).toBe(messages.systemRoleVolunteer);
      expect(systemRoleLabel("team_leader", messages)).toBe(messages.systemRoleTeamLeader);
      expect(systemRoleLabel("administrator", messages)).toBe(messages.systemRoleAdministrator);
    }
  });
});
