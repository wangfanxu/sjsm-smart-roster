import type { AssistantLocale } from "./assistant-api";

/**
 * Small, feature-owned bilingual dictionary for the handful of UI strings
 * this chat screen renders itself (input placeholder, buttons, status
 * copy). Everything else shown in the conversation is the assistant's own
 * `message` text from the API response, which is already bilingual and
 * server-composed — it must be displayed verbatim, not looked up here.
 *
 * Deliberately colocated instead of added to `src/i18n/config.ts` to avoid
 * touching a shared file that other in-flight tickets also edit.
 */
export type AssistantUiMessages = Readonly<{
  inputPlaceholder: string;
  inputLabel: string;
  sendButton: string;
  thinking: string;
  retryError: string;
  confirmButton: string;
  cancelButton: string;
  confirming: string;
  confirmationHeading: string;
  confirmationDateLabel: string;
  emptyStateHint: string;
}>;

const assistantUiMessages: Record<AssistantLocale, AssistantUiMessages> = {
  en: {
    inputPlaceholder: 'Ask about your schedule, e.g. "When do I serve next?"',
    inputLabel: "Message the assistant",
    sendButton: "Send",
    thinking: "Assistant is thinking…",
    retryError: "Something went wrong reaching the assistant. Please try again.",
    confirmButton: "Confirm",
    cancelButton: "Cancel",
    confirming: "Confirming…",
    confirmationHeading: "Confirm this change",
    confirmationDateLabel: "Mark unavailable on",
    emptyStateHint:
      "Try asking when you serve next, or tell the assistant a date you can't serve.",
  },
  zh: {
    inputPlaceholder: "询问你的排班，例如“我下次什么时候服侍？”",
    inputLabel: "给助理发消息",
    sendButton: "发送",
    thinking: "助理正在思考……",
    retryError: "连接助理时出现问题，请重试。",
    confirmButton: "确认",
    cancelButton: "取消",
    confirming: "正在确认……",
    confirmationHeading: "请确认此项更改",
    confirmationDateLabel: "标记为不可服侍的日期",
    emptyStateHint: "可以询问你下次何时服侍，或者告诉助理你哪天无法服侍。",
  },
};

export function getAssistantUiMessages(locale: AssistantLocale): AssistantUiMessages {
  return assistantUiMessages[locale];
}
