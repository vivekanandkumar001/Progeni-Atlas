import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { StreamErrorGuard } from "@/components/common/StreamErrorGuard";
import { streamGuardScript } from "@/components/common/streamGuardScript";
import { JsonLd } from "@/components/seo/JsonLd";
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
  metadataBase: new URL("https://atlas.progeni.live"),
  title: {
    default: "Progeni Atlas — Autonomous AI Technical Interviews & Skills Evaluation",
    template: "%s | Progeni Atlas",
  },
  description:
    "Enterprise autonomous AI technical interview platform. Conduct real-time two-way voice interviews, multi-language coding assessments, tamper-proof anti-cheat proctoring, and instant calibrated candidate dossiers.",
  keywords: [
    "AI technical interview",
    "autonomous technical interview",
    "AI coding interview",
    "developer screening platform",
    "technical hiring automation",
    "candidate evaluation rubric",
    "real-time proctoring",
    "AI interview agent",
    "two-way voice AI",
    "Progeni Atlas",
    "coding sandbox",
    "system design interview",
    "full stack interview screening",
    "remote hiring intelligence",
  ],
  authors: [{ name: "Progeni Atlas", url: "https://atlas.progeni.live" }],
  creator: "Progeni Atlas",
  publisher: "Progeni Atlas",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "https://atlas.progeni.live",
  },
  openGraph: {
    title: "Progeni Atlas — Autonomous AI Technical Interviews & Skills Evaluation",
    description:
      "Enterprise autonomous AI technical interview platform with real-time two-way voice, multi-language coding environments, anti-cheat proctoring, and instant candidate dossiers.",
    url: "https://atlas.progeni.live",
    siteName: "Progeni Atlas",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/progeni-atlas-logo.png",
        width: 1200,
        height: 630,
        alt: "Progeni Atlas Autonomous Technical Interview Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Progeni Atlas — Autonomous AI Technical Interviews",
    description:
      "Conduct real-time two-way AI technical interviews with live coding, proctoring, and instant recruiter dossiers.",
    images: ["/progeni-atlas-logo.png"],
    creator: "@ProgeniAtlas",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
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
        <JsonLd />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <StreamErrorGuard />
        {children}
      </body>
    </html>
  );
}