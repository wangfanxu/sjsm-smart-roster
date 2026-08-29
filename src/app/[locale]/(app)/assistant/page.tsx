"use client";

import { useParams } from "next/navigation";
import { isLocale, getMessages, type Locale } from "@/i18n/config";

export default function AssistantPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const messages = getMessages(locale);

  return (
    <section className="placeholder-panel">
      <h1>{messages.navAssistant}</h1>
      <p>{messages.comingSoon}</p>
    </section>
  );
}
