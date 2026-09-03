import type { Locale } from "@/i18n/config";
import type { AvailabilityStatus } from "./types";

export type DashboardMessages = {
  pageTitle: string;
  pageDescription: string;

  assignmentsTitle: string;
  assignmentsLoading: string;
  assignmentsErrorTitle: string;
  assignmentsRetry: string;
  assignmentsEmptyTitle: string;
  assignmentsEmptyDescription: string;
  assignmentsRoleLabel: string;
  assignmentsColumnWhen: string;
  assignmentsColumnTitle: string;
  assignmentsColumnRole: string;
  assignmentsTeammatesTitle: string;
  requestCoverageButton: string;
  requestCoverageReasonLabel: string;
  requestCoverageSubmit: string;
  requestCoverageSubmitting: string;
  requestCoverageError: string;
  requestCoverageCancel: string;
  coverageRequestedLabel: string;
  cancelCoverageRequestButton: string;
  cancellingCoverageRequest: string;
  cancelCoverageRequestError: string;

  availabilityTitle: string;
  availabilityDescription: string;
  availabilityLoading: string;
  availabilityErrorTitle: string;
  availabilityRetry: string;
  availabilityListTitle: string;
  availabilityListEmpty: string;
  availabilityNoteLabel: string;
  availabilityFormTitle: string;
  availabilityDateLabel: string;
  availabilityStatusLabel: string;
  availabilityNoteInputLabel: string;
  availabilityNoteInputPlaceholder: string;
  availabilitySubmit: string;
  availabilitySubmitting: string;
  availabilityPastDateMessage: string;
  availabilitySaveSuccess: string;
  availabilitySaveErrorTitle: string;
  availabilityStatusOptions: Record<AvailabilityStatus, string>;
};

const messages: Record<Locale, DashboardMessages> = {
  en: {
    pageTitle: "My schedule",
    pageDescription:
      "See what you're signed up for and let the team know when you're available to serve.",

    assignmentsTitle: "Upcoming assignments",
    assignmentsLoading: "Loading your upcoming assignments…",
    assignmentsErrorTitle: "We couldn't load your assignments.",
    assignmentsRetry: "Try again",
    assignmentsEmptyTitle: "No upcoming assignments yet",
    assignmentsEmptyDescription:
      "You're not scheduled for any published service right now. Check back after the next roster is published, or update your availability below so the team knows when you can serve.",
    assignmentsRoleLabel: "Role",
    assignmentsColumnWhen: "When",
    assignmentsColumnTitle: "Service",
    assignmentsColumnRole: "Role",
    assignmentsTeammatesTitle: "Team members",
    requestCoverageButton: "Request coverage",
    requestCoverageReasonLabel: "Reason (optional)",
    requestCoverageSubmit: "Submit request",
    requestCoverageSubmitting: "Submitting…",
    requestCoverageError: "We couldn't submit your request.",
    requestCoverageCancel: "Cancel",
    coverageRequestedLabel: "Coverage requested — pending review",
    cancelCoverageRequestButton: "Cancel request",
    cancellingCoverageRequest: "Cancelling…",
    cancelCoverageRequestError: "We couldn't cancel your request.",

    availabilityTitle: "Availability",
    availabilityDescription:
      "Tell the team which dates work for you. You can update this at any time before the date passes.",
    availabilityLoading: "Loading your availability…",
    availabilityErrorTitle: "We couldn't load your availability.",
    availabilityRetry: "Try again",
    availabilityListTitle: "Dates you've already set",
    availabilityListEmpty: "You haven't set your availability for any upcoming date yet.",
    availabilityNoteLabel: "Note",
    availabilityFormTitle: "Set your availability",
    availabilityDateLabel: "Date",
    availabilityStatusLabel: "Status",
    availabilityNoteInputLabel: "Note (optional)",
    availabilityNoteInputPlaceholder: "e.g. Traveling, back next week",
    availabilitySubmit: "Save availability",
    availabilitySubmitting: "Saving…",
    availabilityPastDateMessage: "You can't set availability for a date that has already passed.",
    availabilitySaveSuccess: "Availability saved.",
    availabilitySaveErrorTitle: "We couldn't save your availability.",
    availabilityStatusOptions: {
      available: "Available",
      unavailable: "Unavailable",
      preferred: "Preferred",
    },
  },
  zh: {
    pageTitle: "我的排班",
    pageDescription: "查看你已被安排的服侍，并让团队知道你哪些日期方便参与服侍。",

    assignmentsTitle: "即将到来的安排",
    assignmentsLoading: "正在加载你的安排……",
    assignmentsErrorTitle: "无法加载你的安排。",
    assignmentsRetry: "重试",
    assignmentsEmptyTitle: "暂无即将到来的安排",
    assignmentsEmptyDescription:
      "目前没有已发布的服侍安排给你。请在下一次排班发布后再查看，或先在下方更新你的可用时间，让团队了解你可以服侍的日期。",
    assignmentsRoleLabel: "角色",
    assignmentsColumnWhen: "时间",
    assignmentsColumnTitle: "服侍",
    assignmentsColumnRole: "角色",
    assignmentsTeammatesTitle: "组员",
    requestCoverageButton: "申请换班",
    requestCoverageReasonLabel: "原因（可选）",
    requestCoverageSubmit: "提交申请",
    requestCoverageSubmitting: "提交中……",
    requestCoverageError: "无法提交你的申请。",
    requestCoverageCancel: "取消",
    coverageRequestedLabel: "已申请换班，等待审核",
    cancelCoverageRequestButton: "撤销申请",
    cancellingCoverageRequest: "撤销中……",
    cancelCoverageRequestError: "无法撤销你的申请。",

    availabilityTitle: "可用时间",
    availabilityDescription: "告诉团队你哪些日期方便服侍。在日期到来之前，你可以随时更新。",
    availabilityLoading: "正在加载你的可用时间……",
    availabilityErrorTitle: "无法加载你的可用时间。",
    availabilityRetry: "重试",
    availabilityListTitle: "你已经设置的日期",
    availabilityListEmpty: "你还没有为任何即将到来的日期设置可用时间。",
    availabilityNoteLabel: "备注",
    availabilityFormTitle: "设置可用时间",
    availabilityDateLabel: "日期",
    availabilityStatusLabel: "状态",
    availabilityNoteInputLabel: "备注（可选）",
    availabilityNoteInputPlaceholder: "例如：外出旅行，下周回来",
    availabilitySubmit: "保存可用时间",
    availabilitySubmitting: "保存中……",
    availabilityPastDateMessage: "不能为已经过去的日期设置可用时间。",
    availabilitySaveSuccess: "可用时间已保存。",
    availabilitySaveErrorTitle: "无法保存你的可用时间。",
    availabilityStatusOptions: {
      available: "可参与",
      unavailable: "不可参与",
      preferred: "优先希望参与",
    },
  },
};

export function getDashboardMessages(locale: Locale): DashboardMessages {
  return messages[locale];
}
