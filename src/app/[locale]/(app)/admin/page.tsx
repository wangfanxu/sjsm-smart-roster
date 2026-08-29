"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isLocale, type Locale } from "@/i18n/config";

export default function AdminPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${locale}/admin/periods`);
  }, [locale, router]);

  return null;
}
