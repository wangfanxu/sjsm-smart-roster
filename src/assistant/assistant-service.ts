import type { SmartRosterService } from "@/domain/smart-roster-service";
import { ApiError } from "@/api/errors";
import type { Actor } from "@/domain/types";
import { calendarDateInSingapore } from "@/lib/calendar";
import { createConfirmationToken, verifyConfirmationToken } from "./confirmation-token";
import { replyTemplates } from "./reply-templates";
import type { AssistantConfirmationReply, AssistantReply, IntentClassifier } from "./types";

const emptyReply = {
  assignment: null,
  confirmationToken: null,
  pendingServiceDate: null,
} as const;

export class AssistantService {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly rosterService: SmartRosterService,
    private readonly confirmationSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ask(message: string, actor: Actor): Promise<AssistantReply> {
    const referenceDate = calendarDateInSingapore(this.now());
    const classification = await this.classifier.classify(message, referenceDate);
    const templates = replyTemplates[classification.locale];

    if (classification.intent === "unsupported") {
      return {
        intent: "unsupported",
        locale: classification.locale,
        message: templates.unsupported,
        ...emptyReply,
      };
    }
    if (classification.intent === "ambiguous") {
      return {
        intent: "ambiguous",
        locale: classification.locale,
        message: templates.ambiguous,
        ...emptyReply,
      };
    }
    if (classification.intent === "prepare_mark_unavailable") {
      if (!classification.serviceDate) {
        return {
          intent: "ambiguous",
          locale: classification.locale,
          message: templates.couldNotResolveDate,
          ...emptyReply,
        };
      }
      const confirmationToken = createConfirmationToken(
        {
          action: "mark_unavailable",
          userId: actor.userId,
          serviceDate: classification.serviceDate,
          locale: classification.locale,
        },
        this.confirmationSecret,
        this.now(),
      );
      return {
        intent: "prepare_mark_unavailable",
        locale: classification.locale,
        message: templates.confirmMarkUnavailable(classification.serviceDate),
        assignment: null,
        confirmationToken,
        pendingServiceDate: classification.serviceDate,
      };
    }

    const assignments = await this.rosterService.listMyUpcomingAssignments(actor.userId);
    const next = assignments[0] ?? null;
    return {
      intent: "get_my_next_assignment",
      locale: classification.locale,
      message: next ? templates.nextAssignment(next) : templates.noUpcomingAssignment,
      ...emptyReply,
      assignment: next,
    };
  }

  async confirm(confirmationToken: string, actor: Actor): Promise<AssistantConfirmationReply> {
    const pending = verifyConfirmationToken(confirmationToken, this.confirmationSecret, this.now());
    if (!pending) {
      throw new ApiError("confirmation_expired", 409, "This confirmation has expired or is invalid");
    }
    if (pending.userId !== actor.userId) {
      throw new ApiError(
        "confirmation_user_mismatch",
        403,
        "This confirmation does not belong to the authenticated user",
      );
    }

    await this.rosterService.setMyAvailability(actor.userId, {
      serviceDate: pending.serviceDate,
      status: "unavailable",
    });

    const templates = replyTemplates[pending.locale];
    return {
      locale: pending.locale,
      message: templates.markUnavailableConfirmed(pending.serviceDate),
      serviceDate: pending.serviceDate,
    };
  }
}
