import { describe, expect, it, vi } from "vitest";
import { createResendEmailSender } from "./resend-email-sender";

function fakeFetch(response: Partial<Response> & { ok: boolean }) {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe("createResendEmailSender", () => {
  it("posts the message to Resend with the configured sender and API key", async () => {
    const fetchImpl = fakeFetch({
      ok: true,
      json: async () => ({ id: "resend-message-id" }),
    });
    const sender = createResendEmailSender({
      apiKey: "test-api-key",
      fromAddress: "notifications@example.test",
      fetchImpl,
    });

    const result = await sender.send({
      to: "volunteer@example.test",
      subject: "Your roster is published",
      text: "Details here",
    });

    expect(result).toEqual({ providerMessageId: "resend-message-id" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const [, requestInit] = vi.mocked(fetchImpl).mock.calls[0];
    expect(JSON.parse(requestInit!.body as string)).toEqual({
      from: "notifications@example.test",
      to: "volunteer@example.test",
      subject: "Your roster is published",
      text: "Details here",
    });
  });

  it("throws with the response body when Resend returns a non-2xx status", async () => {
    const fetchImpl = fakeFetch({
      ok: false,
      status: 422,
      text: async () => '{"message":"invalid recipient"}',
    });
    const sender = createResendEmailSender({
      apiKey: "test-api-key",
      fromAddress: "notifications@example.test",
      fetchImpl,
    });

    await expect(
      sender.send({ to: "bad-address", subject: "Subject", text: "Body" }),
    ).rejects.toThrow(/422/);
  });

  it("throws when Resend's response is missing a message id", async () => {
    const fetchImpl = fakeFetch({ ok: true, json: async () => ({}) });
    const sender = createResendEmailSender({
      apiKey: "test-api-key",
      fromAddress: "notifications@example.test",
      fetchImpl,
    });

    await expect(
      sender.send({ to: "volunteer@example.test", subject: "Subject", text: "Body" }),
    ).rejects.toThrow(/message id/);
  });
});
