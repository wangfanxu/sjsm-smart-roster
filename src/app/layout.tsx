import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "SJSM SmartRoster",
  description: "Explainable AI-assisted church volunteer scheduling",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
