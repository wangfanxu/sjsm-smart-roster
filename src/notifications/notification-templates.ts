export type NotificationAssignment = Readonly<{
  serviceTitle: string;
  serviceDate: string;
  serviceTime: string;
  roleName: string;
}>;

const applicationTimeZone = "Asia/Singapore";

export function formatServiceDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: applicationTimeZone }).format(date);
}

export function formatServiceTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: applicationTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function assignmentLineEn(assignment: NotificationAssignment): string {
  return `- ${assignment.serviceDate} ${assignment.serviceTime} — ${assignment.serviceTitle} as ${assignment.roleName}`;
}

function assignmentLineZh(assignment: NotificationAssignment): string {
  return `- ${assignment.serviceDate} ${assignment.serviceTime} — ${assignment.serviceTitle}，角色：${assignment.roleName}`;
}

export function rosterPublishedSubject(): string {
  return "Your service roster has been published / 你的服侍排班已发布";
}

export function rosterPublishedBody(
  displayName: string,
  assignments: ReadonlyArray<NotificationAssignment>,
): string {
  const en = [
    `Hi ${displayName},`,
    "",
    "A roster has been published with the following assignment(s) for you:",
    ...assignments.map(assignmentLineEn),
    "",
    "If you have any questions, please contact your team leader.",
  ].join("\n");

  const zh = [
    `${displayName}你好，`,
    "",
    "已发布的排班表中包含以下服侍安排：",
    ...assignments.map(assignmentLineZh),
    "",
    "如有任何问题，请联系你的团队负责人。",
  ].join("\n");

  return `${en}\n\n---\n\n${zh}`;
}
