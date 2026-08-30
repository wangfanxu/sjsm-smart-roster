"use client";

import type { AdminMessages } from "./messages";
import styles from "./admin.module.css";
import type { Role } from "./types";

export type RequirementRow = Readonly<{ key: string; roleId: string; requiredCount: string }>;

let requirementRowKeySeed = 0;
export function nextRequirementRowKey(): string {
  requirementRowKeySeed += 1;
  return `requirement-${requirementRowKeySeed}`;
}

export function emptyRequirementRow(): RequirementRow {
  return { key: nextRequirementRowKey(), roleId: "", requiredCount: "1" };
}

export function requirementsFieldError(
  rows: ReadonlyArray<RequirementRow>,
  messages: AdminMessages,
): string | undefined {
  const seenRoles = new Set<string>();
  let duplicate = false;
  let outOfRange = false;
  for (const row of rows) {
    if (!row.roleId) continue;
    if (seenRoles.has(row.roleId)) duplicate = true;
    seenRoles.add(row.roleId);
    const count = Number(row.requiredCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) outOfRange = true;
  }
  const populatedRows = rows.filter((row) => row.roleId);
  if (populatedRows.length === 0) return messages.requirementsRequired;
  if (duplicate) return messages.duplicateRole;
  if (outOfRange) return messages.requiredCountRange;
  return undefined;
}

export function requirementsPayload(
  rows: ReadonlyArray<RequirementRow>,
): ReadonlyArray<{ roleId: string; requiredCount: number }> {
  return rows
    .filter((row) => row.roleId)
    .map((row) => ({ roleId: row.roleId, requiredCount: Number(row.requiredCount) }));
}

export function RoleRequirementsEditor({
  idPrefix,
  rows,
  roles,
  onChange,
  error,
  heading,
  hint,
  addLabel,
  removeLabel,
  roleLabel,
  countLabel,
  selectPlaceholder,
}: Readonly<{
  idPrefix: string;
  rows: ReadonlyArray<RequirementRow>;
  roles: ReadonlyArray<Role>;
  onChange: (rows: RequirementRow[]) => void;
  error?: string;
  heading: string;
  hint: string;
  addLabel: string;
  removeLabel: string;
  roleLabel: string;
  countLabel: string;
  selectPlaceholder: string;
}>) {
  function updateRow(key: string, patch: Partial<RequirementRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...rows, emptyRequirementRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.length > 1 ? rows.filter((row) => row.key !== key) : [...rows]);
  }

  return (
    <div>
      <h4 className={styles.panelHeading}>{heading}</h4>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.requirementsList}>
        {rows.map((row) => (
          <div className={styles.requirementRow} key={row.key}>
            <div className={styles.field}>
              <label htmlFor={`${idPrefix}-role-${row.key}`}>{roleLabel}</label>
              <select
                id={`${idPrefix}-role-${row.key}`}
                value={row.roleId}
                onChange={(event) => updateRow(row.key, { roleId: event.target.value })}
              >
                <option value="">{selectPlaceholder}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${idPrefix}-count-${row.key}`}>{countLabel}</label>
              <input
                id={`${idPrefix}-count-${row.key}`}
                type="number"
                min={1}
                max={20}
                value={row.requiredCount}
                onChange={(event) => updateRow(row.key, { requiredCount: event.target.value })}
              />
            </div>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => removeRow(row.key)}
              disabled={rows.length === 1}
            >
              {removeLabel}
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={styles.secondaryButton} onClick={addRow}>
        {addLabel}
      </button>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}
