import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupportedLocale } from "./types";

const confirmationTtlMs = 5 * 60 * 1000;

const pendingMarkUnavailableSchema = z.object({
  action: z.literal("mark_unavailable"),
  userId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locale: z.enum(["en", "zh"]),
  expiresAt: z.number(),
});

export type PendingMarkUnavailable = Readonly<{
  action: "mark_unavailable";
  userId: string;
  serviceDate: string;
  locale: SupportedLocale;
  expiresAt: number;
}>;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function createConfirmationToken(
  pending: Omit<PendingMarkUnavailable, "expiresAt">,
  secret: string,
  now: Date,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...pending, expiresAt: now.getTime() + confirmationTtlMs }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyConfirmationToken(
  token: string,
  secret: string,
  now: Date,
): PendingMarkUnavailable | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!signaturesMatch(signature, sign(payload, secret))) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const result = pendingMarkUnavailableSchema.safeParse(parsed);
  if (!result.success) return null;
  if (now.getTime() > result.data.expiresAt) return null;
  return result.data;
}
