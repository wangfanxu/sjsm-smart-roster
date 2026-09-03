export type Teammate = Readonly<{
  userId: string;
  displayName: string;
  role: string;
}>;

export type Assignment = Readonly<{
  assignmentId: string;
  serviceId: string;
  startsAt: string;
  serviceDate: string;
  serviceTime: string;
  title: string;
  role: string;
  teammates: ReadonlyArray<Teammate>;
  openReplacementRequestId: string | null;
}>;

export type AvailabilityStatus = "available" | "unavailable" | "preferred";

export type AvailabilityEntry = Readonly<{
  serviceDate: string;
  status: AvailabilityStatus;
  note?: string | null;
}>;
