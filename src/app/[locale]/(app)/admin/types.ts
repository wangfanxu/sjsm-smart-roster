export type PlanningPeriod = Readonly<{
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type Role = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
}>;

export type Service = Readonly<{
  id: string;
  planningPeriodId: string;
  title: string;
  startsAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CandidateStatus = "draft" | "published" | "superseded";

export type UnfilledRole = Readonly<{
  serviceId: string;
  roleId: string;
  requiredCount: number;
  assignedCount: number;
  missingCount: number;
}>;

export type CandidateExplanation = Readonly<{
  coverage: Readonly<{
    totalRequired: number;
    totalAssigned: number;
    unfilledCount: number;
    coveragePercentage: number;
  }>;
  fairness: Readonly<{
    assignmentCountsByUser: Record<string, number>;
    minAssignments: number;
    maxAssignments: number;
    meanAssignments: number;
    spread: number;
  }>;
  primaryAssignments: number;
  preferredAssignments: number;
  unfilledRoles: ReadonlyArray<UnfilledRole>;
  infeasible: boolean;
}>;

export type CandidateSummary = Readonly<{
  id: string;
  planningPeriodId: string;
  version: number;
  status: CandidateStatus;
  hardConstraintsSatisfied: boolean;
  objectiveScore: string | null;
  configuration?: Record<string, unknown>;
  explanation: CandidateExplanation;
  generatedAt?: string;
}>;

export type AssignmentDetail = Readonly<{
  id: string;
  serviceId: string;
  serviceTitle: string;
  serviceStartsAt: string;
  roleId: string;
  roleName: string;
  userId: string;
  userDisplayName: string;
  isLocked: boolean;
  source: "solver" | "manual";
}>;

export type CandidateDetail = Readonly<{
  candidate: CandidateSummary;
  assignments: ReadonlyArray<AssignmentDetail>;
}>;

export type GeneratedAssignment = Readonly<{
  id: string;
  serviceId: string;
  roleId: string;
  userId: string;
  isLocked?: boolean;
}>;

export type GenerateCandidateResult = Readonly<{
  candidate: CandidateSummary;
  assignments: ReadonlyArray<GeneratedAssignment>;
  unfilledRoles: ReadonlyArray<UnfilledRole>;
}>;

export type InfeasibleLockReason =
  | "unqualified"
  | "inactive"
  | "unavailable"
  | "requirement_exceeded"
  | "service_not_found";

export type InfeasibleLock = Readonly<{
  serviceId: string;
  roleId: string;
  userId: string;
  reason: InfeasibleLockReason;
}>;

export type GenerationWeights = Readonly<{
  primaryRole?: number;
  preferredAvailability?: number;
  loadBalance?: number;
}>;

export type SystemRole = "volunteer" | "team_leader" | "administrator";

export type Proficiency = "primary" | "secondary";

export type MemberRoleCapability = Readonly<{
  roleId: string;
  roleName: string;
  proficiency: Proficiency;
}>;

export type EligibleAssignee = Readonly<{
  userId: string;
  displayName: string;
  email: string;
  proficiency: Proficiency;
}>;

export type MemberUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  systemRole: SystemRole;
  isActive: boolean;
  roles: ReadonlyArray<MemberRoleCapability>;
}>;
