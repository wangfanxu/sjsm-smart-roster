import { apiFetch } from "@/lib/api-client";
import type {
  CandidateDetail,
  CandidateSummary,
  GenerateCandidateResult,
  GenerationWeights,
  PlanningPeriod,
  Role,
  Service,
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

export function publishCandidate(
  idToken: string,
  periodId: string,
  candidateId: string,
): Promise<{ candidate: CandidateSummary }> {
  return apiFetch(`/planning-periods/${periodId}/candidates/${candidateId}/publish`, idToken, {
    method: "POST",
  });
}
