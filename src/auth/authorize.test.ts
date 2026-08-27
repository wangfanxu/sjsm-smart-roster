import { describe, expect, it, vi } from "vitest";
import { authenticateRequest, authorizeRequest, type AuthDependencies } from "./authorize";
import { AuthError } from "./errors";
import type { ApplicationUser, SystemRole } from "./types";

function createUser(overrides: Partial<ApplicationUser> = {}): ApplicationUser {
  return {
    id: "user-current",
    firebaseUid: "firebase-current",
    email: "current@example.test",
    displayName: "Current User",
    systemRole: "volunteer",
    isActive: true,
    ...overrides,
  };
}

function createDependencies(options: {
  user?: ApplicationUser | null;
  role?: SystemRole;
  tokenError?: Error;
} = {}) {
  const user =
    options.user === undefined
      ? createUser(options.role ? { systemRole: options.role } : {})
      : options.user;
  const verifyIdToken = options.tokenError
    ? vi.fn().mockRejectedValue(options.tokenError)
    : vi.fn().mockResolvedValue({ uid: "firebase-current" });
  const findByFirebaseUid = vi.fn().mockResolvedValue(user);

  return {
    dependencies: {
      tokenVerifier: { verifyIdToken },
      userRepository: { findByFirebaseUid },
    } satisfies AuthDependencies,
    findByFirebaseUid,
    verifyIdToken,
  };
}

function authenticatedRequest(url = "https://example.test/api/v1/me") {
  return new Request(url, { headers: { authorization: "Bearer valid-token" } });
}

describe("server authentication", () => {
  it("rejects a missing or malformed bearer token", async () => {
    const { dependencies } = createDependencies();

    await expect(authenticateRequest(new Request("https://example.test"), dependencies)).rejects
      .toMatchObject({ code: "missing_token", status: 401 });
    await expect(
      authenticateRequest(
        new Request("https://example.test", { headers: { authorization: "Basic abc" } }),
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "missing_token", status: 401 });
  });

  it("normalizes expired, revoked, and invalid verifier failures", async () => {
    const { dependencies } = createDependencies({ tokenError: new Error("auth/id-token-expired") });

    await expect(authenticateRequest(authenticatedRequest(), dependencies)).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects valid Firebase identities that are unregistered or inactive", async () => {
    const missing = createDependencies({ user: null });
    const inactive = createDependencies({ user: createUser({ isActive: false }) });

    await expect(authenticateRequest(authenticatedRequest(), missing.dependencies)).rejects
      .toMatchObject({ code: "user_not_registered", status: 403 });
    await expect(authenticateRequest(authenticatedRequest(), inactive.dependencies)).rejects
      .toMatchObject({ code: "user_inactive", status: 403 });
  });

  it("derives identity only from the verified token, ignoring client user IDs", async () => {
    const { dependencies, findByFirebaseUid, verifyIdToken } = createDependencies();
    const request = authenticatedRequest(
      "https://example.test/api/v1/me?userId=user-attacker-supplied",
    );

    const principal = await authenticateRequest(request, dependencies);

    expect(verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(findByFirebaseUid).toHaveBeenCalledWith("firebase-current");
    expect(principal.userId).toBe("user-current");
  });
});

describe("server authorization", () => {
  it("rejects a volunteer from an administrator capability", async () => {
    const { dependencies } = createDependencies({ role: "volunteer" });

    await expect(
      authorizeRequest(authenticatedRequest(), "roster:publish", dependencies),
    ).rejects.toMatchObject({ code: "permission_denied", status: 403 });
  });

  it("allows an administrator capability after authentication", async () => {
    const { dependencies } = createDependencies({ role: "administrator" });

    await expect(
      authorizeRequest(authenticatedRequest(), "roster:publish", dependencies),
    ).resolves.toMatchObject({ userId: "user-current", systemRole: "administrator" });
  });

  it("uses typed authentication errors", () => {
    expect(new AuthError("permission_denied", 403, "Denied")).toMatchObject({
      code: "permission_denied",
      status: 403,
    });
  });
});
