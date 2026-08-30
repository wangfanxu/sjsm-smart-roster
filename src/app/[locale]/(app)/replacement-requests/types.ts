export type ReplacementRequestStatus = "open" | "approved" | "declined" | "cancelled";

export type ReplacementRequestSummary = Readonly<{
  id: string;
  assignmentId: string;
  status: ReplacementRequestStatus;
  reason: string | null;
  requesterId: string;
  requesterDisplayName: string;
  requesterEmail: string;
  replacementUserId: string | null;
  replacementDisplayName: string | null;
  replacementEmail: string | null;
  serviceId: string;
  serviceTitle: string;
  serviceStartsAt: string;
  roleId: string;
  roleName: string;
  createdAt: string;
}>;

export type EligibleReplacement = Readonly<{
  userId: string;
  displayName: string;
  email: string;
  proficiency: "primary" | "secondary";
}>;
