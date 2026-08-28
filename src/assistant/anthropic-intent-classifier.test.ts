import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  classificationOutputSchema,
  classificationSystemPrompt,
  createAnthropicIntentClassifier,
} from "./anthropic-intent-classifier";

function fakeClient(parse: () => Promise<{ parsed_output: unknown }>): Anthropic {
  return { messages: { parse } } as unknown as Anthropic;
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

describe("createAnthropicIntentClassifier", () => {
  it("maps each allowlisted tool to its assistant intent", async () => {
    const classifier = createAnthropicIntentClassifier(
      fakeClient(async () => ({ parsed_output: { tool: "get_my_next_assignment", locale: "en" } })),
      "claude-opus-5",
    );
    await expect(classifier.classify("when do I serve next?")).resolves.toEqual({
      intent: "get_my_next_assignment",
      locale: "en",
    });
  });

  it("maps clarification_needed to an ambiguous intent, preserving locale", async () => {
    const classifier = createAnthropicIntentClassifier(
      fakeClient(async () => ({ parsed_output: { tool: "clarification_needed", locale: "zh" } })),
      "claude-opus-5",
    );
    await expect(classifier.classify("嗯？")).resolves.toEqual({ intent: "ambiguous", locale: "zh" });
  });

  it("maps unsupported_request to an unsupported intent", async () => {
    const classifier = createAnthropicIntentClassifier(
      fakeClient(async () => ({ parsed_output: { tool: "unsupported_request", locale: "en" } })),
      "claude-opus-5",
    );
    await expect(classifier.classify("publish the roster")).resolves.toEqual({
      intent: "unsupported",
      locale: "en",
    });
  });

  it("falls back to a safe ambiguous English clarification when parsing fails", async () => {
    const classifier = createAnthropicIntentClassifier(
      fakeClient(async () => ({ parsed_output: null })),
      "claude-opus-5",
    );
    await expect(classifier.classify("???")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });

  it("falls back to a safe ambiguous English clarification when the API call throws", async () => {
    const classifier = createAnthropicIntentClassifier(
      {
        messages: {
          parse: async () => {
            throw new Error("network error");
          },
        },
      } as unknown as Anthropic,
      "claude-opus-5",
    );
    await expect(classifier.classify("anything")).resolves.toEqual({ intent: "ambiguous", locale: "en" });
  });
});
