import { apiFetch } from "@/lib/api-client";
import type {
  CandidateDetail,
  CandidateSummary,
  EligibleAssignee,
  GenerateCandidateResult,
  GenerationWeights,
  MemberUser,
  PlanningPeriod,
  Proficiency,
  Role,
  Service,
  SystemRole,
} from "./types";

export function listPlanningPeriods(idToken: string): Promise<{ planningPeriods: PlanningPeriod[] }> {
  return apiFetch("/planning-periods", idToken);
}

export function createPlanningPeriod(
  idToken: string,
  input: Readonly<{ name: string; startsOn: string; endsOn: string }>,
): Promise<{ planningPeriod: PlanningPeriod }> {
  return apiFetch("/planning-periods", idToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePlanningPeriod(
  idToken: string,
  periodId: string,
  input: Readonly<{ name: string; startsOn: string; endsOn: string }>,
): Promise<{ planningPeriod: PlanningPeriod }> {
  return apiFetch(`/planning-periods/${periodId}`, idToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePlanningPeriod(idToken: string, periodId: string): Promise<{ id: string }> {
  return apiFetch(`/planning-periods/${periodId}`, idToken, { method: "DELETE" });
}

export function listServices(idToken: string, periodId: string): Promise<{ services: Service[] }> {
  return apiFetch(`/planning-periods/${periodId}/services`, idToken);
}

export type ServiceRequirementInput = Readonly<{ roleId: string; requiredCount: number }>;

export function createService(
  idToken: string,
  periodId: string,
  input: Readonly<{
    title: string;
    startsAt: string;
    notes?: string | null;
    requirements: ReadonlyArray<ServiceRequirementInput>;
  }>,
): Promise<{ service: Service }> {
  return apiFetch(`/planning-periods/${periodId}/services`, idToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateService(
  idToken: string,
  periodId: string,
  serviceId: string,
  input: Readonly<{
    title: string;
    startsAt: string;
    notes?: string | null;
    requirements: ReadonlyArray<ServiceRequirementInput>;
  }>,
): Promise<{ service: Service }> {
  return apiFetch(`/planning-periods/${periodId}/services/${serviceId}`, idToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteService(
  idToken: string,
  periodId: string,
  serviceId: string,
): Promise<{ id: string }> {
  return apiFetch(`/planning-periods/${periodId}/services/${serviceId}`, idToken, {
    method: "DELETE",
  });
}

export function listRoles(idToken: string): Promise<{ roles: Role[] }> {
  return apiFetch("/roles", idToken);
}

export function listCandidates(
  idToken: string,
  periodId: string,
): Promise<{ candidates: CandidateSummary[] }> {
  return apiFetch(`/planning-periods/${periodId}/candidates`, idToken);
}

export function generateCandidate(
  idToken: string,
  periodId: string,
  weights?: GenerationWeights,
): Promise<GenerateCandidateResult> {
  return apiFetch(`/planning-periods/${periodId}/candidates`, idToken, {
    method: "POST",
    body: JSON.stringify({ weights }),
  });
}

export function getCandidateDetail(
  idToken: string,
  periodId: string,
  candidateId: string,
): Promise<CandidateDetail> {
  return apiFetch(`/planning-periods/${periodId}/candidates/${candidateId}`, idToken);
}

export function setAssignmentLock(
  idToken: string,
  periodId: string,
  candidateId: string,
  assignmentId: string,
  isLocked: boolean,
): Promise<{ id: string; isLocked: boolean }> {
  return apiFetch(
    `/planning-periods/${periodId}/candidates/${candidateId}/assignments/${assignmentId}`,
    idToken,
    { method: "PATCH", body: JSON.stringify({ isLocked }) },
  );
}

export function getEligibleAssignees(
  idToken: string,
  periodId: string,
  candidateId: string,
  assignmentId: string,
): Promise<{ eligibleUsers: EligibleAssignee[] }> {
  return apiFetch(
    `/planning-periods/${periodId}/candidates/${candidateId}/assignments/${assignmentId}/eligible-users`,
    idToken,
  );
}

export function reassignAssignment(
  idToken: string,
  periodId: string,
  candidateId: string,
  assignmentId: string,
  userId: string,
): Promise<{ id: string; userId: string; isLocked: boolean; source: "solver" | "manual" }> {
  return apiFetch(
    `/planning-periods/${periodId}/candidates/${candidateId}/assignments/${assignmentId}`,
    idToken,
    { method: "PATCH", body: JSON.stringify({ userId }) },
  );
}

export function regenerateCandidate(
  idToken: string,
  periodId: string,
  candidateId: string,
  weights?: GenerationWeights,
): Promise<GenerateCandidateResult> {
  return apiFetch(`/planning-periods/${periodId}/candidates/${candidateId}/regenerate`, idToken, {
    method: "POST",
    body: JSON.stringify({ weights }),
  });
}

export function listUsers(idToken: string): Promise<{ users: MemberUser[] }> {
  return apiFetch("/users", idToken);
}

export function createUser(
  idToken: string,
  input: Readonly<{ email: string; displayName: string; systemRole: SystemRole }>,
): Promise<{ user: Readonly<{ id: string; email: string; displayName: string; systemRole: SystemRole }> }> {
  return apiFetch("/users", idToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type MemberRoleCapabilityInput = Readonly<{ roleId: string; proficiency: Proficiency }>;

export function updateMemberRoles(
  idToken: string,
  userId: string,
  capabilities: ReadonlyArray<MemberRoleCapabilityInput>,
): Promise<{ memberRoles: ReadonlyArray<Readonly<{ userId: string; roleId: string; proficiency: Proficiency }>> }> {
  return apiFetch(`/users/${userId}/roles`, idToken, {
    method: "PUT",
    body: JSON.stringify({ capabilities }),
  });
}

export function publishCandidate(
  idToken: string,
  periodId: string,
  candidateId: string,
): Promise<{ candidate: CandidateSummary }> {
  return apiFetch(`/planning-periods/${periodId}/candidates/${candidateId}/publish`, idToken, {
    method: "POST",
  });
}
