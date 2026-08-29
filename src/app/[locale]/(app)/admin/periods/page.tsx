"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import { createPlanningPeriod, listPlanningPeriods } from "../api";
import { extractValidationFieldPaths, resolveApiErrorMessage } from "../errors";
import { formatDate } from "../format";
import { getAdminMessages } from "../messages";
import styles from "../admin.module.css";
import type { PlanningPeriod } from "../types";

type LoadState = "loading" | "ready" | "error";

export default function PlanningPeriodsPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getAdminMessages(locale);
  const { idToken } = useAuth();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [periods, setPeriods] = useState<PlanningPeriod[]>([]);

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPeriods = useCallback(async () => {
    if (!idToken) return;
    try {
      const response = await listPlanningPeriods(idToken);
      setPeriods([...response.planningPeriods]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [idToken]);

  useEffect(() => {
    // Client-side fetch gated on the Firebase ID token becoming available;
    // there is no server-rendered alternative for an administrator-only,
    // token-authenticated read, and this project intentionally avoids
    // adding a client data-fetching library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPeriods();
  }, [loadPeriods]);

  function retryLoadPeriods() {
    setLoadState("loading");
    void loadPeriods();
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) {
      errors.name = messages.nameRequired;
    }
    if (!startsOn || !endsOn) {
      errors.dates = messages.datesRequired;
    } else if (startsOn > endsOn) {
      errors.endsOn = messages.endsBeforeStarts;
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) return;
    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { planningPeriod } = await createPlanningPeriod(idToken, {
        name: name.trim(),
        startsOn,
        endsOn,
      });
      setName("");
      setStartsOn("");
      setEndsOn("");
      setPeriods((previous) => [...previous, planningPeriod]);
      router.push(`/${locale}/admin/periods/${planningPeriod.id}`);
    } catch (error) {
      const paths = extractValidationFieldPaths(error);
      if (paths.includes("endsOn")) {
        setFieldErrors({ endsOn: messages.endsBeforeStarts });
      } else if (paths.length > 0) {
        setFieldErrors({ name: messages.nameRequired });
      } else {
        setFormError(resolveApiErrorMessage(error, messages));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.panelHeading}>{messages.periodsHeading}</h1>
        <p className={styles.panelIntro}>{messages.periodsIntro}</p>

        {loadState === "loading" ? <p role="status">{messages.loading}</p> : null}

        {loadState === "error" ? (
          <div className={styles.errorBanner} role="alert">
            <p>{messages.periodsLoadError}</p>
            <button type="button" className={styles.secondaryButton} onClick={retryLoadPeriods}>
              {messages.retry}
            </button>
          </div>
        ) : null}

        {loadState === "ready" && periods.length === 0 ? (
          <p className={styles.emptyState}>{messages.periodsEmpty}</p>
        ) : null}

        {loadState === "ready" && periods.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.periodColumnName}</th>
                <th>{messages.periodColumnDates}</th>
                <th>{messages.periodColumnActions}</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td>{period.name}</td>
                  <td>
                    {formatDate(period.startsOn, locale)} – {formatDate(period.endsOn, locale)}
                  </td>
                  <td>
                    <Link className={styles.smallButton} href={`/${locale}/admin/periods/${period.id}`}>
                      {messages.openPeriod}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.createPeriodHeading}</h2>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="period-name">{messages.fieldName}</label>
              <input
                id="period-name"
                type="text"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {fieldErrors.name ? <p className={styles.fieldError}>{fieldErrors.name}</p> : null}
            </div>
            <div className={styles.field}>
              <label htmlFor="period-starts-on">{messages.fieldStartsOn}</label>
              <input
                id="period-starts-on"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="period-ends-on">{messages.fieldEndsOn}</label>
              <input
                id="period-ends-on"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
              {fieldErrors.endsOn ? <p className={styles.fieldError}>{fieldErrors.endsOn}</p> : null}
              {fieldErrors.dates ? <p className={styles.fieldError}>{fieldErrors.dates}</p> : null}
            </div>
          </div>

          {formError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{formError}</p>
            </div>
          ) : null}

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryButton} disabled={submitting || !idToken}>
              {submitting ? messages.creatingPeriod : messages.createPeriodSubmit}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
