export type SupportedLocale = "en" | "zh";

export type AssistantIntent = "get_my_next_assignment" | "unsupported" | "ambiguous";

export type ClassificationResult = Readonly<{
  intent: AssistantIntent;
  locale: SupportedLocale;
}>;

export interface IntentClassifier {
  classify(message: string): Promise<ClassificationResult>;
}

export type AssistantAssignment = Readonly<{
  assignmentId: string;
  serviceId: string;
  serviceDate: string;
  serviceTime: string;
  title: string;
  role: string;
}>;

export type AssistantReply = Readonly<{
  intent: AssistantIntent;
  locale: SupportedLocale;
  message: string;
  assignment: AssistantAssignment | null;
}>;
