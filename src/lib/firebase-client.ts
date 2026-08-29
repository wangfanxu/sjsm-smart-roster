import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

function firebaseConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseAuth(): Auth {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig());
  return getAuth(app);
}

export function createGoogleAuthProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}
