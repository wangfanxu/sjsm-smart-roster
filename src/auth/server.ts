import { createDatabase } from "@/db/client";
import { createUserRepository } from "@/db/user-repository";
import type { AuthDependencies } from "./authorize";
import { createFirebaseTokenVerifier } from "./firebase-token-verifier";

let authDependencies: AuthDependencies | undefined;

export function getServerAuthDependencies(): AuthDependencies {
  if (!authDependencies) {
    const { db } = createDatabase();
    authDependencies = {
      tokenVerifier: createFirebaseTokenVerifier(),
      userRepository: createUserRepository(db),
    };
  }

  return authDependencies;
}
