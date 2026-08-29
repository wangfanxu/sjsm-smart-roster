import type { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ClassificationResult, IntentClassifier } from "./types";

export const classificationOutputSchema = z.object({
  tool: z.enum(["get_my_next_assignment", "unsupported_request", "clarification_needed"]),
  locale: z.enum(["en", "zh"]),
});

export const classificationResponseJsonSchema = {
  type: "object",
  properties: {
    tool: {
      type: "string",
      enum: ["get_my_next_assignment", "unsupported_request", "clarification_needed"],
    },
    locale: { type: "string", enum: ["en", "zh"] },
  },
  required: ["tool", "locale"],
  propertyOrdering: ["tool", "locale"],
};

export const classificationSystemPrompt = `You classify a church volunteer's message to a scheduling assistant into exactly one allowlisted tool, and detect the message's language.

Allowlisted tools:
- get_my_next_assignment: the volunteer is asking when, what, or where they serve next, or about their upcoming assignment.
- clarification_needed: the message is about scheduling or assignments but is ambiguous or unclear which supported action it maps to.
- unsupported_request: the message is clearly outside this assistant's scope (unrelated small talk, changing someone else's schedule, publishing or editing a roster, or anything else not about the sender's own next assignment).

Only ever choose one of these three tools. Never invent a new one.
Set locale to "en" for English or "zh" for Chinese, based on the language the volunteer wrote in.`;

/**
 * Any failure here (invalid JSON, safety block, rate limit, network error)
 * falls back to a safe ambiguous clarification rather than throwing, so an
 * LLM outage degrades the assistant to "please rephrase" instead of a 500.
 */
export function createGeminiIntentClassifier(client: GoogleGenAI, model: string): IntentClassifier {
  return {
    async classify(message: string): Promise<ClassificationResult> {
      try {
        const response = await client.models.generateContent({
          model,
          contents: message,
          config: {
            systemInstruction: classificationSystemPrompt,
            responseMimeType: "application/json",
            responseJsonSchema: classificationResponseJsonSchema,
          },
        });
        const text = response.text;
        if (!text) return { intent: "ambiguous", locale: "en" };
        const parsed = classificationOutputSchema.safeParse(JSON.parse(text));
        if (!parsed.success) return { intent: "ambiguous", locale: "en" };
        if (parsed.data.tool === "unsupported_request") {
          return { intent: "unsupported", locale: parsed.data.locale };
        }
        if (parsed.data.tool === "clarification_needed") {
          return { intent: "ambiguous", locale: parsed.data.locale };
        }
        return { intent: "get_my_next_assignment", locale: parsed.data.locale };
      } catch {
        return { intent: "ambiguous", locale: "en" };
      }
    },
  };
}
