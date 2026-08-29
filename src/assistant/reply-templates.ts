import type { AssistantAssignment, SupportedLocale } from "./types";

export const replyTemplates: Record<
  SupportedLocale,
  Readonly<{
    nextAssignment: (assignment: AssistantAssignment) => string;
    noUpcomingAssignment: string;
    unsupported: string;
    ambiguous: string;
    couldNotResolveDate: string;
    confirmMarkUnavailable: (serviceDate: string) => string;
    markUnavailableConfirmed: (serviceDate: string) => string;
  }>
> = {
  en: {
    nextAssignment: (assignment) =>
      `Your next assignment is ${assignment.title} on ${assignment.serviceDate} at ${assignment.serviceTime} as ${assignment.role}.`,
    noUpcomingAssignment: "You have no upcoming assignments.",
    unsupported: "I can only help with questions about your own next assignment right now.",
    ambiguous: 'I\'m not sure what you\'re asking. Try something like "When do I serve next?"',
    couldNotResolveDate:
      'I couldn\'t figure out which date you mean. Could you name a specific date, like "September 5" or "next Sunday"?',
    confirmMarkUnavailable: (serviceDate) =>
      `You want to mark yourself unavailable on ${serviceDate}. Reply to confirm, or ignore this to cancel.`,
    markUnavailableConfirmed: (serviceDate) => `Done — you're marked unavailable on ${serviceDate}.`,
  },
  zh: {
    nextAssignment: (assignment) =>
      `你的下一次服侍安排是${assignment.serviceDate} ${assignment.serviceTime}的${assignment.title}，角色是${assignment.role}。`,
    noUpcomingAssignment: "你目前没有即将到来的服侍安排。",
    unsupported: "目前我只能回答关于你下一次服侍安排的问题。",
    ambiguous: "我不太确定你的意思，可以换一种方式提问吗？例如：“我下次什么时候服侍？”",
    couldNotResolveDate: "我不太确定你说的是哪一天，可以说明具体日期吗？例如“9月5日”或“下周日”。",
    confirmMarkUnavailable: (serviceDate) => `你想将${serviceDate}设为不可服侍。请回复确认，不理会即取消。`,
    markUnavailableConfirmed: (serviceDate) => `已完成——你在${serviceDate}已设为不可服侍。`,
  },
};
