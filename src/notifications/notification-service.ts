import type { DomainRepository, PendingNotificationInput } from "@/domain/types";
import {
  formatServiceDate,
  formatServiceTime,
  replacementApprovedReplacementBody,
  replacementApprovedReplacementSubject,
  replacementApprovedRequesterBody,
  replacementApprovedRequesterSubject,
  replacementDeclinedBody,
  replacementDeclinedSubject,
  rosterPublishedBody,
  rosterPublishedSubject,
  type NotificationAssignment,
} from "./notification-templates";
import type { EmailSender } from "./types";

type VolunteerDigest = Readonly<{
  displayName: string;
  email: string;
  assignments: NotificationAssignment[];
}>;

export class NotificationService {
  constructor(
    private readonly repository: DomainRepository,
    private readonly emailSender: EmailSender,
  ) {}

  /**
   * Best-effort: every per-recipient send is isolated (one failure never
   * stops the others), and this is always called after a publish has
   * already committed, so a failure here can never roll back the roster.
   */
  async notifyRosterPublished(candidateId: string): Promise<void> {
    const detail = await this.repository.getRosterCandidateDetail(candidateId);
    if (!detail) return;

    const digestsByUser = new Map<string, VolunteerDigest>();
    for (const assignment of detail.assignments) {
      const digest = digestsByUser.get(assignment.userId) ?? {
        displayName: assignment.userDisplayName,
        email: assignment.userEmail,
        assignments: [],
      };
      digest.assignments.push({
        serviceTitle: assignment.serviceTitle,
        serviceDate: formatServiceDate(assignment.serviceStartsAt),
        serviceTime: formatServiceTime(assignment.serviceStartsAt),
        roleName: assignment.roleName,
      });
      digestsByUser.set(assignment.userId, digest);
    }
    if (digestsByUser.size === 0) return;

    const entries: PendingNotificationInput[] = [...digestsByUser.entries()].map(
      ([userId, digest]) => ({
        userId,
        recipientEmail: digest.email,
        eventType: "roster_published",
        idempotencyKey: `roster_published:${candidateId}:${userId}`,
      }),
    );
    const pending = await this.repository.getOrCreateNotifications(entries);

    for (const notification of pending) {
      const digest = digestsByUser.get(notification.userId);
      if (!digest) continue;
      try {
        const result = await this.emailSender.send({
          to: notification.recipientEmail,
          subject: rosterPublishedSubject(),
          text: rosterPublishedBody(digest.displayName, digest.assignments),
        });
        await this.repository.markNotificationSent(notification.id, result.providerMessageId);
      } catch (error) {
        await this.repository.markNotificationFailed(
          notification.id,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  }

  /**
   * Best-effort, same isolation contract as notifyRosterPublished: called
   * after the replacement request has already been approved and the
   * assignment already reassigned, so a failure here can never roll that
   * back.
   */
  async notifyReplacementApproved(requestId: string): Promise<void> {
    const detail = await this.repository.getReplacementRequestDetail(requestId);
    if (!detail || detail.status !== "approved" || !detail.replacementUserId || !detail.replacementDisplayName) {
      return;
    }

    const assignment: NotificationAssignment = {
      serviceTitle: detail.serviceTitle,
      serviceDate: formatServiceDate(detail.serviceStartsAt),
      serviceTime: formatServiceTime(detail.serviceStartsAt),
      roleName: detail.roleName,
    };

    const entries: PendingNotificationInput[] = [
      {
        userId: detail.requesterId,
        recipientEmail: detail.requesterEmail,
        eventType: "replacement_approved",
        idempotencyKey: `replacement_approved:${requestId}:${detail.requesterId}`,
      },
      {
        userId: detail.replacementUserId,
        recipientEmail: detail.replacementEmail ?? "",
        eventType: "replacement_approved",
        idempotencyKey: `replacement_approved:${requestId}:${detail.replacementUserId}`,
      },
    ];
    const pending = await this.repository.getOrCreateNotifications(entries);

    for (const notification of pending) {
      const isRequester = notification.userId === detail.requesterId;
      try {
        const result = await this.emailSender.send({
          to: notification.recipientEmail,
          subject: isRequester ? replacementApprovedRequesterSubject() : replacementApprovedReplacementSubject(),
          text: isRequester
            ? replacementApprovedRequesterBody(detail.requesterDisplayName, detail.replacementDisplayName, assignment)
            : replacementApprovedReplacementBody(detail.replacementDisplayName, assignment),
        });
        await this.repository.markNotificationSent(notification.id, result.providerMessageId);
      } catch (error) {
        await this.repository.markNotificationFailed(
          notification.id,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  }

  async notifyReplacementDeclined(requestId: string): Promise<void> {
    const detail = await this.repository.getReplacementRequestDetail(requestId);
    if (!detail || detail.status !== "declined") return;

    const assignment: NotificationAssignment = {
      serviceTitle: detail.serviceTitle,
      serviceDate: formatServiceDate(detail.serviceStartsAt),
      serviceTime: formatServiceTime(detail.serviceStartsAt),
      roleName: detail.roleName,
    };

    const [notification] = await this.repository.getOrCreateNotifications([
      {
        userId: detail.requesterId,
        recipientEmail: detail.requesterEmail,
        eventType: "replacement_declined",
        idempotencyKey: `replacement_declined:${requestId}:${detail.requesterId}`,
      },
    ]);
    if (!notification) return;

    try {
      const result = await this.emailSender.send({
        to: notification.recipientEmail,
        subject: replacementDeclinedSubject(),
        text: replacementDeclinedBody(detail.requesterDisplayName, assignment),
      });
      await this.repository.markNotificationSent(notification.id, result.providerMessageId);
    } catch (error) {
      await this.repository.markNotificationFailed(
        notification.id,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}
