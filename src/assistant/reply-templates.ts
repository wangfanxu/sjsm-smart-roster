import type { AssistantAssignment, SupportedLocale } from "./types";

export const replyTemplates: Record<
  SupportedLocale,
  Readonly<{
    nextAssignment: (assignment: AssistantAssignment) => string;
    noUpcomingAssignment: string;
    unsupported: string;
    ambiguous: string;
  }>
> = {
  en: {
    nextAssignment: (assignment) =>
      `Your next assignment is ${assignment.title} on ${assignment.serviceDate} at ${assignment.serviceTime} as ${assignment.role}.`,
    noUpcomingAssignment: "You have no upcoming assignments.",
    unsupported: "I can only help with questions about your own next assignment right now.",
    ambiguous: 'I\'m not sure what you\'re asking. Try something like "When do I serve next?"',
  },
  zh: {
    nextAssignment: (assignment) =>
      `你的下一次服侍安排是${assignment.serviceDate} ${assignment.serviceTime}的${assignment.title}，角色是${assignment.role}。`,
    noUpcomingAssignment: "你目前没有即将到来的服侍安排。",
    unsupported: "目前我只能回答关于你下一次服侍安排的问题。",
    ambiguous: "我不太确定你的意思，可以换一种方式提问吗？例如：“我下次什么时候服侍？”",
  },
};
