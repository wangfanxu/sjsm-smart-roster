import type { Teammate } from "./types";

export type TeammateGroup = Readonly<{ role: string; names: ReadonlyArray<string> }>;

export function groupTeammatesByRole(teammates: ReadonlyArray<Teammate>): ReadonlyArray<TeammateGroup> {
  const namesByRole = new Map<string, string[]>();
  for (const teammate of teammates) {
    const names = namesByRole.get(teammate.role) ?? [];
    names.push(teammate.displayName);
    namesByRole.set(teammate.role, names);
  }
  return [...namesByRole.entries()].map(([role, names]) => ({ role, names }));
}
