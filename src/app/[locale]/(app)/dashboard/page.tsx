"use client";

import { useParams } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import { AssignmentsSection } from "./AssignmentsSection";
import { AvailabilitySection } from "./AvailabilitySection";
import styles from "./dashboard.module.css";
import { getDashboardMessages } from "./messages";

export default function DashboardPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getDashboardMessages(locale);
  const { status, profile, idToken } = useAuth();

  // The authenticated shell only renders this page once sign-in is ready, but
  // guard defensively in case that ever changes.
  if (status !== "ready" || !profile || !idToken) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{messages.pageTitle}</h1>
        <p>{messages.pageDescription}</p>
      </header>

      <AssignmentsSection idToken={idToken} locale={locale} />
      <AvailabilitySection idToken={idToken} locale={locale} />
    </div>
  );
}
