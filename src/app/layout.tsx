import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Redline — AI Security Testing Platform",
  description: "Automated red-teaming for LLM-powered apps. Run 40+ attack payloads across 6 categories, score defenses, and auto-harden system prompts.",
  keywords: ["Redline", "AI security", "LLM security", "prompt injection", "jailbreak", "red teaming", "AI testing", "OWASP LLM01"],
  authors: [{ name: "Redline" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Redline — AI Security Testing Platform",
    description: "Break your LLM before attackers do. Run 40+ attack payloads, score defenses, auto-harden.",
    url: "https://redline-orcin.vercel.app",
    siteName: "Redline",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Redline — AI Security Testing Platform",
    description: "Break your LLM before attackers do. Run 40+ attack payloads, score defenses, auto-harden.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
