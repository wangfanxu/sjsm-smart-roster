"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";
import { ApiRequestError } from "@/lib/api-client";
import { createUser, listRoles, listUsers, updateMemberRoles } from "../api";
import { extractValidationFieldPaths, resolveApiErrorMessage } from "../errors";
import { getAdminMessages, formatMessage, type AdminMessages } from "../messages";
import styles from "../admin.module.css";
import type { MemberUser, Proficiency, Role, SystemRole } from "../types";

type LoadState = "loading" | "ready" | "error";
type RoleSelection = "none" | Proficiency;

function systemRoleLabel(systemRole: SystemRole, messages: AdminMessages): string {
  if (systemRole === "administrator") return messages.systemRoleAdministrator;
  if (systemRole === "team_leader") return messages.systemRoleTeamLeader;
  return messages.systemRoleVolunteer;
}

export default function MembersPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getAdminMessages(locale);
  const { idToken } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [systemRole, setSystemRole] = useState<SystemRole>("volunteer");
  const [inviteFieldErrors, setInviteFieldErrors] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, RoleSelection>>({});
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSuccess, setRolesSuccess] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  const loadData = useCallback(async () => {
    if (!idToken) return;
    try {
      const [usersResponse, rolesResponse] = await Promise.all([listUsers(idToken), listRoles(idToken)]);
      setMembers([...usersResponse.users]);
      setRoles([...rolesResponse.roles]);
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
    void loadData();
  }, [loadData]);

  function retryLoad() {
    setLoadState("loading");
    void loadData();
  }

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedUserId) ?? null,
    [members, selectedUserId],
  );

  function openRoleEditor(member: MemberUser) {
    setSelectedUserId(member.id);
    setRolesError(null);
    setRolesSuccess(false);
    const next: Record<string, RoleSelection> = {};
    for (const role of roles) {
      const existing = member.roles.find((capability) => capability.roleId === role.id);
      next[role.id] = existing ? existing.proficiency : "none";
    }
    setSelections(next);
  }

  function closeRoleEditor() {
    setSelectedUserId(null);
  }

  function validateInvite(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail || trimmedEmail.length > 255 || !trimmedEmail.includes("@")) {
      errors.email = messages.emailRequired;
    }
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 160) {
      errors.displayName = messages.memberDisplayNameRequired;
    }
    return errors;
  }

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken) return;
    setInviteError(null);
    setInviteSuccess(false);
    const errors = validateInvite();
    setInviteFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setInviting(true);
    try {
      const { user } = await createUser(idToken, {
        email: email.trim(),
        displayName: displayName.trim(),
        systemRole,
      });
      setMembers((previous) =>
        [...previous, { ...user, isActive: true, roles: [] }].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        ),
      );
      setEmail("");
      setDisplayName("");
      setSystemRole("volunteer");
      setInviteSuccess(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.payload.code === "email_already_registered") {
        setInviteFieldErrors({ email: messages.emailAlreadyRegistered });
      } else {
        const paths = extractValidationFieldPaths(error);
        if (paths.includes("displayName")) {
          setInviteFieldErrors({ displayName: messages.memberDisplayNameRequired });
        } else if (paths.includes("email")) {
          setInviteFieldErrors({ email: messages.emailRequired });
        } else {
          setInviteError(resolveApiErrorMessage(error, messages));
        }
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRolesSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idToken || !selectedMember) return;
    setRolesError(null);
    setRolesSuccess(false);
    setSavingRoles(true);
    try {
      const capabilities = roles
        .filter((role) => selections[role.id] && selections[role.id] !== "none")
        .map((role) => ({ roleId: role.id, proficiency: selections[role.id] as Proficiency }));
      await updateMemberRoles(idToken, selectedMember.id, capabilities);
      const updatedRoles = capabilities.map((capability) => ({
        roleId: capability.roleId,
        roleName: roles.find((role) => role.id === capability.roleId)?.name ?? "",
        proficiency: capability.proficiency,
      }));
      setMembers((previous) =>
        previous.map((member) => (member.id === selectedMember.id ? { ...member, roles: updatedRoles } : member)),
      );
      setRolesSuccess(true);
    } catch (error) {
      setRolesError(resolveApiErrorMessage(error, messages));
    } finally {
      setSavingRoles(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.panelHeading}>{messages.membersHeading}</h1>
        <p className={styles.panelIntro}>{messages.membersIntro}</p>

        {loadState === "loading" ? <p role="status">{messages.loading}</p> : null}

        {loadState === "error" ? (
          <div className={styles.errorBanner} role="alert">
            <p>{messages.membersLoadError}</p>
            <button type="button" className={styles.secondaryButton} onClick={retryLoad}>
              {messages.retry}
            </button>
          </div>
        ) : null}

        {loadState === "ready" && members.length === 0 ? (
          <p className={styles.emptyState}>{messages.membersEmpty}</p>
        ) : null}

        {loadState === "ready" && members.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{messages.memberColumnName}</th>
                <th>{messages.memberColumnEmail}</th>
                <th>{messages.memberColumnSystemRole}</th>
                <th>{messages.memberColumnStatus}</th>
                <th>{messages.memberColumnRoles}</th>
                <th>{messages.memberColumnActions}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.displayName}</td>
                  <td>{member.email}</td>
                  <td>{systemRoleLabel(member.systemRole, messages)}</td>
                  <td>
                    <span className={member.isActive ? styles.badgePublished : styles.badgeSuperseded}>
                      {member.isActive ? messages.memberActive : messages.memberInactive}
                    </span>
                  </td>
                  <td>
                    {member.roles.length === 0 ? (
                      <span className={styles.hint}>{messages.noRolesAssigned}</span>
                    ) : (
                      <div className={styles.roleBadgeList}>
                        {member.roles.map((capability) => (
                          <span key={capability.roleId} className={`${styles.badge} ${styles.badgeDraft}`}>
                            {capability.roleName}
                            {capability.proficiency === "primary"
                              ? ` (${messages.roleCapabilityPrimary})`
                              : ` (${messages.roleCapabilitySecondary})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <button type="button" className={styles.smallButton} onClick={() => openRoleEditor(member)}>
                      {messages.manageRolesButton}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      {selectedMember ? (
        <div className={styles.dialogOverlay} role="presentation" onClick={closeRoleEditor}>
          <div
            className={styles.dialogWide}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-roles-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="manage-roles-heading" className={styles.panelHeading}>
              {formatMessage(messages.manageRolesHeading, { name: selectedMember.displayName })}
            </h2>
            <p className={styles.panelIntro}>{messages.manageRolesIntro}</p>

            <form className={styles.form} onSubmit={(event) => void handleRolesSubmit(event)}>
              <div className={styles.fieldGrid}>
                {roles.map((role) => (
                  <div className={styles.field} key={role.id}>
                    <label htmlFor={`role-${role.id}`}>{role.name}</label>
                    <select
                      id={`role-${role.id}`}
                      value={selections[role.id] ?? "none"}
                      onChange={(event) =>
                        setSelections((previous) => ({
                          ...previous,
                          [role.id]: event.target.value as RoleSelection,
                        }))
                      }
                    >
                      <option value="none">{messages.roleCapabilityNone}</option>
                      <option value="primary">{messages.roleCapabilityPrimary}</option>
                      <option value="secondary">{messages.roleCapabilitySecondary}</option>
                    </select>
                  </div>
                ))}
              </div>

              {rolesError ? (
                <div className={styles.errorBanner} role="alert">
                  <p>{rolesError}</p>
                </div>
              ) : null}

              {rolesSuccess ? (
                <div className={styles.successBanner}>
                  <p>{messages.rolesUpdated}</p>
                </div>
              ) : null}

              <div className={styles.actionsRow}>
                <button type="submit" className={styles.primaryButton} disabled={savingRoles}>
                  {savingRoles ? messages.savingRoles : messages.saveRolesSubmit}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeRoleEditor}
                  disabled={savingRoles}
                >
                  {messages.closeRolesEditor}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelHeading}>{messages.inviteMemberHeading}</h2>
        <p className={styles.panelIntro}>{messages.inviteMemberIntro}</p>
        <form className={styles.form} onSubmit={(event) => void handleInviteSubmit(event)}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="member-email">{messages.fieldEmail}</label>
              <input
                id="member-email"
                type="email"
                maxLength={255}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {inviteFieldErrors.email ? <p className={styles.fieldError}>{inviteFieldErrors.email}</p> : null}
            </div>
            <div className={styles.field}>
              <label htmlFor="member-display-name">{messages.fieldDisplayName}</label>
              <input
                id="member-display-name"
                type="text"
                maxLength={160}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              {inviteFieldErrors.displayName ? (
                <p className={styles.fieldError}>{inviteFieldErrors.displayName}</p>
              ) : null}
            </div>
            <div className={styles.field}>
              <label htmlFor="member-system-role">{messages.fieldSystemRole}</label>
              <select
                id="member-system-role"
                value={systemRole}
                onChange={(event) => setSystemRole(event.target.value as SystemRole)}
              >
                <option value="volunteer">{messages.systemRoleVolunteer}</option>
                <option value="team_leader">{messages.systemRoleTeamLeader}</option>
                <option value="administrator">{messages.systemRoleAdministrator}</option>
              </select>
            </div>
          </div>

          {inviteError ? (
            <div className={styles.errorBanner} role="alert">
              <p>{inviteError}</p>
            </div>
          ) : null}

          {inviteSuccess ? (
            <div className={styles.successBanner}>
              <p>{messages.memberInvited}</p>
            </div>
          ) : null}

          <div className={styles.actionsRow}>
            <button type="submit" className={styles.primaryButton} disabled={inviting || !idToken}>
              {inviting ? messages.invitingMember : messages.inviteMemberSubmit}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
