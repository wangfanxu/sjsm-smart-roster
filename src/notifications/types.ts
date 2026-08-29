export type EmailMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
}>;

export type EmailSendResult = Readonly<{
  providerMessageId: string;
}>;

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
