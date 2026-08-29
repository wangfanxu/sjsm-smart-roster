import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  classificationOutputSchema,
  classificationSystemPrompt,
  createGeminiIntentClassifier,
} from "./gemini-intent-classifier";

const referenceDate = "2026-09-01";

function fakeClient(text: string | undefined): GoogleGenAI {
  return {
    models: { generateContent: async () => ({ text }) },
  } as unknown as GoogleGenAI;
}

function throwingClient(): GoogleGenAI {
  return {
    models: {
      generateContent: async () => {
        throw new Error("network error");
      },
    },
  } as unknown as GoogleGenAI;
}

describe("classification contract", () => {
  it("only allows the allowlisted tools and a supported locale", () => {
    expect(() =>
      classificationOutputSchema.parse({
        tool: "get_my_next_assignment",
        locale: "en",
        resolvedDate: null,
      }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({
        tool: "prepare_mark_unavailable",
        locale: "en",
        resolvedDate: "2026-09-05",
      }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "unsupported_request", locale: "zh", resolvedDate: null }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "clarification_needed", locale: "en", resolvedDate: null }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "publish_roster", locale: "en", resolvedDate: null }),
    ).toThrow();
    expect(() =>
      classificationOutputSchema.parse({
        tool: "get_my_next_assignment",
        locale: "fr",
        resolvedDate: null,
      }),
    ).toThrow();
    expect(() =>
      classificationOutputSchema.parse({
        tool: "prepare_mark_unavailable",
        locale: "en",
        resolvedDate: "not-a-date",
      }),
    ).toThrow();
  });

  it("documents every allowlisted tool and today's reference date in the system prompt", () => {
    const prompt = classificationSystemPrompt(referenceDate);
    expect(prompt).toContain("get_my_next_assignment");
    expect(prompt).toContain("prepare_mark_unavailable");
    expect(prompt).toContain("clarification_needed");
    expect(prompt).toContain("unsupported_request");
    expect(prompt).toContain(referenceDate);
  });
});

describe("createGeminiIntentClassifier", () => {
  it("maps get_my_next_assignment to its assistant intent", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "get_my_next_assignment", locale: "en", resolvedDate: null })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("when do I serve next?", referenceDate)).resolves.toEqual({
      intent: "get_my_next_assignment",
      locale: "en",
    });
  });

  it("maps prepare_mark_unavailable to a resolved service date", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(
        JSON.stringify({ tool: "prepare_mark_unavailable", locale: "en", resolvedDate: "2026-09-05" }),
      ),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("I can't serve on September 5", referenceDate)).resolves.toEqual({
      intent: "prepare_mark_unavailable",
      locale: "en",
      serviceDate: "2026-09-05",
    });
  });

  it("passes through a null resolvedDate for prepare_mark_unavailable when the date is unclear", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "prepare_mark_unavailable", locale: "en", resolvedDate: null })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("I can't serve sometime", referenceDate)).resolves.toEqual({
      intent: "prepare_mark_unavailable",
      locale: "en",
      serviceDate: null,
    });
  });

  it("maps clarification_needed to an ambiguous intent, preserving locale", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "clarification_needed", locale: "zh", resolvedDate: null })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("嗯？", referenceDate)).resolves.toEqual({
      intent: "ambiguous",
      locale: "zh",
    });
  });

  it("maps unsupported_request to an unsupported intent", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "unsupported_request", locale: "en", resolvedDate: null })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("publish the roster", referenceDate)).resolves.toEqual({
      intent: "unsupported",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when the response has no text", async () => {
    const classifier = createGeminiIntentClassifier(fakeClient(undefined), "gemini-3.1-flash-lite");
    await expect(classifier.classify("???", referenceDate)).resolves.toEqual({
      intent: "ambiguous",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when the response is not valid JSON", async () => {
    const classifier = createGeminiIntentClassifier(fakeClient("not json"), "gemini-3.1-flash-lite");
    await expect(classifier.classify("???", referenceDate)).resolves.toEqual({
      intent: "ambiguous",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when the response fails schema validation", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "delete_everything", locale: "en", resolvedDate: null })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("???", referenceDate)).resolves.toEqual({
      intent: "ambiguous",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when the API call throws", async () => {
    const classifier = createGeminiIntentClassifier(throwingClient(), "gemini-3.1-flash-lite");
    await expect(classifier.classify("anything", referenceDate)).resolves.toEqual({
      intent: "ambiguous",
      locale: "en",
    });
  });
});
