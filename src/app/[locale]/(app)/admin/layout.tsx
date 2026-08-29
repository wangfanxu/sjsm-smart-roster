"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { useAuth } from "@/lib/auth-client";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";

  useEffect(() => {
    if (status === "ready" && profile && profile.systemRole !== "administrator") {
      router.replace(`/${locale}/dashboard`);
    }
  }, [status, profile, locale, router]);

  if (status !== "ready" || !profile || profile.systemRole !== "administrator") {
    return null;
  }

  return children;
}
