"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";

export function SignInPanel({ locale }: Readonly<{ locale: Locale }>) {
  const { status, errorMessage, profile, signInWithGoogle, signOut } = useAuth();
  const messages = getMessages(locale);
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") {
      router.replace(`/${locale}/dashboard`);
    }
  }, [status, locale, router]);

  if (status === "loading" || status === "ready") {
    return (
      <div className="sign-in-panel" role="status">
        <p>{messages.loading}</p>
      </div>
    );
  }

  if (status === "not_registered") {
    return (
      <div className="sign-in-panel">
        <h2>{messages.notRegisteredTitle}</h2>
        <p>{messages.notRegisteredDescription}</p>
        {profile ? null : (
          <button type="button" className="sign-in-button" onClick={() => void signOut()}>
            {messages.signOut}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sign-in-panel">
      <h2>{messages.signInTitle}</h2>
      <p>{messages.signInDescription}</p>
      <button type="button" className="sign-in-button" onClick={() => void signInWithGoogle()}>
        {messages.signInButton}
      </button>
      {status === "error" && errorMessage ? (
        <p className="sign-in-error" role="alert">
          {messages.signInError}
        </p>
      ) : null}
    </div>
  );
}
