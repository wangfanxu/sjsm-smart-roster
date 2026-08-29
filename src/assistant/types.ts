export type SupportedLocale = "en" | "zh";

export type ClassificationResult =
  | Readonly<{ intent: "get_my_next_assignment"; locale: SupportedLocale }>
  | Readonly<{ intent: "prepare_mark_unavailable"; locale: SupportedLocale; serviceDate: string | null }>
  | Readonly<{ intent: "unsupported"; locale: SupportedLocale }>
  | Readonly<{ intent: "ambiguous"; locale: SupportedLocale }>;

export type AssistantIntent = ClassificationResult["intent"];

export interface IntentClassifier {
  /**
   * @param referenceDate today's calendar date (YYYY-MM-DD, Asia/Singapore),
   * used to resolve relative date expressions ("next Sunday", "tomorrow").
   */
  classify(message: string, referenceDate: string): Promise<ClassificationResult>;
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
  confirmationToken: string | null;
  pendingServiceDate: string | null;
}>;

export type AssistantConfirmationReply = Readonly<{
  locale: SupportedLocale;
  message: string;
  serviceDate: string;
}>;
