"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import {
  createPlanningPeriod,
  createService,
  deletePlanningPeriod,
  listPlanningPeriods,
  listRoles,
  updatePlanningPeriod,
} from "../api";
import { ConfirmDialog } from "../confirm-dialog";
import { extractValidationFieldPaths, resolveApiErrorMessage } from "../errors";
import { formatDate, saturdaysBetween, toSingaporeIsoString } from "../format";
import { getAdminMessages, type AdminMessages } from "../messages";
import {
  emptyRequirementRow,
  nextRequirementRowKey,
  requirementsFieldError,
  requirementsPayload,
  RoleRequirementsEditor,
  type RequirementRow,
} from "../role-requirements-editor";
import styles from "../admin.module.css";
import type { PlanningPeriod, Role } from "../types";

type LoadState = "loading" | "ready" | "error";

type ServiceType = "eveningPrayer" | "communion";

const serviceTypeDefaultTime: Record<ServiceType, string> = {
  eveningPrayer: "15:00",
  communion: "15:30",
};

function serviceTypeTitle(type: ServiceType, messages: AdminMessages): string {
  return type === "communion" ? messages.serviceTypeCommunion : messages.serviceTypeEveningPrayer;
}

export default function PlanningPeriodsPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getAdminMessages(locale);
  const { idToken } = useAuth();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [periods, setPeriods] = useState<PlanningPeriod[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [templateRows, setTemplateRows] = useState<RequirementRow[]>([emptyRequirementRow()]);
  const [saturdayTypes, setSaturdayTypes] = useState<Record<string, ServiceType>>({});
  const saturdays = useMemo(() => saturdaysBetween(startsOn, endsOn), [startsOn, endsOn]);

  function saturdayType(date: string): ServiceType {
    return saturdayTypes[date] ?? "eveningPrayer";
  }

  const loadPeriods = useCallback(async () => {
    if (!idToken) return;
    try {
      const [periodsResponse, rolesResponse] = await Promise.all([
        listPlanningPeriods(idToken),
        listRoles(idToken),
      ]);
      setPeriods([...periodsResponse.planningPeriods]);
      setRoles([...rolesResponse.roles]);
      setTemplateRows(
        rolesResponse.roles.length > 0
          ? rolesResponse.roles.map((role) => ({
              key: nextRequirementRowKey(),
              roleId: role.id,
              requiredCount: "1",
            }))
          : [emptyRequirementRow()],
      );
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
    if (templateRows.some((row) => row.roleId)) {
      const requirementsError = requirementsFieldError(templateRows, messages);
      if (requirementsError) errors.requirements = requirementsError;
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
      setPeriods((previous) => [...previous, planningPeriod]);

      const populatedTemplate = requirementsPayload(templateRows);
      if (populatedTemplate.length > 0 && saturdays.length > 0) {
        for (const date of saturdays) {
          const type = saturdayType(date);
          const startsAt = toSingaporeIsoString(date, serviceTypeDefaultTime[type]);
          if (!startsAt) continue;
          await createService(idToken, planningPeriod.id, {
            title: serviceTypeTitle(type, messages),
            startsAt,
            requirements: populatedTemplate,
          });
        }
      }

      setName("");
      setStartsOn("");
      setEndsOn("");
      setTemplateRows([emptyRequirementRow()]);
      setSaturdayTypes({});
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

  // --- Edit / delete planning period ---
  const [periodActionError, setPeriodActionError] = useState<string | null>(null);
  const [editPeriodTarget, setEditPeriodTarget] = useState<PlanningPeriod | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartsOn, setEditStartsOn] = useState("");
  const [editEndsOn, setEditEndsOn] = useState("");
  const [editPeriodFieldErrors, setEditPeriodFieldErrors] = useState<Record<string, string>>({});
  const [editPeriodFormError, setEditPeriodFormError] = useState<string | null>(null);
  const [savingPeriodEdit, setSavingPeriodEdit] = useState(false);

  const [deletePeriodTarget, setDeletePeriodTarget] = useState<PlanningPeriod | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  function openEditPeriodDialog(period: PlanningPeriod) {
    setPeriodActionError(null);
    setEditPeriodTarget(period);
    setEditName(period.name);
    setEditStartsOn(period.startsOn);
    setEditEndsOn(period.endsOn);
    setEditPeriodFieldErrors({});
    setEditPeriodFormError(null);
  }

  function closeEditPeriodDialog() {
    setEditPeriodTarget(null);
  }

  async function handleEditPeriodSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken || !editPeriodTarget) return;
    setEditPeriodFormError(null);

    const errors: Record<string, string> = {};
    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length > 120) errors.name = messages.nameRequired;
    if (!editStartsOn || !editEndsOn) {
      errors.dates = messages.datesRequired;
    } else if (editStartsOn > editEndsOn) {
      errors.endsOn = messages.endsBeforeStarts;
    }
    setEditPeriodFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPeriodEdit(true);
    try {
      const { planningPeriod } = await updatePlanningPeriod(idToken, editPeriodTarget.id, {
        name: trimmedName,
        startsOn: editStartsOn,
        endsOn: editEndsOn,
      });
      setPeriods((previous) =>
        previous.map((existing) => (existing.id === planningPeriod.id ? planningPeriod : existing)),
      );
      setEditPeriodTarget(null);
    } catch (error) {
      setEditPeriodFormError(resolveApiErrorMessage(error, messages));
    } finally {
      setSavingPeriodEdit(false);
    }
  }

  async function handleDeletePeriod() {
    if (!idToken || !deletePeriodTarget) return;
    setPeriodActionError(null);
    setDeletingPeriod(true);
    try {
      await deletePlanningPeriod(idToken, deletePeriodTarget.id);
      setPeriods((previous) => previous.filter((period) => period.id !== deletePeriodTarget.id));
      setDeletePeriodTarget(null);
    } catch (error) {
      setPeriodActionError(resolveApiErrorMessage(error, messages));
      setDeletePeriodTarget(null);
    } finally {
      setDeletingPeriod(false);
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

        {periodActionError ? (
          <div className={styles.errorBanner} role="alert">
            <p>{periodActionError}</p>
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
                    <div className={styles.actionsRow}>
                      <Link className={styles.smallButton} href={`/${locale}/admin/periods/${period.id}`}>
                        {messages.openPeriod}
                      </Link>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => openEditPeriodDialog(period)}
                      >
                        {messages.editPeriodButton}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => setDeletePeriodTarget(period)}
                      >
                        {messages.deletePeriodButton}
                      </button>
                    </div>
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

          {saturdays.length > 0 ? (
            <div>
              <h3 className={styles.panelHeading}>{messages.weeklyGenerationHeading}</h3>
              <p className={styles.panelIntro}>{messages.weeklyGenerationIntro}</p>

              <RoleRequirementsEditor
                idPrefix="weekly-template"
                rows={templateRows}
                roles={roles}
                onChange={setTemplateRows}
                error={fieldErrors.requirements}
                heading={messages.requirementsHeading}
                hint={messages.weeklyTemplateHint}
                addLabel={messages.addRequirement}
                removeLabel={messages.removeRequirement}
                roleLabel={messages.fieldRole}
                countLabel={messages.fieldRequiredCount}
                selectPlaceholder={messages.selectRole}
              />

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{messages.weeklyDateColumn}</th>
                    <th>{messages.serviceTypeLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {saturdays.map((date) => (
                    <tr key={date}>
                      <td>{formatDate(date, locale)}</td>
                      <td>
                        <select
                          value={saturdayType(date)}
                          onChange={(event) =>
                            setSaturdayTypes((previous) => ({
                              ...previous,
                              [date]: event.target.value as ServiceType,
                            }))
                          }
                        >
                          <option value="eveningPrayer">{messages.serviceTypeEveningPrayer}</option>
                          <option value="communion">{messages.serviceTypeCommunion}</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

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

      {editPeriodTarget ? (
        <div className={styles.dialogOverlay} role="presentation" onClick={closeEditPeriodDialog}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-period-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-period-heading" className={styles.panelHeading}>
              {messages.editPeriodHeading}
            </h2>
            <form className={styles.form} onSubmit={(event) => void handleEditPeriodSubmit(event)}>
              <div className={styles.field}>
                <label htmlFor="edit-period-name">{messages.fieldName}</label>
                <input
                  id="edit-period-name"
                  type="text"
                  maxLength={120}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
                {editPeriodFieldErrors.name ? (
                  <p className={styles.fieldError}>{editPeriodFieldErrors.name}</p>
                ) : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="edit-period-starts-on">{messages.fieldStartsOn}</label>
                <input
                  id="edit-period-starts-on"
                  type="date"
                  value={editStartsOn}
                  onChange={(event) => setEditStartsOn(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="edit-period-ends-on">{messages.fieldEndsOn}</label>
                <input
                  id="edit-period-ends-on"
                  type="date"
                  value={editEndsOn}
                  onChange={(event) => setEditEndsOn(event.target.value)}
                />
                {editPeriodFieldErrors.endsOn ? (
                  <p className={styles.fieldError}>{editPeriodFieldErrors.endsOn}</p>
                ) : null}
                {editPeriodFieldErrors.dates ? (
                  <p className={styles.fieldError}>{editPeriodFieldErrors.dates}</p>
                ) : null}
              </div>

              {editPeriodFormError ? (
                <div className={styles.errorBanner} role="alert">
                  <p>{editPeriodFormError}</p>
                </div>
              ) : null}

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={savingPeriodEdit}>
                  {savingPeriodEdit ? messages.savingPeriodEdit : messages.editPeriodSubmit}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeEditPeriodDialog}
                  disabled={savingPeriodEdit}
                >
                  {messages.closeEditPeriodDialog}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletePeriodTarget ? (
        <ConfirmDialog
          title={messages.deletePeriodConfirmTitle}
          body={messages.deletePeriodConfirmBody}
          confirmLabel={messages.deletePeriodConfirmConfirm}
          cancelLabel={messages.deletePeriodConfirmCancel}
          busy={deletingPeriod}
          onConfirm={() => void handleDeletePeriod()}
          onCancel={() => setDeletePeriodTarget(null)}
        />
      ) : null}
    </div>
  );
}
