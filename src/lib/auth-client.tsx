"use client";

import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, ApiRequestError } from "./api-client";
import { createGoogleAuthProvider, getFirebaseAuth } from "./firebase-client";

export type SystemRole = "volunteer" | "team_leader" | "administrator";

export type AppProfile = Readonly<{
  id: string;
  email: string;
  displayName: string;
  systemRole: SystemRole;
}>;

export type AuthStatus = "loading" | "signed_out" | "not_registered" | "ready" | "error";

type AuthContextValue = Readonly<{
  status: AuthStatus;
  firebaseUser: User | null;
  idToken: string | null;
  profile: AppProfile | null;
  errorMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onIdTokenChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIdToken(null);
        setProfile(null);
        setStatus("signed_out");
        return;
      }
      try {
        const token = await user.getIdToken();
        setIdToken(token);
        const response = await apiFetch<{ user: AppProfile }>("/me", token);
        setProfile(response.user);
        setStatus("ready");
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 403) {
          setProfile(null);
          setStatus("not_registered");
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Unable to sign in");
        setStatus("error");
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setErrorMessage(null);
    try {
      await signInWithPopup(getFirebaseAuth(), createGoogleAuthProvider());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign-in failed");
      setStatus("error");
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, firebaseUser, idToken, profile, errorMessage, signInWithGoogle, signOut }),
    [status, firebaseUser, idToken, profile, errorMessage, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
