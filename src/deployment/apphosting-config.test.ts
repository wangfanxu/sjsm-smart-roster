import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../apphosting.yaml", import.meta.url));

function variableBlock(config: string, variable: string): string {
  const pattern = new RegExp(`variable: ${variable}\\n([\\s\\S]*?)(?=\\n\\s*- variable:|$)`);
  const match = config.match(pattern);
  if (!match) throw new Error(`No env entry found for ${variable}`);
  return match[1];
}

describe("Firebase App Hosting configuration", () => {
  it("scales idle environments to zero and caps unexpected scale-out", async () => {
    const config = await readFile(configPath, "utf8");

    expect(config).toMatch(/^\s*minInstances:\s*0\s*$/m);
    expect(config).toMatch(/^\s*maxInstances:\s*3\s*$/m);
  });

  it("references the database credential as a runtime secret", async () => {
    const config = await readFile(configPath, "utf8");

    expect(config).toContain("variable: DATABASE_URL");
    expect(config).toContain("secret: sjsm-smart-roster-database-url");
    expect(config).not.toMatch(/DATABASE_URL:\s*postgres(?:ql)?:\/\//);
  });

  it("references the assistant's Gemini API key and confirmation signing key as runtime secrets", async () => {
    const config = await readFile(configPath, "utf8");

    expect(config).toContain("variable: GEMINI_API_KEY");
    expect(config).toContain("secret: sjsm-smart-roster-gemini-api-key");
    expect(config).toContain("variable: ASSISTANT_CONFIRMATION_SECRET");
    expect(config).toContain("secret: sjsm-smart-roster-assistant-confirmation-secret");
    expect(config).not.toMatch(/GEMINI_API_KEY:\s*\S+/);
    expect(config).not.toMatch(/ASSISTANT_CONFIRMATION_SECRET:\s*\S+/);
  });

  it("references the Resend API key as a runtime secret", async () => {
    const config = await readFile(configPath, "utf8");

    expect(config).toContain("variable: RESEND_API_KEY");
    expect(config).toContain("secret: sjsm-smart-roster-resend-api-key");
    expect(config).not.toMatch(/RESEND_API_KEY:\s*\S+/);
  });

  it("makes the Firebase Web SDK config available at build time, not only runtime", async () => {
    const config = await readFile(configPath, "utf8");

    for (const variable of [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ]) {
      const block = variableBlock(config, variable);
      expect(block, `${variable} must include BUILD availability`).toContain("BUILD");
    }
  });
});
