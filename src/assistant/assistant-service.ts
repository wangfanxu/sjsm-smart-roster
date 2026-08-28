import type { SmartRosterService } from "@/domain/smart-roster-service";
import type { Actor } from "@/domain/types";
import { replyTemplates } from "./reply-templates";
import type { AssistantReply, IntentClassifier } from "./types";

export class AssistantService {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly rosterService: SmartRosterService,
  ) {}

  async ask(message: string, actor: Actor): Promise<AssistantReply> {
    const classification = await this.classifier.classify(message);
    const templates = replyTemplates[classification.locale];

    if (classification.intent === "unsupported") {
      return {
        intent: "unsupported",
        locale: classification.locale,
        message: templates.unsupported,
        assignment: null,
      };
    }
    if (classification.intent === "ambiguous") {
      return {
        intent: "ambiguous",
        locale: classification.locale,
        message: templates.ambiguous,
        assignment: null,
      };
    }

    const assignments = await this.rosterService.listMyUpcomingAssignments(actor.userId);
    const next = assignments[0] ?? null;
    return {
      intent: "get_my_next_assignment",
      locale: classification.locale,
      message: next ? templates.nextAssignment(next) : templates.noUpcomingAssignment,
      assignment: next,
    };
  }
}
