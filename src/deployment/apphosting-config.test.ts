import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../apphosting.yaml", import.meta.url));

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
});
