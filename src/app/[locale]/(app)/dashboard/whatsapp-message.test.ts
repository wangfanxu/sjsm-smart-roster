import { describe, expect, it } from "vitest";
import type { Assignment } from "./types";
import { buildWhatsAppMessage } from "./whatsapp-message";

function baseAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    assignmentId: "assignment-1",
    serviceId: "service-1",
    startsAt: "2026-09-05T01:00:00.000Z",
    serviceDate: "2026-09-05",
    serviceTime: "09:00",
    title: "Sunday Worship",
    role: "Drummer",
    teammates: [],
    openReplacementRequestId: null,
    songs: [],
    songsPrintingLink: null,
    ...overrides,
  };
}

describe("buildWhatsAppMessage", () => {
  it("includes the current user under their own role alongside teammates, grouped by role", () => {
    const assignment = baseAssignment({
      teammates: [
        { userId: "a", displayName: "Alice", role: "Vocals" },
        { userId: "b", displayName: "Bob", role: "Vocals" },
      ],
    });

    const message = buildWhatsAppMessage(assignment, "Current User", "en");

    expect(message).toContain("Drummer: Current User");
    expect(message).toContain("Vocals: Alice, Bob");
    expect(message).toContain("*Date:*");
    expect(message).toContain("*Time:* 09:00");
    expect(message).toContain("*Service:* Sunday Worship");
    expect(message).toContain("Please arrive on time");
  });

  it("omits the songs and printing-link sections when there are no songs", () => {
    const message = buildWhatsAppMessage(baseAssignment(), "Current User", "en");

    expect(message).not.toContain("Worship Songs");
    expect(message).not.toContain("Printable Songs Link");
  });

  it("lists songs with an optional YouTube link line, and the printing link when present", () => {
    const assignment = baseAssignment({
      songs: [
        { id: "song-1", title: "Amazing Grace", youtubeLink: null, order: 1 },
        {
          id: "song-2",
          title: "How Great Thou Art",
          youtubeLink: "https://www.youtube.com/watch?v=abc",
          order: 2,
        },
      ],
      songsPrintingLink: "https://song.sjsmchinese.org/export-list-page?id=1",
    });

    const message = buildWhatsAppMessage(assignment, "Current User", "en");

    expect(message).toContain("1. Amazing Grace");
    expect(message).toContain("2. How Great Thou Art\n   🎥 https://www.youtube.com/watch?v=abc");
    expect(message).toContain(
      "📄 *Printable Songs Link:* https://song.sjsmchinese.org/export-list-page?id=1",
    );
  });

  it("renders the Chinese template with translated labels", () => {
    const message = buildWhatsAppMessage(baseAssignment(), "Current User", "zh");

    expect(message).toContain("📅 *服侍提醒*");
    expect(message).toContain("*时间：* 09:00");
    expect(message).toContain("Drummer: Current User");
    expect(message).toContain("请各位服侍人员准时到场");
  });
});
