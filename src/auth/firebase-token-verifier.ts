import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import type { TokenVerifier } from "./types";

function getFirebaseAuth(): Auth {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: applicationDefault(),
          ...(process.env.FIREBASE_PROJECT_ID
            ? { projectId: process.env.FIREBASE_PROJECT_ID }
            : {}),
        });

  return getAuth(app);
}

export function createFirebaseTokenVerifier(
  firebaseAuth: Pick<Auth, "verifyIdToken"> = getFirebaseAuth(),
): TokenVerifier {
  return {
    async verifyIdToken(token) {
      const decodedToken = await firebaseAuth.verifyIdToken(token, true);
      return { uid: decodedToken.uid };
    },
  };
}
