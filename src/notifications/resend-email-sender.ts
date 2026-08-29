import type { EmailMessage, EmailSendResult, EmailSender } from "./types";

export type ResendEmailSenderConfig = Readonly<{
  apiKey: string;
  fromAddress: string;
  fetchImpl?: typeof fetch;
}>;

export function createResendEmailSender(config: ResendEmailSenderConfig): EmailSender {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromAddress,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend request failed with status ${response.status}: ${body}`);
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new Error("Resend response did not include a message id");
      }
      return { providerMessageId: data.id };
    },
  };
}
