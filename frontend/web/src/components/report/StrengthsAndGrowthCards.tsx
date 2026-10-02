'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface StrengthsAndGrowthCardsProps {
  strengths?: string[];
  growthAreas?: string[];
}

export const StrengthsAndGrowthCards: React.FC<StrengthsAndGrowthCardsProps> = ({
  strengths = [
    'Kafka Partitioning: Correctly detailed sticky partition assignor tradeoffs and rebalancing triggers.',
    'Distributed Transactions: Articulated the Saga pattern versus two-phase commits with precise failure recovery steps.',
    'Database Optimization: Demonstrated practical knowledge of composite indexing and connection pool sizing.'
  ],
  growthAreas = [
    'Algorithmic Complexity Estimation: State time and space trade-offs explicitly prior to writing logic.',
    'Disaster Recovery Planning: Detail automated failover policies and read-replica lag mitigations during distributed outages.'
  ]
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* LEFT CARD: VERIFIED TECHNICAL STRENGTHS */}
      <div className="md:col-span-1 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-100">Verified Technical Strengths</h3>
        </div>

        <ul className="space-y-3 text-xs text-slate-300">
          {strengths.map((item, idx) => {
            const parts = item.split(':');
            const title = parts[0];
            const body = parts.slice(1).join(':');
            return (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">
                  <strong className="text-slate-100 font-semibold">{title}:</strong>
                  {body}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* RIGHT CARD: TARGETED GROWTH AREAS */}
      <div className="md:col-span-1 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-100">Targeted Growth Areas</h3>
        </div>

        <ul className="space-y-3 text-xs text-slate-300">
          {growthAreas.map((item, idx) => {
            const parts = item.split(':');
            const title = parts[0];
            const body = parts.slice(1).join(':');
            return (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-amber-400 font-bold mt-0.5">•</span>
                <span className="leading-relaxed">
                  <strong className="text-slate-100 font-semibold">{title}:</strong>
                  {body}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
