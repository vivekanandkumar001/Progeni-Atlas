import React from 'react';
import type { Metadata } from 'next';
import { LegalShell, LegalSection, LegalBullets } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Natural Language Search: What It Is, How It Works & NLU vs NLP (2026 Guide)',
  description:
    'Natural language search lets you query in plain English instead of keywords. Learn how NLP, NLU and NLG work, how they power AI voice interviews and candidate screening at Progeni Atlas, and when to use it.',
  alternates: {
    canonical: 'https://atlas.progeni.live/insights/natural-language-search',
  },
  openGraph: {
    title: 'Natural Language Search — How It Works (NLU vs NLP vs NLG)',
    description:
      'Plain-English search explained: definitions, a working example, comparison of NLP/NLU/NLG, and how Progeni Atlas uses it for AI technical interviews.',
    url: 'https://atlas.progeni.live/insights/natural-language-search',
    type: 'article',
  },
};

const FAQ_ITEMS = [
  {
    question: 'What is natural language search?',
    answer:
      'Natural language search is a way of finding information by typing or speaking full human questions — such as “senior backend developers who know Kafka” — instead of keywords and operators. The engine uses NLP to parse the sentence and NLU to extract intent and entities, then returns ranked results or a direct answer.',
  },
  {
    question: 'What is the difference between NLP and NLU?',
    answer:
      'NLP (Natural Language Processing) is the broad field that turns human language into machine-readable form — tokenization, parsing, classification, translation, summarisation. NLU (Natural Language Understanding) is the subset focused on meaning — intent classification, entity/slot extraction and sentiment. In short: NLP prepares language data; NLU works out what the user actually wants.',
  },
  {
    question: 'What is NLG and how does it relate?',
    answer:
      'NLG (Natural Language Generation) produces human-sounding text or speech from structured data — answers, summaries and follow-up questions. NLP reads, NLU understands, NLG writes. Progeni Atlas uses all three: NLU reads a candidate’s spoken answer, NLP structures it, and the interviewer speaks adaptive follow-ups via NLG.',
  },
  {
    question: 'Where is natural language search used?',
    answer:
      'Search engines (semantic and conversational search), chatbots and voice assistants, customer support, analytics databases, and hiring platforms. In technical hiring it powers resume-to-job semantic matching without exact keyword overlap, interview transcription, rubric scoring and natural-language filtering of candidate dossiers.',
  },
  {
    question: 'How does Progeni Atlas use NLP and NLU?',
    answer:
      'Spoken answers are transcribed (STT/ASR), questions are synthesised from the role, JD and resume, each turn is scored by a rubric-conditioned LLM judge, and candidate dossiers are built from the evaluated turns. Resumes and questions are matched semantically via vector search so phrasing differences do not break evaluation.',
  },
  {
    question: 'Can natural language search replace keyword search?',
    answer:
      'It complements it. Keywords are fast and exact (SKU codes, names, IDs); natural language excels at intent-heavy, ambiguous queries (“who is best for our infra team?”). Production systems, including Progeni Atlas, use both — exact filters for precision, semantic/NLP for meaning — and rank results with structured rubrics rather than raw text matches.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://atlas.progeni.live/insights/natural-language-search#faq',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

const ARTICLE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': 'https://atlas.progeni.live/insights/natural-language-search#article',
  headline: 'Natural Language Search: What It Is, How It Works & NLU vs NLP vs NLG',
  description:
    'A plain-English guide to natural language search, the difference between NLP, NLU and NLG, and how Progeni Atlas applies them to AI technical interviews.',
  author: { '@type': 'Organization', name: 'Progeni Atlas', url: 'https://atlas.progeni.live' },
  publisher: { '@id': 'https://atlas.progeni.live/#organization' },
  mainEntityOfPage: 'https://atlas.progeni.live/insights/natural-language-search',
  datePublished: '2026-11-15',
  dateModified: '2026-11-15',
};

const TOC = [
  { id: 'what', label: '1. What is natural language search?' },
  { id: 'nlp-nlu-nlg', label: '2. NLP vs NLU vs NLG — the difference' },
  { id: 'how', label: '3. How natural language search works' },
  { id: 'examples', label: '4. Real-world examples' },
  { id: 'progeni', label: '5. How Progeni Atlas uses NLP & NLU' },
  { id: 'faq', label: 'FAQ' },
];

export default function NaturalLanguageSearchPage() {
  return (
    <LegalShell
      kicker="Insights · AI & NLP"
      title="Natural Language Search, Explained"
      summary="How plain-English, spoken and chat-style queries work — and how Progeni Atlas applies NLP, NLU and vector search to AI technical interviews and hiring."
      lastUpdated="15 November 2026"
      toc={TOC}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSON_LD) }}
      />

      <LegalSection id="what" title="1. What is natural language search?">
        <p>
          <strong>Natural language search lets you ask for things in full, everyday sentences — “show me candidates with
          two years of React experience who ace system design” — instead of keywords and filters.</strong> The system uses
          Natural Language Processing (NLP) to read the sentence and Natural Language Understanding (NLU) to extract the
          intent and the entities inside it (skills, seniority, years, domains), then ranks results by meaning rather than
          by literal word match. Voice assistants, modern search engines, chatbots and AI hiring tools are all natural
          language search systems under the hood.
        </p>
      </LegalSection>

      <LegalSection id="nlp-nlu-nlg" title="2. NLP vs NLU vs NLG — the difference">
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-surface-2 text-ink">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Layer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">What it does</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Examples of tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink-muted">
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">NLP<br /><span className="text-[11px] font-normal">Natural Language Processing</span></td>
                <td className="px-4 py-3">The whole pipeline: turning unstructured language into structured, machine-readable data.</td>
                <td className="px-4 py-3">Tokenization, POS tagging, parsing, classification, translation, summarisation, NER.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">NLU<br /><span className="text-[11px] font-normal">Natural Language Understanding</span></td>
                <td className="px-4 py-3">The “meaning” subset: figuring out what the user wants and what they mentioned.</td>
                <td className="px-4 py-3">Intent classification, entity/slot extraction, sentiment, coreference resolution.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">NLG<br /><span className="text-[11px] font-normal">Natural Language Generation</span></td>
                <td className="px-4 py-3">The output side: writing human-sounding text or speech from structured data.</td>
                <td className="px-4 py-3">Answer generation, summaries, follow-up questions, conversational replies.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Rule of thumb: <strong>NLP reads, NLU understands, NLG writes.</strong> A system that only scrapes keywords is not
          doing natural language search — it is doing pattern matching.
        </p>
      </LegalSection>

      <LegalSection id="how" title="3. How natural language search works, step by step">
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Capture &amp; normalise</strong> — speech is transcribed (ASR/STT) or text is cleaned, lower-cased, punctuation-normalised.</li>
          <li><strong>Tokenise &amp; parse</strong> — the sentence becomes tokens; a parser builds its grammatical structure (NPS parsing).</li>
          <li><strong>Understand (NLU)</strong> — an intent classifier labels the goal (“find candidates”, “interview me”); entity extractors pull skills, roles, years, companies, locations.</li>
          <li><strong>Retrieve</strong> — the query is embedded into a vector and compared against an index (semantic/vector search) or matched against a knowledge graph, often combined with exact filters.</li>
          <li><strong>Rank &amp; answer</strong> — results are scored for relevance; NLG composes a natural-language answer or a structured list.</li>
          <li><strong>Learn</strong> — click/outcome feedback re-weights the ranker over time.</li>
        </ol>
      </LegalSection>

      <LegalSection id="examples" title="4. Real-world examples">
        <LegalBullets
          items={[
            'Google’s AI Mode and Bing Copilot answer “how to structure a system design interview” directly instead of returning ten links.',
            'ChatGPT, Claude and Perplexity treat every prompt as a natural-language query over retrieved web content.',
            'Voice assistants execute tasks (“what’s on my calendar at 3?”) from free-form speech.',
            'Customer-support search (Zendesk AI, Intercom) resolves “where is my refund?” to a solved ticket.',
            'Hiring platforms match resumes to job descriptions semantically — no keyword overlap required.',
          ]}
        />
      </LegalSection>

      <LegalSection id="progeni" title="5. How Progeni Atlas uses NLP & NLU">
        <p>
          Progeni Atlas runs a full natural-language pipeline around every interview — this page is the honest,
          mechanism-level description (see <a href="/ai-transparency" className="text-accent-cyan hover:underline">AI Transparency</a> for scoring details):
        </p>
        <LegalBullets
          items={[
            'Speech-to-text (STT) transcribes candidate answers in real time; the transcript is the raw input to NLP.',
            'NLG generates adaptive follow-up questions on the fly from the job description, your resume and the current stage of the interview — never a static question bank.',
            'Each turn is scored by a rubric-conditioned LLM judge for relevance, depth and correctness — this is NLU applied to evaluation, not to simple keyword checks.',
            'Resumes and questions are matched semantically (vector search) against the job description, so phrasing (“Kafka” vs “Apache Kafka”) does not change the evaluation.',
            'The final calibrated dossier is aggregated from the evaluated turns — a structured, auditable artifact for recruiters.',
          ]}
        />
        <p className="mt-4">
          Want to experience natural language understanding in an actual interview?{' '}
          <a href="/register" className="text-accent-cyan hover:underline">Start a free practice interview</a> or{' '}
          <a href="/services" className="text-accent-cyan hover:underline">explore the AI hiring suite</a>.
        </p>
      </LegalSection>

      <LegalSection id="faq" title="Frequently Asked Questions">
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{item.question}</h3>
              <p className="mt-2 text-[13px] leading-6 text-ink-muted">{item.answer}</p>
            </div>
          ))}
        </div>
      </LegalSection>
    </LegalShell>
  );
}
