import { GoogleGenAI } from "@google/genai";

const classificationResponseJsonSchema = {
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. This evaluation calls the real Gemini API and is intentionally excluded from `npm test`.",
    );
  }
}

async function classify(client, model, message) {
  const response = await client.models.generateContent({
    model,
    contents: message,
    config: {
      systemInstruction: classificationSystemPrompt,
      responseMimeType: "application/json",
      responseJsonSchema: classificationResponseJsonSchema,
    },
  });
  return response.text ? JSON.parse(response.text) : null;
}

async function main() {
  requireApiKey();
  const model = process.env.ASSISTANT_MODEL ?? "gemini-3.1-flash-lite";
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
