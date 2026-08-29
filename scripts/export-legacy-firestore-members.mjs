import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Shapes one legacy Firestore `users` document into exactly the row shape
 * `scripts/bulk-provision-members.mjs` expects. Field names come from
 * docs/legacy-migration-spike.md's collection mapping, reverse-engineered
 * from the legacy application code.
 */
export function mapFirestoreUserDoc(data) {
  return {
    email: typeof data?.email === "string" ? data.email : null,
    displayName: typeof data?.displayName === "string" ? data.displayName : null,
    role: typeof data?.role === "string" ? data.role : null,
    primaryInstrument: typeof data?.primaryInstrument === "string" ? data.primaryInstrument : null,
    secondaryInstruments: Array.isArray(data?.secondaryInstruments)
      ? data.secondaryInstruments.filter((value) => typeof value === "string")
      : [],
  };
}

async function main() {
  const outputPath = resolve(process.argv[2] ?? "./legacy-members-export.json");
  const projectId = process.env.LEGACY_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error(
      "LEGACY_FIREBASE_PROJECT_ID is required - the OLD Firestore project id, not sjsm-smart-roster.",
    );
    process.exitCode = 1;
    return;
  }
  const collectionName = process.env.LEGACY_USERS_COLLECTION ?? "users";

  const { applicationDefault, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const app = initializeApp({ credential: applicationDefault(), projectId });
  const firestore = getFirestore(app);
  const snapshot = await firestore.collection(collectionName).get();

  const rows = snapshot.docs.map((doc) => mapFirestoreUserDoc(doc.data()));
  const missingEmailDocIds = snapshot.docs
    .filter((doc) => !mapFirestoreUserDoc(doc.data()).email)
    .map((doc) => doc.id);

  await writeFile(outputPath, JSON.stringify(rows, null, 2));

  console.log(`Exported ${rows.length} legacy member rows to ${outputPath}`);
  if (missingEmailDocIds.length > 0) {
    console.log(
      `  ${missingEmailDocIds.length} document(s) had no email field (by document id only): ${missingEmailDocIds.join(", ")}`,
    );
  }
  console.log(
    "This file contains personal data. Keep it outside git, CI, and any AI conversation - " +
      "it is only an input to `npm run provision:members`, run locally.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
