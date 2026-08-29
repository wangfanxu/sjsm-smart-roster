import type { DomainRepository, PendingNotificationInput } from "@/domain/types";
import {
  formatServiceDate,
  formatServiceTime,
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
}
