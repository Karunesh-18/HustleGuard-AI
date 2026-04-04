import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HustleGuard AI — Gig Worker Income Protection",
  description:
    "Parametric insurance for gig delivery workers. Automatic payouts when disruptions stop you working — no claim forms, no waiting.",
  keywords: ["gig workers", "income insurance", "parametric insurance", "delivery workers", "India"],
  openGraph: {
    title: "HustleGuard AI",
    description: "Automatic income protection for gig delivery workers",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#080B14" />
      </head>
      <body>{children}</body>
    </html>
  );
}
