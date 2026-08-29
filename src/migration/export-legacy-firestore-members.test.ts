import { describe, expect, it } from "vitest";
// @ts-expect-error The executable export script is intentionally plain ESM.
import { mapFirestoreUserDoc } from "../../scripts/export-legacy-firestore-members.mjs";

describe("mapFirestoreUserDoc", () => {
  it("maps a well-formed legacy document", () => {
    expect(
      mapFirestoreUserDoc({
        email: "someone@example.test",
        displayName: "Someone",
        role: "worship-leader",
        primaryInstrument: "Drums",
        secondaryInstruments: ["Vocals", "Keys"],
      }),
    ).toEqual({
      email: "someone@example.test",
      displayName: "Someone",
      role: "worship-leader",
      primaryInstrument: "Drums",
      secondaryInstruments: ["Vocals", "Keys"],
    });
  });

  it("defaults missing or malformed fields instead of throwing", () => {
    expect(mapFirestoreUserDoc({})).toEqual({
      email: null,
      displayName: null,
      role: null,
      primaryInstrument: null,
      secondaryInstruments: [],
    });
    expect(mapFirestoreUserDoc({ secondaryInstruments: ["Vocals", 42, null] })).toEqual(
      expect.objectContaining({ secondaryInstruments: ["Vocals"] }),
    );
    expect(mapFirestoreUserDoc(undefined)).toEqual({
      email: null,
      displayName: null,
      role: null,
      primaryInstrument: null,
      secondaryInstruments: [],
    });
  });
});
