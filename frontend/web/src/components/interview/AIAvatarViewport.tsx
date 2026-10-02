'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Sparkles, RefreshCw, Radio, UserCheck, Mic, Volume2, Video } from 'lucide-react';

export type AIState = 'listening' | 'thinking' | 'speaking';

interface Persona {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarUrl: string;
}

const HUMAN_PERSONAS: Persona[] = [
  {
    id: 'sarah-vance',
    name: 'Dr. Sarah Vance',
    role: 'Lead Systems Architect & AI Screener',
    company: 'TalentPulse Evaluation AI',
    avatarUrl: '/avatars/interviewer_female.jpg',
  },
  {
    id: 'alex-rivera',
    name: 'Alex Rivera',
    role: 'Staff Infrastructure Evaluator',
    company: 'TalentPulse Evaluation AI',
    avatarUrl: '/avatars/interviewer_male.jpg',
  },
];

interface AIAvatarViewportProps {
  aiState?: AIState;
  name?: string;
  role?: string;
}

export const AIAvatarViewport: React.FC<AIAvatarViewportProps> = ({
  aiState = 'speaking',
  name: propName,
  role: propRole,
}) => {
  const [selectedPersonaIndex, setSelectedPersonaIndex] = useState(0);
  const [waveHeights, setWaveHeights] = useState<number[]>([40, 75, 55, 90, 60, 80, 45, 70, 85, 50, 65, 95]);
  const [speakingZoom, setSpeakingZoom] = useState(1);

  const currentPersona = HUMAN_PERSONAS[selectedPersonaIndex];
  const personaName = propName && propName !== 'TalentPulse Evaluator' ? propName : currentPersona.name;
  const personaRole = propRole && propRole !== 'AI Technical Specialist' ? propRole : currentPersona.role;

  // ANIMATION WAVEFORM PULSE FOR HUMAN AI VOICE
  useEffect(() => {
    if (aiState !== 'speaking') return;
    const interval = setInterval(() => {
      setWaveHeights((prev) => prev.map(() => Math.floor(Math.random() * 70) + 25));
      setSpeakingZoom(1 + Math.random() * 0.02);
    }, 110);
    return () => clearInterval(interval);
  }, [aiState]);

  const togglePersona = () => {
    setSelectedPersonaIndex((prev) => (prev + 1) % HUMAN_PERSONAS.length);
  };

  return (
    <div className="relative w-full h-full min-h-[260px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col justify-between shadow-2xl backdrop-blur-md group select-none">
      
      {/* REALISTIC HUMAN AVATAR VIDEO STREAM CONTAINER */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="w-full h-full transition-transform duration-300 ease-out"
          style={{
            transform: aiState === 'speaking' ? `scale(${speakingZoom})` : 'scale(1)',
          }}
        >
          <img
            src={currentPersona.avatarUrl}
            alt={personaName}
            className={`w-full h-full object-cover object-center transition-filter duration-500 ${
              aiState === 'thinking' ? 'brightness-75 contrast-105 blur-[1px]' : 'brightness-100 contrast-100'
            }`}
          />
        </div>

        {/* Dynamic AI Speaking Aura Glow Overlay */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
            aiState === 'speaking'
              ? 'bg-gradient-to-t from-slate-950 via-slate-950/20 to-cyan-500/10 opacity-100'
              : aiState === 'thinking'
              ? 'bg-gradient-to-t from-slate-950 via-indigo-950/40 to-indigo-500/20 opacity-100'
              : 'bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-90'
          }`}
        ></div>

        {/* Subtle Scanline / Studio Camera Frame lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
      </div>

      {/* TOP HEADER: STATUS & CAMERA SPECS */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2">
        {/* AI STATUS BADGE */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/85 border border-slate-800/90 backdrop-blur-md text-xs font-mono shadow-lg">
          {aiState === 'speaking' ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
              <span className="text-cyan-300 font-semibold tracking-wide">Interviewer Speaking</span>
            </>
          ) : aiState === 'thinking' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-indigo-300 font-semibold tracking-wide">Evaluating Code...</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-200 font-semibold tracking-wide">Listening to Candidate</span>
            </>
          )}
        </div>

        {/* PERSONA SWITCHER & VAD ACTIVE BADGE */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePersona}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-slate-800 backdrop-blur-md text-slate-300 hover:text-cyan-300 font-mono text-[11px] transition-colors cursor-pointer shadow-md"
            title="Switch Human Interviewer Avatar"
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Switch Avatar</span>
          </button>

          <span className="hidden xs:inline-flex px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] backdrop-blur-md">
            HD 1080p • 60fps
          </span>
        </div>
      </div>

      {/* CENTER SCANNER OVERLAY FOR THINKING STATE */}
      {aiState === 'thinking' && (
        <div className="relative z-10 my-auto mx-auto flex flex-col items-center space-y-2 animate-fadeIn">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin flex items-center justify-center bg-slate-950/60 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <p className="text-xs font-mono font-semibold text-indigo-200 bg-slate-950/80 px-3 py-1 rounded-full border border-indigo-500/30">
            Analyzing Data & Technical Depth...
          </p>
        </div>
      )}

      {/* BOTTOM FOOTER: HUMAN NAME BADGE & SPECTRUM WAVEFORM */}
      <div className="relative z-10 p-3 sm:p-4 mt-auto bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
        {/* INTERVIEWER NAME & ROLE */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white drop-shadow-md flex items-center gap-1.5">
              <span>{personaName}</span>
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              AI Human Screener
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium drop-shadow-sm">{personaRole}</p>
        </div>

        {/* AUDIO WAVEFORM & VOLUME SPECTRUM */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80 backdrop-blur-md">
          <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="flex items-center gap-1 h-5 w-24 sm:w-28 justify-center">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-100 ${
                  aiState === 'speaking'
                    ? 'bg-gradient-to-t from-cyan-500 to-indigo-400 shadow-sm shadow-cyan-400/50'
                    : 'bg-slate-700 h-1.5'
                }`}
                style={{ height: aiState === 'speaking' ? `${h}%` : '6px' }}
              ></div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
