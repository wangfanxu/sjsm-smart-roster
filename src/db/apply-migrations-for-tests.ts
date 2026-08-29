import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationDirectory = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function readAllMigrationsSql(): Promise<string> {
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const contents = await Promise.all(
    migrationFiles.map((file) => readFile(`${migrationDirectory}/${file}`, "utf8")),
  );
  return contents.join("\n");
}
