import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
  title: "TalentPulse AI — Autonomous Technical Interviews",
  description: "Enterprise AI technical interviewing platform powered by Llama 3.3 and LangGraph state machines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrainsMono.variable} dark scroll-smooth h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#020617] text-[#f8fafc]">{children}</body>
    </html>
  );
}
