import { describe, expect, it, vi } from "vitest";
import { createFirebaseTokenVerifier } from "./firebase-token-verifier";

describe("Firebase token verifier", () => {
  it("checks token revocation and returns only the verified UID", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: "firebase-verified",
      email: "untrusted-for-authorization@example.test",
      administrator: true,
    });
    const verifier = createFirebaseTokenVerifier({ verifyIdToken });

    await expect(verifier.verifyIdToken("firebase-token")).resolves.toEqual({
      uid: "firebase-verified",
    });
    expect(verifyIdToken).toHaveBeenCalledWith("firebase-token", true);
  });
});
