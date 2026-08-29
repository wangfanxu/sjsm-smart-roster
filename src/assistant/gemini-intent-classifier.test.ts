import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  classificationOutputSchema,
  classificationSystemPrompt,
  createGeminiIntentClassifier,
} from "./gemini-intent-classifier";

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
      classificationOutputSchema.parse({ tool: "get_my_next_assignment", locale: "en" }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "unsupported_request", locale: "zh" }),
    ).not.toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "clarification_needed", locale: "en" }),
    ).not.toThrow();
    expect(() => classificationOutputSchema.parse({ tool: "publish_roster", locale: "en" })).toThrow();
    expect(() =>
      classificationOutputSchema.parse({ tool: "get_my_next_assignment", locale: "fr" }),
    ).toThrow();
  });

  it("documents every allowlisted tool in the system prompt", () => {
    expect(classificationSystemPrompt).toContain("get_my_next_assignment");
    expect(classificationSystemPrompt).toContain("clarification_needed");
    expect(classificationSystemPrompt).toContain("unsupported_request");
  });
});

describe("createGeminiIntentClassifier", () => {
  it("maps each allowlisted tool to its assistant intent", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "get_my_next_assignment", locale: "en" })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("when do I serve next?")).resolves.toEqual({
      intent: "get_my_next_assignment",
      locale: "en",
    });
  });

  it("maps clarification_needed to an ambiguous intent, preserving locale", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "clarification_needed", locale: "zh" })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("嗯？")).resolves.toEqual({ intent: "ambiguous", locale: "zh" });
  });

  it("maps unsupported_request to an unsupported intent", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "unsupported_request", locale: "en" })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("publish the roster")).resolves.toEqual({
      intent: "unsupported",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when the response has no text", async () => {
    const classifier = createGeminiIntentClassifier(fakeClient(undefined), "gemini-3.1-flash-lite");
    await expect(classifier.classify("???")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });

  it("falls back to a safe ambiguous English clarification when the response is not valid JSON", async () => {
    const classifier = createGeminiIntentClassifier(fakeClient("not json"), "gemini-3.1-flash-lite");
    await expect(classifier.classify("???")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });

  it("falls back to a safe ambiguous English clarification when the response fails schema validation", async () => {
    const classifier = createGeminiIntentClassifier(
      fakeClient(JSON.stringify({ tool: "delete_everything", locale: "en" })),
      "gemini-3.1-flash-lite",
    );
    await expect(classifier.classify("???")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });

  it("falls back to a safe ambiguous English clarification when the API call throws", async () => {
    const classifier = createGeminiIntentClassifier(throwingClient(), "gemini-3.1-flash-lite");
    await expect(classifier.classify("anything")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });
});
