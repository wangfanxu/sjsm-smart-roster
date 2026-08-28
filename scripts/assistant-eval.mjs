import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const classificationOutputSchema = z.object({
  tool: z.enum(["get_my_next_assignment", "unsupported_request", "clarification_needed"]),
  locale: z.enum(["en", "zh"]),
});

const classificationSystemPrompt = `You classify a church volunteer's message to a scheduling assistant into exactly one allowlisted tool, and detect the message's language.

Allowlisted tools:
- get_my_next_assignment: the volunteer is asking when, what, or where they serve next, or about their upcoming assignment.
- clarification_needed: the message is about scheduling or assignments but is ambiguous or unclear which supported action it maps to.
- unsupported_request: the message is clearly outside this assistant's scope (unrelated small talk, changing someone else's schedule, publishing or editing a roster, or anything else not about the sender's own next assignment).

Only ever choose one of these three tools. Never invent a new one.
Set locale to "en" for English or "zh" for Chinese, based on the language the volunteer wrote in.`;

const cases = [
  { message: "When do I serve next?", expectedTool: "get_my_next_assignment", expectedLocale: "en" },
  { message: "What's my next assignment?", expectedTool: "get_my_next_assignment", expectedLocale: "en" },
  { message: "hmm", expectedTool: "clarification_needed", expectedLocale: "en" },
  {
    message: "Can you publish the roster for September?",
    expectedTool: "unsupported_request",
    expectedLocale: "en",
  },
  { message: "我下次什么时候服侍？", expectedTool: "get_my_next_assignment", expectedLocale: "zh" },
  { message: "我的下一个安排是什么？", expectedTool: "get_my_next_assignment", expectedLocale: "zh" },
  { message: "嗯？", expectedTool: "clarification_needed", expectedLocale: "zh" },
  { message: "帮我发布九月的排班表", expectedTool: "unsupported_request", expectedLocale: "zh" },
];

function requireApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. This evaluation calls the real Anthropic API and is intentionally excluded from `npm test`.",
    );
  }
}

async function classify(client, model, message) {
  const response = await client.messages.parse({
    model,
    max_tokens: 256,
    system: classificationSystemPrompt,
    messages: [{ role: "user", content: message }],
    output_config: { format: zodOutputFormat(classificationOutputSchema) },
  });
  return response.parsed_output;
}

async function main() {
  requireApiKey();
  const model = process.env.ASSISTANT_MODEL ?? "claude-opus-5";
  const client = new Anthropic();

  const results = [];
  for (const testCase of cases) {
    const parsed = await classify(client, model, testCase.message);
    const passed =
      parsed?.tool === testCase.expectedTool && parsed?.locale === testCase.expectedLocale;
    results.push({ ...testCase, actual: parsed, passed });
  }

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log(
      `[${status}] "${result.message}" -> expected ${result.expectedTool}/${result.expectedLocale}, got ${result.actual?.tool ?? "null"}/${result.actual?.locale ?? "null"}`,
    );
  }

  const failureCount = results.filter((result) => !result.passed).length;
  console.log(`\n${results.length - failureCount}/${results.length} passed`);
  if (failureCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
