import type { Locale } from "@/i18n/config";
import type { ReplacementRequestStatus } from "./types";

export type ReplacementRequestsMessages = {
  pageTitle: string;
  pageDescription: string;
  loading: string;
  loadError: string;
  retry: string;
  emptyState: string;

  columnRequester: string;
  columnService: string;
  columnRole: string;
  columnReason: string;
  columnStatus: string;
  columnActions: string;
  noReason: string;

  statusOpen: string;
  statusApproved: string;
  statusDeclined: string;
  statusCancelled: string;

  reviewButton: string;
  declineButton: string;
  declining: string;
  declineError: string;
  selectReplacementPlaceholder: string;
  confirmApprove: string;
  approving: string;
  approveError: string;
  cancelReview: string;
  eligibleLoading: string;
  eligibleLoadError: string;
  noEligibleReplacements: string;
  approvedReplacementLabel: string;
};

const messages: Record<Locale, ReplacementRequestsMessages> = {
  en: {
    pageTitle: "Replacement requests",
    pageDescription: "Review coverage requests from volunteers and pick a replacement.",
    loading: "Loading replacement requests…",
    loadError: "Could not load replacement requests.",
    retry: "Try again",
    emptyState: "No replacement requests yet.",

    columnRequester: "Requester",
    columnService: "Service",
    columnRole: "Role",
    columnReason: "Reason",
    columnStatus: "Status",
    columnActions: "Actions",
    noReason: "—",

    statusOpen: "Open",
    statusApproved: "Approved",
    statusDeclined: "Declined",
    statusCancelled: "Cancelled",

    reviewButton: "Review",
    declineButton: "Decline",
    declining: "Declining…",
    declineError: "Could not decline this request.",
    selectReplacementPlaceholder: "Select a replacement",
    confirmApprove: "Approve",
    approving: "Approving…",
    approveError: "Could not approve this request.",
    cancelReview: "Cancel",
    eligibleLoading: "Loading eligible volunteers…",
    eligibleLoadError: "Could not load eligible volunteers.",
    noEligibleReplacements: "No eligible volunteer is available for this role on this date.",
    approvedReplacementLabel: "Replacement",
  },
  zh: {
    pageTitle: "换班申请",
    pageDescription: "审核志愿者的换班申请，并选择替补人选。",
    loading: "正在加载换班申请……",
    loadError: "无法加载换班申请。",
    retry: "重试",
    emptyState: "还没有任何换班申请。",

    columnRequester: "申请人",
    columnService: "服务",
    columnRole: "角色",
    columnReason: "原因",
    columnStatus: "状态",
    columnActions: "操作",
    noReason: "—",

    statusOpen: "待审核",
    statusApproved: "已批准",
    statusDeclined: "已拒绝",
    statusCancelled: "已撤销",

    reviewButton: "审核",
    declineButton: "拒绝",
    declining: "拒绝中……",
    declineError: "无法拒绝此申请。",
    selectReplacementPlaceholder: "请选择替补人选",
    confirmApprove: "批准",
    approving: "批准中……",
    approveError: "无法批准此申请。",
    cancelReview: "取消",
    eligibleLoading: "正在加载符合条件的志愿者……",
    eligibleLoadError: "无法加载符合条件的志愿者。",
    noEligibleReplacements: "该日期该角色暂无符合条件的志愿者。",
    approvedReplacementLabel: "替补人选",
  },
};

export function getReplacementRequestsMessages(locale: Locale): ReplacementRequestsMessages {
  return messages[locale];
}

export function statusLabel(
  status: ReplacementRequestStatus,
  messagesForLocale: ReplacementRequestsMessages,
): string {
  if (status === "approved") return messagesForLocale.statusApproved;
  if (status === "declined") return messagesForLocale.statusDeclined;
  if (status === "cancelled") return messagesForLocale.statusCancelled;
  return messagesForLocale.statusOpen;
}
