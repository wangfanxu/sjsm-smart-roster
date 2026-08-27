import { describe, expect, it } from "vitest";
import { getMessages, isLocale, locales } from "./config";

describe("locale configuration", () => {
  it("supports English and Simplified Chinese", () => {
    expect(locales).toEqual(["en", "zh"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("provides complete landing-page messages for every locale", () => {
    for (const locale of locales) {
      const messages = getMessages(locale);

      expect(messages.title).not.toHaveLength(0);
      expect(messages.description).not.toHaveLength(0);
      expect(messages.foundationItems).toHaveLength(4);
    }
  });
});
