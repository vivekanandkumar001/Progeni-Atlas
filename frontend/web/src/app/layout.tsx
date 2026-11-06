import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { StreamErrorGuard } from "@/components/common/StreamErrorGuard";
import { streamGuardScript } from "@/components/common/streamGuardScript";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Progeni Atlas — Autonomous Technical Interviews",
  description: "Enterprise AI technical interviewing platform powered by autonomous AI agents and state machines.",
};

export const viewport: Viewport = {
  themeColor: "#eef2f7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${jetbrainsMono.variable} scroll-smooth h-full antialiased`}
    >
      <head>
        <Script id="stream-guard-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: streamGuardScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <StreamErrorGuard />
        {children}
      </body>
    </html>
  );
}