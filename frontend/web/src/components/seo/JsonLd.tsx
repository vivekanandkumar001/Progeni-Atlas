import React from 'react';

/**
 * Enterprise SEO, GEO (Generative Engine Optimization), and AEO (Answer Engine Optimization)
 * JSON-LD Structured Data Schema for Progeni Atlas.
 *
 * Schemas included:
 * - Organization: Entity authority for search & generative engines (Google, Perplexity, ChatGPT).
 * - WebApplication / SoftwareApplication: Product taxonomy, pricing, capabilities, rating.
 * - WebSite: Site authority and canonical navigation.
 * - FAQPage: AEO powerhouse for voice search, Google AI Overviews, and direct snippet answers.
 */
export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://atlas.progeni.live/#organization',
    name: 'Progeni Atlas',
    alternateName: ['Progeni Atlas AI', 'Progeni Technical Interview Platform'],
    url: 'https://atlas.progeni.live',
    logo: {
      '@type': 'ImageObject',
      url: 'https://atlas.progeni.live/progeni-atlas-logo.png',
      width: '1200',
      height: '630',
    },
    description:
      'Enterprise-grade autonomous AI technical interview and skills assessment platform conducting real-time two-way voice interviews, live coding assessments, and anti-cheat proctoring.',
    sameAs: [
      'https://github.com/vivekanandkumar001/talentpulse-AI',
      'https://atlas.progeni.live',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'Customer Support',
        email: 'progeniatlas@ptaxis',
        availableLanguage: ['English', 'Hindi'],
      },
    ],
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://atlas.progeni.live/#webapp',
    name: 'Progeni Atlas',
    url: 'https://atlas.progeni.live',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any modern web browser (Chrome, Firefox, Safari, Edge)',
    softwareVersion: '2.0.0',
    description:
      'Autonomous technical interviewing software featuring live adaptive voice AI, browser-based coding sandbox, multi-device proctoring, and instant calibrated scorecards.',
    offers: {
      '@type': 'Offer',
      price: '1.00',
      priceCurrency: 'INR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '1.00',
        priceCurrency: 'INR',
        name: 'Duration-based billing: 1 Credit (₹1.00) per 3 minutes of interview time',
      },
    },
    featureList: [
      'Autonomous two-way real-time voice & video AI interviewer',
      'Multi-language coding sandbox with terminal execution (Python, TypeScript, C++, Java, Go)',
      'Multi-modal proctoring with companion phone camera sync and gaze tracking',
      'Instant calibrated scoring dossiers with role-specific competency rubrics',
      'Enterprise ATS integrations with Greenhouse, Workday, Lever, and webhooks',
      'Transparent duration-based billing (₹1 per 3 minutes, 2 free trial demo screenings)',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '128',
      bestRating: '5',
      worstRating: '1',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://atlas.progeni.live/#website',
    url: 'https://atlas.progeni.live',
    name: 'Progeni Atlas',
    description:
      'Autonomous AI Technical Interviews & Enterprise Candidate Skills Evaluation Platform.',
    publisher: {
      '@id': 'https://atlas.progeni.live/#organization',
    },
  };

  // AEO (Answer Engine Optimization) FAQ Schema
  // Optimized for Google AI Overviews, Perplexity Q&A, and Voice Assistants
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://atlas.progeni.live/#faq',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Progeni Atlas?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Progeni Atlas is an enterprise-grade autonomous AI technical interview and skills assessment platform. It conducts live two-way voice interviews, multi-language coding assessments in a secure browser sandbox, enforces anti-cheat proctoring, and automatically generates calibrated recruiter scoring dossiers.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does autonomous AI technical interviewing work in Progeni Atlas?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Candidates join through a web link with zero software installation. An autonomous AI interviewer engages the candidate in live adaptive dialogue, poses real-world coding problems, executes code in a secure cloud sandbox, and generates an evidence-linked evaluation report across technical depth, problem-solving, and architecture.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Progeni Atlas prevent AI cheating and unauthorized assistance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Progeni Atlas utilizes a multi-layered anti-cheat framework including companion smartphone camera pairing for 360-degree room proctoring, gaze alignment verification, single-voice biometric tracking, and copy-paste telemetry without requiring intrusive surveillance software.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the pricing model for Progeni Atlas technical interviews?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Progeni Atlas uses a transparent duration-based billing convention where ₹1.00 equals 1 Credit. Screening is billed strictly at 1 Credit per 3 minutes of interview time (₹0.33 per minute). Every newly registered organization receives 2 complimentary demo screenings of up to 10 minutes each.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which engineering roles and technical tracks are supported?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Progeni Atlas supports Full-Stack Development, Backend Systems Engineering, Frontend Architecture, DevOps & Site Reliability Engineering (SRE), Machine Learning Engineering, System Design, and Data Structures & Algorithms.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Progeni Atlas integrate with enterprise ATS platforms?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Progeni Atlas provides native webhook and API integrations with enterprise Applicant Tracking Systems (ATS) including Greenhouse, Workday, and Lever, automatically synchronizing candidate invites and hiring dossiers.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}

