import { GoogleGenAI } from "@google/genai";
import { createGeminiIntentClassifier } from "@/assistant/gemini-intent-classifier";
import { AssistantService } from "@/assistant/assistant-service";
import type { AuthDependencies } from "@/auth/authorize";
import { getServerAuthDependencies } from "@/auth/server";
import { getDatabaseConnection } from "@/db/client";
import { createDomainRepository } from "@/db/domain-repository";
import { SmartRosterService } from "@/domain/smart-roster-service";

export type ApiDependencies = Readonly<{
  auth: AuthDependencies;
  service: SmartRosterService;
  assistant: AssistantService;
}>;

let apiDependencies: ApiDependencies | undefined;

export function getServerApiDependencies(): ApiDependencies {
  if (!apiDependencies) {
    const { db } = getDatabaseConnection();
    const service = new SmartRosterService(createDomainRepository(db));
    const classifier = createGeminiIntentClassifier(
      new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
      process.env.ASSISTANT_MODEL ?? "gemini-3.1-flash-lite",
    );
    apiDependencies = {
      auth: getServerAuthDependencies(),
      service,
      assistant: new AssistantService(classifier, service),
    };
  }
  return apiDependencies;
}
