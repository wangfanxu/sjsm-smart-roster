import { describe, expect, it, vi } from "vitest";
import { createFirebaseTokenVerifier } from "./firebase-token-verifier";

describe("Firebase token verifier", () => {
  it("checks token revocation and returns only the verified UID and email, ignoring other claims", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: "firebase-verified",
      email: "verified@example.test",
      administrator: true,
    });
    const verifier = createFirebaseTokenVerifier({ verifyIdToken });

    await expect(verifier.verifyIdToken("firebase-token")).resolves.toEqual({
      uid: "firebase-verified",
      email: "verified@example.test",
    });
    expect(verifyIdToken).toHaveBeenCalledWith("firebase-token", true);
  });

  it("returns a null email when the token carries none", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: "firebase-verified" });
    const verifier = createFirebaseTokenVerifier({ verifyIdToken });

    await expect(verifier.verifyIdToken("firebase-token")).resolves.toEqual({
      uid: "firebase-verified",
      email: null,
    });
  });
});
