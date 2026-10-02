import React from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { ConsoleWindow } from '@/components/ConsoleWindow';
import { HowItWorks } from '@/components/HowItWorks';
import { BenefitPillars } from '@/components/BenefitPillars';
import { ScorecardPreview } from '@/components/ScorecardPreview';
import { PricingSection } from '@/components/PricingSection';
import { FaqSection } from '@/components/FaqSection';
import { TrustStrip } from '@/components/TrustStrip';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020617] bg-grid-pattern relative overflow-hidden flex flex-col justify-between font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-full ambient-glow-cyan pointer-events-none z-0" />
      <div className="absolute top-1/3 right-0 w-full h-full ambient-glow-indigo pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col flex-grow">
        {/* Sticky Top-0 Header */}
        <Navbar />

        {/* Section 1: Hero */}
        <Hero />

        {/* Section 2: Live Demo */}
        <ConsoleWindow />

        {/* Section 3: How It Works */}
        <HowItWorks />

        {/* Section 4: Benefits */}
        <BenefitPillars />

        {/* Section 5: Scorecard Preview */}
        <ScorecardPreview />

        {/* Section 6: Pricing */}
        <PricingSection />

        {/* Section 7: FAQ */}
        <FaqSection />
      </div>

      {/* Footer & Enterprise Trust Badges */}
      <TrustStrip />
    </main>
  );
}
