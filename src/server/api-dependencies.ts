import { GoogleGenAI } from "@google/genai";
import { createGeminiIntentClassifier } from "@/assistant/gemini-intent-classifier";
import { AssistantService } from "@/assistant/assistant-service";
import type { AuthDependencies } from "@/auth/authorize";
import { getServerAuthDependencies } from "@/auth/server";
import { getDatabaseConnection } from "@/db/client";
import { createDomainRepository } from "@/db/domain-repository";
import { SmartRosterService } from "@/domain/smart-roster-service";
import { NotificationService } from "@/notifications/notification-service";
import { createResendEmailSender } from "@/notifications/resend-email-sender";

export type ApiDependencies = Readonly<{
  auth: AuthDependencies;
  service: SmartRosterService;
  assistant: AssistantService;
  notifications: NotificationService;
}>;

let apiDependencies: ApiDependencies | undefined;

export function getServerApiDependencies(): ApiDependencies {
  if (!apiDependencies) {
    const { db } = getDatabaseConnection();
    const repository = createDomainRepository(db);
    const service = new SmartRosterService(repository);
    const classifier = createGeminiIntentClassifier(
      new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
      process.env.ASSISTANT_MODEL ?? "gemini-3.1-flash-lite",
    );
    const emailSender = createResendEmailSender({
      apiKey: process.env.RESEND_API_KEY ?? "",
      fromAddress: process.env.NOTIFICATION_FROM_EMAIL ?? "notifications@sjsm-smart-roster.app",
    });
    apiDependencies = {
      auth: getServerAuthDependencies(),
      service,
      assistant: new AssistantService(
        classifier,
        service,
        process.env.ASSISTANT_CONFIRMATION_SECRET ?? "",
      ),
      notifications: new NotificationService(repository, emailSender),
    };
  }
  return apiDependencies;
}
