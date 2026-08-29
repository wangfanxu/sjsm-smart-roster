import type { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ClassificationResult, IntentClassifier } from "./types";

export const classificationOutputSchema = z.object({
  tool: z.enum([
    "get_my_next_assignment",
    "prepare_mark_unavailable",
    "unsupported_request",
    "clarification_needed",
  ]),
  locale: z.enum(["en", "zh"]),
  resolvedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const classificationResponseJsonSchema = {
  type: "object",
  properties: {
    tool: {
      type: "string",
      enum: [
        "get_my_next_assignment",
        "prepare_mark_unavailable",
        "unsupported_request",
        "clarification_needed",
      ],
    },
    locale: { type: "string", enum: ["en", "zh"] },
    resolvedDate: {
      type: ["string", "null"],
      description: "Only set when tool is prepare_mark_unavailable. YYYY-MM-DD, or null if not confidently resolvable.",
    },
  },
  required: ["tool", "locale", "resolvedDate"],
  propertyOrdering: ["tool", "locale", "resolvedDate"],
};

export function classificationSystemPrompt(referenceDate: string): string {
  return `You classify a church volunteer's message to a scheduling assistant into exactly one allowlisted tool, and detect the message's language. Today's date is ${referenceDate} (YYYY-MM-DD, Asia/Singapore time).

Allowlisted tools:
- get_my_next_assignment: the volunteer is asking when, what, or where they serve next, or about their upcoming assignment.
- prepare_mark_unavailable: the volunteer is stating they cannot serve, or want to be marked unavailable, on some date. Resolve any relative date expression ("tomorrow", "next Sunday", "9月5日") into an absolute calendar date using today's date above, and set resolvedDate to that date in YYYY-MM-DD format. If you cannot confidently resolve a single specific date, set resolvedDate to null.
- clarification_needed: the message is about scheduling or assignments but is ambiguous or unclear which supported action it maps to.
- unsupported_request: the message is clearly outside this assistant's scope (unrelated small talk, changing someone else's schedule, publishing or editing a roster, or anything else not about the sender's own next assignment or availability).

Only ever choose one of these four tools. Never invent a new one.
Set resolvedDate to null unless the tool is prepare_mark_unavailable.
Set locale to "en" for English or "zh" for Chinese, based on the language the volunteer wrote in.`;
}

/**
 * Any failure here (invalid JSON, safety block, rate limit, network error)
 * falls back to a safe ambiguous clarification rather than throwing, so an
 * LLM outage degrades the assistant to "please rephrase" instead of a 500.
 */
export function createGeminiIntentClassifier(client: GoogleGenAI, model: string): IntentClassifier {
  return {
    async classify(message: string, referenceDate: string): Promise<ClassificationResult> {
      try {
        const response = await client.models.generateContent({
          model,
          contents: message,
          config: {
            systemInstruction: classificationSystemPrompt(referenceDate),
            responseMimeType: "application/json",
            responseJsonSchema: classificationResponseJsonSchema,
          },
        });
        const text = response.text;
        if (!text) return { intent: "ambiguous", locale: "en" };
        const parsed = classificationOutputSchema.safeParse(JSON.parse(text));
        if (!parsed.success) return { intent: "ambiguous", locale: "en" };
        const { tool, locale, resolvedDate } = parsed.data;
        if (tool === "unsupported_request") return { intent: "unsupported", locale };
        if (tool === "clarification_needed") return { intent: "ambiguous", locale };
        if (tool === "prepare_mark_unavailable") {
          return { intent: "prepare_mark_unavailable", locale, serviceDate: resolvedDate };
        }
        return { intent: "get_my_next_assignment", locale };
      } catch {
        return { intent: "ambiguous", locale: "en" };
      }
    },
  };
}
