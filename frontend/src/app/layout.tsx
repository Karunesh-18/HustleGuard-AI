import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HustleGuard AI — Parametric Insurance for Gig Workers",
  description:
    "Real-time disruption intelligence and automatic parametric payouts for delivery riders when weather, traffic, or public alerts reduce earning potential.",
  keywords: ["insurance", "gig worker", "parametric", "delivery", "disruption"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
