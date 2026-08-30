"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-client";
import { getProfileMessages, systemRoleLabel } from "./messages";
import styles from "./profile.module.css";
import type { MemberProfile, Proficiency, Role, RoleSelection } from "./types";

type LoadState = "loading" | "ready" | "error";

export default function ProfilePage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getProfileMessages(locale);
  const { status, idToken, firebaseUser } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [selections, setSelections] = useState<Record<string, RoleSelection>>({});
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSuccess, setRolesSuccess] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const [meResponse, rolesResponse] = await Promise.all([
        apiFetch<{ user: MemberProfile }>("/me", idToken),
        apiFetch<{ roles: Role[] }>("/roles", idToken),
      ]);
      setMember(meResponse.user);
      setDisplayName(meResponse.user.displayName);
      setRoles([...rolesResponse.roles]);
      const nextSelections: Record<string, RoleSelection> = {};
      for (const role of rolesResponse.roles) {
        const existing = meResponse.user.roles.find((capability) => capability.roleId === role.id);
        nextSelections[role.id] = existing ? existing.proficiency : "none";
      }
      setSelections(nextSelections);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [idToken]);

  useEffect(() => {
    // Client-side fetch gated on the Firebase ID token becoming available;
    // there is no server-rendered alternative for a token-authenticated
    // self-service read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function retryLoad() {
    setLoadState("loading");
    void load();
  }

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) return;
    setNameError(null);
    setNameSuccess(false);
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 160) {
      setNameError(messages.nameRequired);
      return;
    }
    setSavingName(true);
    try {
      const { user } = await apiFetch<{ user: { id: string; displayName: string } }>("/me", idToken, {
        method: "PATCH",
        body: JSON.stringify({ displayName: trimmed }),
      });
      setMember((previous) => (previous ? { ...previous, displayName: user.displayName } : previous));
      setNameSuccess(true);
    } catch {
      setNameError(messages.nameSaveError);
    } finally {
      setSavingName(false);
    }
  }

  async function handleRolesSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken || !member) return;
    setRolesError(null);
    setRolesSuccess(false);
    setSavingRoles(true);
    try {
      const capabilities = roles
        .filter((role) => selections[role.id] && selections[role.id] !== "none")
        .map((role) => ({ roleId: role.id, proficiency: selections[role.id] as Proficiency }));
      await apiFetch(`/users/${member.id}/roles`, idToken, {
        method: "PUT",
        body: JSON.stringify({ capabilities }),
      });
      const updatedRoles = capabilities.map((capability) => ({
        roleId: capability.roleId,
        roleName: roles.find((role) => role.id === capability.roleId)?.name ?? "",
        proficiency: capability.proficiency,
      }));
      setMember((previous) => (previous ? { ...previous, roles: updatedRoles } : previous));
      setRolesSuccess(true);
    } catch {
      setRolesError(messages.rolesSaveError);
    } finally {
      setSavingRoles(false);
    }
  }

  if (status !== "ready" || !idToken) return null;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{messages.pageTitle}</h1>
        <p>{messages.pageDescription}</p>
      </header>

      {loadState === "loading" ? <p className={styles.statusMessage}>{messages.loading}</p> : null}

      {loadState === "error" ? (
        <div className={styles.errorBox} role="alert">
          <span>{messages.loadError}</span>
          <button type="button" className={styles.retryButton} onClick={retryLoad}>
            {messages.retry}
          </button>
        </div>
      ) : null}

      {loadState === "ready" && member ? (
        <>
          <section className={styles.panel}>
            <div className={styles.identityRow}>
              {firebaseUser?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Google account photo, not worth configuring next/image remote patterns for
                <img
                  src={firebaseUser.photoURL}
                  alt=""
                  className={styles.avatar}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={styles.avatarFallback} aria-hidden="true">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className={styles.email}>{member.email}</p>
                <p className={styles.systemRole}>{systemRoleLabel(member.systemRole, messages)}</p>
              </div>
            </div>

            <form className={styles.form} onSubmit={(event) => void handleNameSubmit(event)}>
              <div className={styles.field}>
                <label htmlFor="profile-display-name">{messages.nameLabel}</label>
                <input
                  id="profile-display-name"
                  type="text"
                  maxLength={160}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>

              {nameError ? (
                <div className={styles.errorBox} role="alert">
                  <span>{nameError}</span>
                </div>
              ) : null}
              {nameSuccess ? <div className={styles.successBanner}>{messages.nameSaved}</div> : null}

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={savingName}>
                  {savingName ? messages.saving : messages.saveName}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>{messages.rolesTitle}</h2>
            <p className={styles.panelDescription}>{messages.rolesDescription}</p>

            {roles.length === 0 ? (
              <p className={styles.emptyState}>{messages.rolesEmpty}</p>
            ) : (
              <form className={styles.form} onSubmit={(event) => void handleRolesSubmit(event)}>
                <div className={styles.fieldGrid}>
                  {roles.map((role) => (
                    <div className={styles.field} key={role.id}>
                      <label htmlFor={`profile-role-${role.id}`}>{role.name}</label>
                      <select
                        id={`profile-role-${role.id}`}
                        value={selections[role.id] ?? "none"}
                        onChange={(event) =>
                          setSelections((previous) => ({
                            ...previous,
                            [role.id]: event.target.value as RoleSelection,
                          }))
                        }
                      >
                        <option value="none">{messages.roleNone}</option>
                        <option value="primary">{messages.rolePrimary}</option>
                        <option value="secondary">{messages.roleSecondary}</option>
                      </select>
                    </div>
                  ))}
                </div>

                {rolesError ? (
                  <div className={styles.errorBox} role="alert">
                    <span>{rolesError}</span>
                  </div>
                ) : null}
                {rolesSuccess ? <div className={styles.successBanner}>{messages.rolesSaved}</div> : null}

                <div className={styles.actionsRow}>
                  <button type="submit" className={styles.primaryButton} disabled={savingRoles}>
                    {savingRoles ? messages.saving : messages.saveRoles}
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
