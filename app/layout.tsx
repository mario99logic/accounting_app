import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "פורטל לקוחות — משרד רואי חשבון",
  description: "מעקב אחר סטטוס התיק והמשימות הפתוחות",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
