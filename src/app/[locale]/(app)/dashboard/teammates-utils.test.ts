import { describe, expect, it } from "vitest";
import { groupTeammatesByRole } from "./teammates-utils";

describe("groupTeammatesByRole", () => {
  it("groups multiple teammates under the same role, preserving order", () => {
    expect(
      groupTeammatesByRole([
        { userId: "a", displayName: "Alice", role: "Usher" },
        { userId: "b", displayName: "Bob", role: "Usher" },
        { userId: "c", displayName: "Carol", role: "Pianist" },
      ]),
    ).toEqual([
      { role: "Usher", names: ["Alice", "Bob"] },
      { role: "Pianist", names: ["Carol"] },
    ]);
  });

  it("returns an empty list for no teammates", () => {
    expect(groupTeammatesByRole([])).toEqual([]);
  });
});
