'use client';

import React from 'react';
import { CandidateEvaluationDossier } from '@/types/report';
import { ShieldCheck, Award, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

interface PDFDossierTemplateProps {
  dossier: CandidateEvaluationDossier;
}

export const PDFDossierTemplate: React.FC<PDFDossierTemplateProps> = ({ dossier }) => {
  return (
    <div id="pdf-printable-dossier" className="hidden print:block p-8 bg-white text-slate-900 font-sans space-y-6">
      
      {/* OFFICIAL HEADER */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">TalentPulse AI</h1>
          <p className="text-xs text-slate-600 font-mono">Official Verified Candidate Evaluation Dossier</p>
        </div>
        <div className="text-right font-mono text-xs text-slate-600">
          <p className="font-bold text-slate-900">VERIFICATION KEY: {dossier.verificationDossierId}</p>
          <p>Issued: {dossier.jobContext.interviewDate}</p>
        </div>
      </div>

      {/* CANDIDATE IDENTITY */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{dossier.candidate.fullName}</h2>
          <p className="text-xs text-slate-600">{dossier.candidate.program} • {dossier.candidate.academicYear}</p>
          <p className="text-xs text-slate-500 font-mono">{dossier.candidate.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono font-bold text-slate-700">{dossier.jobContext.roleTitle}</p>
          <p className="text-xs text-slate-600">{dossier.jobContext.companyName}</p>
          <span className="inline-block mt-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
            {dossier.hiringRecommendation} ({dossier.overallScore} / 100)
          </span>
        </div>
      </div>

      {/* COMPETENCY SCORES */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-1">Competency Pillars Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-medium">Algorithmic Problem Solving: <strong>{dossier.competencyPillars.algorithmicProblemSolving}%</strong></p>
          </div>
          <div>
            <p className="font-medium">System & Architecture Design: <strong>{dossier.competencyPillars.systemArchitecture}%</strong></p>
          </div>
          <div>
            <p className="font-medium">Code Quality & Best Practices: <strong>{dossier.competencyPillars.codeQualityAndSyntax}%</strong></p>
          </div>
          <div>
            <p className="font-medium">Communication & Clarity: <strong>{dossier.competencyPillars.communicationAndClarity}%</strong></p>
          </div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-1">Executive Summary</h3>
        <p className="text-xs text-slate-700 leading-relaxed">{dossier.executiveSummary}</p>
      </div>

      {/* STRENGTHS AND GROWTH */}
      <div className="grid grid-cols-2 gap-6 text-xs">
        <div>
          <h4 className="font-bold text-slate-900 border-b pb-1">Verified Strengths</h4>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 mt-2">
            {dossier.verifiedStrengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 border-b pb-1">Targeted Growth Areas</h4>
          <ul className="list-disc pl-4 space-y-1 text-slate-700 mt-2">
            {dossier.targetedGrowthAreas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* PROCTORING INTEGRITY */}
      <div className="p-3 bg-slate-50 border rounded text-xs font-mono text-slate-600 flex items-center justify-between">
        <span>PROCTORING AUDIT: {dossier.proctoringIntegritySummary.overallIntegrityScore}% INTEGRITY SCORE</span>
        <span>Gaze Focus: {dossier.proctoringIntegritySummary.gazeConsistencyPercentage}% | Tab Switches: {dossier.proctoringIntegritySummary.tabSwitchCount}</span>
      </div>

    </div>
  );
};
