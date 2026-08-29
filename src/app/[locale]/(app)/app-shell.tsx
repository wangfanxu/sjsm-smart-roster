"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";

function alternateLocalePath(pathname: string, locale: Locale): string {
  const alternateLocale: Locale = locale === "en" ? "zh" : "en";
  const segments = pathname.split("/");
  segments[1] = alternateLocale;
  return segments.join("/") || `/${alternateLocale}`;
}

export function AppShell({
  locale,
  children,
}: Readonly<{ locale: Locale; children: ReactNode }>) {
  const { status, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const messages = getMessages(locale);

  useEffect(() => {
    if (status === "signed_out" || status === "not_registered") {
      router.replace(`/${locale}`);
    }
  }, [status, locale, router]);

  if (status !== "ready" || !profile) {
    return (
      <div className="page-shell">
        <p>{messages.loading}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label={messages.languageNavigationLabel}>
        <div className="brand-mark" aria-label="SJSM SmartRoster">
          <span aria-hidden="true">S</span>
          <strong>SmartRoster</strong>
        </div>
        <div className="app-nav-links">
          <Link href={`/${locale}/dashboard`}>{messages.navDashboard}</Link>
          <Link href={`/${locale}/assistant`}>{messages.navAssistant}</Link>
          {profile.systemRole === "administrator" ? (
            <Link href={`/${locale}/admin`}>{messages.navAdmin}</Link>
          ) : null}
        </div>
        <div className="app-nav-actions">
          <Link className="language-link" href={alternateLocalePath(pathname, locale)}>
            {messages.switchLanguage}
          </Link>
          <button type="button" className="sign-in-button" onClick={() => void signOut()}>
            {messages.signOut}
          </button>
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}
