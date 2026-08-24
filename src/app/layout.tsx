import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sg",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jbm",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alex.ai — A Xorvion Product",
  description:
    "Agentic lead-gen: find small businesses with no website, analyze them with AI, sell them one.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        {/* Vercel Web Analytics — free on Hobby, no card, page views only */}
        <Analytics />
      </body>
    </html>
  );
}
