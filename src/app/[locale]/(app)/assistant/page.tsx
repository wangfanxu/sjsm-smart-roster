"use client";

import { useParams } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { AssistantPanel } from "./AssistantPanel";

export default function AssistantPage() {
  const params = useParams<{ locale: string }>();
  const routeLocale: Locale = isLocale(params.locale) ? params.locale : "en";

  return <AssistantPanel locale={routeLocale} />;
}
