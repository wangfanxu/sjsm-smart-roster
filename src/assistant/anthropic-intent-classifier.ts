import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ClassificationResult, IntentClassifier } from "./types";

export const classificationOutputSchema = z.object({
  tool: z.enum(["get_my_next_assignment", "unsupported_request", "clarification_needed"]),
  locale: z.enum(["en", "zh"]),
});

export const classificationSystemPrompt = `You classify a church volunteer's message to a scheduling assistant into exactly one allowlisted tool, and detect the message's language.

Allowlisted tools:
- get_my_next_assignment: the volunteer is asking when, what, or where they serve next, or about their upcoming assignment.
- clarification_needed: the message is about scheduling or assignments but is ambiguous or unclear which supported action it maps to.
- unsupported_request: the message is clearly outside this assistant's scope (unrelated small talk, changing someone else's schedule, publishing or editing a roster, or anything else not about the sender's own next assignment).

Only ever choose one of these three tools. Never invent a new one.
Set locale to "en" for English or "zh" for Chinese, based on the language the volunteer wrote in.`;

/**
 * Any failure here (parse failure, rate limit, network error) falls back to
 * a safe ambiguous clarification rather than throwing, so an LLM outage
 * degrades the assistant to "please rephrase" instead of a 500.
 */
export function createAnthropicIntentClassifier(client: Anthropic, model: string): IntentClassifier {
  return {
    async classify(message: string): Promise<ClassificationResult> {
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: 256,
          system: classificationSystemPrompt,
          messages: [{ role: "user", content: message }],
          output_config: { format: zodOutputFormat(classificationOutputSchema) },
        });
        const parsed = response.parsed_output;
        if (!parsed) return { intent: "ambiguous", locale: "en" };
        if (parsed.tool === "unsupported_request") {
          return { intent: "unsupported", locale: parsed.locale };
        }
        if (parsed.tool === "clarification_needed") {
          return { intent: "ambiguous", locale: parsed.locale };
        }
        return { intent: "get_my_next_assignment", locale: parsed.locale };
      } catch {
        return { intent: "ambiguous", locale: "en" };
      }
    },
  };
}
