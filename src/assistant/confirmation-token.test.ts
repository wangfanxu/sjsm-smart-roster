import { describe, expect, it } from "vitest";
import { createConfirmationToken, verifyConfirmationToken } from "./confirmation-token";

const secret = "test-secret";
const now = new Date("2026-08-27T04:00:00Z");

describe("confirmation token", () => {
  it("round-trips a valid token", () => {
    const token = createConfirmationToken(
      { action: "mark_unavailable", userId: "volunteer-1", serviceDate: "2026-09-05", locale: "en" },
      secret,
      now,
    );

    expect(verifyConfirmationToken(token, secret, now)).toEqual({
      action: "mark_unavailable",
      userId: "volunteer-1",
      serviceDate: "2026-09-05",
      locale: "en",
      expiresAt: now.getTime() + 5 * 60 * 1000,
    });
  });

  it("rejects a token verified with the wrong secret", () => {
    const token = createConfirmationToken(
      { action: "mark_unavailable", userId: "volunteer-1", serviceDate: "2026-09-05", locale: "en" },
      secret,
      now,
    );

    expect(verifyConfirmationToken(token, "wrong-secret", now)).toBeNull();
  });

  it("rejects a token with a tampered payload", () => {
    const token = createConfirmationToken(
      { action: "mark_unavailable", userId: "volunteer-1", serviceDate: "2026-09-05", locale: "en" },
      secret,
      now,
    );
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        action: "mark_unavailable",
        userId: "attacker",
        serviceDate: "2026-09-05",
        locale: "en",
        expiresAt: now.getTime() + 5 * 60 * 1000,
      }),
      "utf8",
    ).toString("base64url");

    expect(verifyConfirmationToken(`${tamperedPayload}.${signature}`, secret, now)).toBeNull();
    expect(verifyConfirmationToken(`${payload}.notarealsignature`, secret, now)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyConfirmationToken("not-a-token", secret, now)).toBeNull();
    expect(verifyConfirmationToken("a.b.c", secret, now)).toBeNull();
    expect(verifyConfirmationToken("", secret, now)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createConfirmationToken(
      { action: "mark_unavailable", userId: "volunteer-1", serviceDate: "2026-09-05", locale: "en" },
      secret,
      now,
    );
    const justAfterExpiry = new Date(now.getTime() + 5 * 60 * 1000 + 1);

    expect(verifyConfirmationToken(token, secret, justAfterExpiry)).toBeNull();
  });

  it("accepts a token right up to its expiry instant", () => {
    const token = createConfirmationToken(
      { action: "mark_unavailable", userId: "volunteer-1", serviceDate: "2026-09-05", locale: "en" },
      secret,
      now,
    );
    const rightAtExpiry = new Date(now.getTime() + 5 * 60 * 1000);

    expect(verifyConfirmationToken(token, secret, rightAtExpiry)).not.toBeNull();
  });
});
