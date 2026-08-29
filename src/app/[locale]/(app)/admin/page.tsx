"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminMessages } from "./messages";
import styles from "./admin.module.css";

export default function AdminPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getAdminMessages(locale);

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.panelHeading}>{messages.hubHeading}</h1>
        <p className={styles.panelIntro}>{messages.hubIntro}</p>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.hubPeriodsTitle}</h2>
        <p className={styles.panelIntro}>{messages.hubPeriodsDescription}</p>
        <div className={styles.actionsRow}>
          <Link className={styles.primaryButton} href={`/${locale}/admin/periods`}>
            {messages.hubPeriodsLink}
          </Link>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.hubMembersTitle}</h2>
        <p className={styles.panelIntro}>{messages.hubMembersDescription}</p>
        <div className={styles.actionsRow}>
          <Link className={styles.primaryButton} href={`/${locale}/admin/members`}>
            {messages.hubMembersLink}
          </Link>
        </div>
      </section>
    </div>
  );
}
