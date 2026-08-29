import { GoogleGenAI } from "@google/genai";

const referenceDate = "2026-09-01";

const classificationResponseJsonSchema = {
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
      description:
        "Only set when tool is prepare_mark_unavailable. YYYY-MM-DD, or null if not confidently resolvable.",
    },
  },
  required: ["tool", "locale", "resolvedDate"],
  propertyOrdering: ["tool", "locale", "resolvedDate"],
};

function classificationSystemPrompt(today) {
  return `You classify a church volunteer's message to a scheduling assistant into exactly one allowlisted tool, and detect the message's language. Today's date is ${today} (YYYY-MM-DD, Asia/Singapore time).

Allowlisted tools:
- get_my_next_assignment: the volunteer is asking when, what, or where they serve next, or about their upcoming assignment.
- prepare_mark_unavailable: the volunteer is stating they cannot serve, or want to be marked unavailable, on some date. Resolve any relative date expression ("tomorrow", "next Sunday", "9月5日") into an absolute calendar date using today's date above, and set resolvedDate to that date in YYYY-MM-DD format. If you cannot confidently resolve a single specific date, set resolvedDate to null.
- clarification_needed: the message is about scheduling or assignments but is ambiguous or unclear which supported action it maps to.
- unsupported_request: the message is clearly outside this assistant's scope (unrelated small talk, changing someone else's schedule, publishing or editing a roster, or anything else not about the sender's own next assignment or availability).

Only ever choose one of these four tools. Never invent a new one.
Set resolvedDate to null unless the tool is prepare_mark_unavailable.
Set locale to "en" for English or "zh" for Chinese, based on the language the volunteer wrote in.`;
}

const cases = [
  {
    message: "When do I serve next?",
    expectedTool: "get_my_next_assignment",
    expectedLocale: "en",
  },
  {
    message: "What's my next assignment?",
    expectedTool: "get_my_next_assignment",
    expectedLocale: "en",
  },
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
  {
    message: "I can't serve on September 5",
    expectedTool: "prepare_mark_unavailable",
    expectedLocale: "en",
    expectedResolvedDate: "2026-09-05",
  },
  {
    message: "I won't be able to make it tomorrow",
    expectedTool: "prepare_mark_unavailable",
    expectedLocale: "en",
    expectedResolvedDate: "2026-09-02",
  },
  {
    message: "Mark me unavailable, I have something going on",
    expectedTool: "prepare_mark_unavailable",
    expectedLocale: "en",
    expectedResolvedDate: null,
  },
  {
    message: "我9月5日不能服侍",
    expectedTool: "prepare_mark_unavailable",
    expectedLocale: "zh",
    expectedResolvedDate: "2026-09-05",
  },
  {
    message: "我明天没办法服侍",
    expectedTool: "prepare_mark_unavailable",
    expectedLocale: "zh",
    expectedResolvedDate: "2026-09-02",
  },
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
      systemInstruction: classificationSystemPrompt(referenceDate),
      responseMimeType: "application/json",
      responseJsonSchema: classificationResponseJsonSchema,
    },
  });
  return response.text ? JSON.parse(response.text) : null;
}

function passed(testCase, actual) {
  if (actual?.tool !== testCase.expectedTool || actual?.locale !== testCase.expectedLocale) {
    return false;
  }
  if (testCase.expectedResolvedDate === undefined) return true;
  return (actual?.resolvedDate ?? null) === testCase.expectedResolvedDate;
}

async function main() {
  requireApiKey();
  const model = process.env.ASSISTANT_MODEL ?? "gemini-3.1-flash-lite";
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const results = [];
  for (const testCase of cases) {
    const actual = await classify(client, model, testCase.message);
    results.push({ ...testCase, actual, passed: passed(testCase, actual) });
  }

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    const expected = [result.expectedTool, result.expectedLocale, result.expectedResolvedDate]
      .filter((value) => value !== undefined)
      .join("/");
    const actual = result.actual
      ? [result.actual.tool, result.actual.locale, result.actual.resolvedDate]
          .filter((value) => value !== undefined)
          .join("/")
      : "null";
    console.log(`[${status}] "${result.message}" -> expected ${expected}, got ${actual}`);
  }

  const failureCount = results.filter((result) => !result.passed).length;
  console.log(`\n${results.length - failureCount}/${results.length} passed`);
  if (failureCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
