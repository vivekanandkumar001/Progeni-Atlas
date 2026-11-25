'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaSource } from '@/lib/media/MediaSourceProvider';
import { apiFetch, fetchCandidateProfile, isValidSessionId } from '@/lib/api';
import { formatCredits, formatRatePerMinute } from '@/lib/billing';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building2,
  RefreshCw,
  Info,
  AlertTriangle,
  Smartphone,
  Coins,
  Sparkles,
  ExternalLink } from 'lucide-react';

import type { NetworkCheckStatus } from './NetworkJitterGauge';

export type CheckStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'NEEDS_CHANGE';

interface InterviewBriefingCardProps {
  sessionId: string;
  /** Server-authoritative interview mode. Defaults to 'real' (strictest gates). */
  mode?: string;
  isCameraPassed?: boolean;
  isMicPassed?: boolean;
  isSpeakerPassed: boolean;
  speakerStatus?: CheckStatus;
  isNetworkPassed: boolean;
  networkStatus?: NetworkCheckStatus;
  networkMessage?: string;
  selectedAudioDevice?: string;
  selectedVideoDevice?: string;
  latencyMs?: number;
  jitterMs?: number;
}

export const InterviewBriefingCard: React.FC<InterviewBriefingCardProps> = ({
  sessionId,
  mode = 'real',
  isSpeakerPassed,
  speakerStatus = 'PENDING',
  isNetworkPassed,
  networkStatus = 'PENDING',
  networkMessage,
  selectedAudioDevice = 'Default Microphone',
  selectedVideoDevice = 'Integrated Webcam',
  latencyMs = 28,
  jitterMs = 4,
}) => {
  const router = useRouter();
  const { stream, source, liveKitConnected, audioUnlocked } = useMediaSource();

  const [agreed, setAgreed] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [droppedTrackError, setDroppedTrackError] = useState<string | null>(null);

  // Server-authoritative briefing metadata (job role, org, real resume + the
  // resume-parsed skills). Fetched instead of hardcoding a fake resume card.
  interface LobbyBilling {
    ratePerMinuteCredits?: number;
    chargingEnabled?: boolean;
    isDemoEligible?: boolean;
    freeDemosTotal?: number;
    freeDemosUsed?: number;
    freeDemosRemaining?: number;
    candidateWalletBalance?: number;
    billingNotice?: string;
  }
  interface LobbyInfo {
    jobRole?: string;
    companyName?: string;
    candidateName?: string;
    scheduledAt?: string | null;
    durationMinutes?: number | null;
    hasResume?: boolean;
    resumeFileName?: string | null;
    resumeStatus?: string | null;
    resumeKeyHighlights?: string[];
    resumeHighlightsSource?: 'resume' | 'profile-skills' | 'unavailable' | string;
    billing?: LobbyBilling;
  }
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [isDemoProfile, setIsDemoProfile] = useState(false);

  useEffect(() => {
    if (!isValidSessionId(sessionId)) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/interview-sessions/${sessionId}/lobby-info`);
        if (!res.ok) return;
        const data = (await res.json()) as LobbyInfo;
        if (active) setLobbyInfo(data);
        // Never invent billing values. Missing fields stay missing so the UI
        // renders an explicit "unavailable" state instead of false credits.
      } catch (err) {
        console.error('[InterviewBriefingCard] Lobby info API error:', err);
        // Leave lobbyInfo null — UI falls back to honest copy below
      } finally {
        active = false;
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId]);

  // Demo profiles are labelled read-only; seeded values are blanked upstream.
  useEffect(() => {
    let active = true;
    void fetchCandidateProfile()
      .then((profile) => {
        if (active) setIsDemoProfile(Boolean(profile?.isDemoProfile));
      })
      .catch(() => {
        if (active) setIsDemoProfile(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const scheduleLabel = React.useMemo(() => {
    const scheduled = lobbyInfo?.scheduledAt;
    if (scheduled) {
      const date = new Date(scheduled);
      if (!Number.isNaN(date.getTime())) {
        return `Scheduled ${date.toLocaleString()}`;
      }
    }
    if (typeof lobbyInfo?.durationMinutes === 'number' && lobbyInfo.durationMinutes > 0) {
      return `${lobbyInfo.durationMinutes}-minute session`;
    }
    return null;
  }, [lobbyInfo?.scheduledAt, lobbyInfo?.durationMinutes]);

  // Parsed resume lines can contain control characters from PDF text layers.
  // Strip them before rendering; never show raw DEL/ESC glyphs to a candidate.
  const resumeHighlights = (lobbyInfo?.resumeKeyHighlights || [])
    .map((anchor) => String(anchor).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const hasResume = lobbyInfo?.hasResume === true;
  const highlightsLabel =
    lobbyInfo?.resumeHighlightsSource === 'resume'
      ? 'Extracted from your resume:'
      : lobbyInfo?.resumeHighlightsSource === 'profile-skills'
        ? 'From your listed profile skills:'
        : 'Discussion context:';

  // Derive camera & mic gates strictly from active live tracks on the stream
  const hasLiveVideo = !!stream?.getVideoTracks().some((t) => t.readyState === 'live');
  const hasLiveAudio = !!stream?.getAudioTracks().some((t) => t.readyState === 'live');

  const effectiveSpeakerPassed = isSpeakerPassed || speakerStatus === 'PASSED';
  const effectiveNetworkPassed = isNetworkPassed || networkStatus === 'PASSED';

  // Real interviews publish through LiveKit; practice sessions run on the
  // local media pipeline and must never be blocked on a LiveKit connection.
  const needsLiveKit = mode !== 'practice';

  // Relaxed hardware check: require video + audio, make LiveKit a soft
  // requirement (real mode warns but does not block), and speaker/network
  // as advisory. This allows candidates to enter with local camera/microphone
  // even when LiveKit is unavailable, while still guiding toward full setup.
  const hasCoreHardware = hasLiveVideo && hasLiveAudio && audioUnlocked;
  const liveKitOk = true; // Always allow launch; room will warn if LiveKit not connected
  const speakerOk = effectiveSpeakerPassed; // advisory only
  const networkOk = effectiveNetworkPassed; // advisory only
  const isAllHardwareReady = hasCoreHardware; // core: video + audio + unlocked
  // Real interview billing: only authoritative values can block launch.
  // A missing wallet balance is "unknown", never "40 credits" and never "0".
  const billing = lobbyInfo?.billing;
  const candidateWalletBalance =
    typeof billing?.candidateWalletBalance === 'number' && Number.isFinite(billing.candidateWalletBalance)
      ? billing.candidateWalletBalance
      : null;
  const billingUnavailable =
    !billing ||
    candidateWalletBalance === null ||
    typeof billing.chargingEnabled !== 'boolean' ||
    (billing.isDemoEligible === false && typeof billing.ratePerMinuteCredits !== 'number');
  const isZeroBalance = !billing?.isDemoEligible
    && billing?.chargingEnabled === true
    && candidateWalletBalance !== null
    && candidateWalletBalance <= 0;
  const isLowBalance =
    !billing?.isDemoEligible &&
    billing?.chargingEnabled === true &&
    candidateWalletBalance !== null &&
    candidateWalletBalance > 0 &&
    candidateWalletBalance <= 10;
  const lowBalanceValue = candidateWalletBalance ?? 0;
  const isLaunchEnabled = isAllHardwareReady && agreed && !isZeroBalance;

  const handleLaunchInterview = async () => {
    setDroppedTrackError(null);

    // Re-verify that every required track is actually 'live' right now
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];

    if (!videoTrack || videoTrack.readyState !== 'live') {
      setDroppedTrackError(
        'Camera feed disconnected or inactive. Please re-check your webcam or phone connection before entering.'
      );
      return;
    }

    if (!audioTrack || audioTrack.readyState !== 'live') {
      setDroppedTrackError(
        'Microphone feed disconnected or inactive. Please re-check your microphone before entering.'
      );
      return;
    }

    if (!audioUnlocked) {
      setDroppedTrackError('Interviewer audio is locked by your browser. Tap "Enable Camera, Microphone & Interview Audio" first.');
      return;
    }

    if (!isLaunchEnabled) return;
    if (!isValidSessionId(sessionId)) {
      setDroppedTrackError('Cannot launch room: interview session ID is invalid.');
      return;
    }

    setIsLaunching(true);
    try {
      // Real mode requires fullscreen during the interview. Request it here,
      // inside the launch click (a user gesture), so the room's preflight
      // finds it already granted. Best-effort: the room re-checks and shows an
      // explicit start gate if fullscreen was denied.
      if (needsLiveKit && typeof document !== 'undefined' && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen?.();
        } catch {
          // Non-fatal – the room's real-mode start gate will ask again.
        }
      }

      // POST relative /api/v1/interview-sessions/:id/lobby-checkin
      const res = await apiFetch(`/api/v1/interview-sessions/${sessionId}/lobby-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGiven: true,
          consentVersion: '1.0-lobby-checklist',
          hardwareDiagnostic: {
            cameraPassed: hasLiveVideo,
            microphonePassed: hasLiveAudio,
            speakerPassed: effectiveSpeakerPassed,
            mediaSource: source, // 'local' | 'phone'
            latencyMs: latencyMs,
            jitterMs: jitterMs,
            selectedAudioDevice:
              source === 'phone' ? 'Phone Companion Microphone' : selectedAudioDevice,
            selectedVideoDevice:
              source === 'phone' ? 'Phone Companion Camera' : selectedVideoDevice,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402 || data.error_code === 'INSUFFICIENT_CREDITS') {
          throw new Error(data.message || data.error || 'Insufficient wallet credits to reserve this interview. Please recharge your wallet.');
        }
        throw new Error(data.error || data.detail || `Check-in failed (HTTP ${res.status}). Please retry.`);
      }
      const data = await res.json();
      router.push(data.targetUrl || `/candidate/interview/${sessionId}/room`);
    } catch (err) {
      setDroppedTrackError(err instanceof Error ? err.message : 'Check-in unavailable. Please retry.');
    } finally {
      setIsLaunching(false);
    }
  };

  const getPendingReason = () => {
    if (!hasLiveVideo) {
      return source === 'phone'
        ? 'Phone video feed pending connection.'
        : 'Webcam feed verification pending. (Use phone if desktop has no camera).';
    }
    if (!hasLiveAudio) {
      return 'Microphone audio calibration pending.';
    }
    if (!audioUnlocked) {
      return 'Interviewer audio playback needs explicit unlock. Tap "Enable Camera, Microphone & Interview Audio".';
    }
    if (!effectiveSpeakerPassed) {
      return 'Speaker chime confirmation pending. Tap "Yes, Sounds Good".';
    }
    if (!effectiveNetworkPassed) {
      if (networkStatus === 'RUNNING') return 'Measuring network round-trip timing...';
      if (networkStatus === 'FAILED') return networkMessage || `Network latency too high (${latencyMs} ms RTT).`;
      if (networkStatus === 'ERROR') return networkMessage || 'Network health check error.';
      return 'Network reachability check pending.';
    }
    // LiveKit is now a soft requirement - always allow launch, but inform candidate
    if (needsLiveKit && !liveKitConnected) return 'LiveKit not connected (real-mode interview). Using local media instead.';
    if (!agreed) return 'Please check the consent checkbox to proceed.';
    if (isZeroBalance) return 'Your wallet balance is 0 Credits. Please recharge your wallet to enter the interview.';
    return '';
  };


  return (
    <div className="space-y-6">
      {/* METADATA HEADER */}
      <div className="space-y-1">
        <p className="text-caption font-mono uppercase text-accent-cyan tracking-wider">
          TECHNICAL SCREENING LOBBY
        </p>
        <h2 className="text-heading font-bold text-ink text-2xl">
          {lobbyInfo?.jobRole ? lobbyInfo.jobRole : 'Technical Interview'}
        </h2>
        <p className="text-body text-ink-muted text-sm flex items-center gap-2 pt-0.5 flex-wrap">
          <Building2 className="w-4 h-4 text-accent-cyan shrink-0" />
          <span className="text-ink font-medium">
            {lobbyInfo?.companyName || 'Hiring organization'}
          </span>
          {scheduleLabel && (
            <>
              <span className="text-ink-faint">&bull;</span>
              <Clock className="w-4 h-4 text-ink-muted shrink-0" />
              <span>{scheduleLabel}</span>
            </>
          )}
        </p>
      </div>

      {isDemoProfile && (
        <div className="p-3 rounded-xl border border-accent-amber/35 bg-accent-amber/10 text-[11px] text-ink flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 text-accent-amber mt-0.5" />
          <span>
            Demo profile: seeded biography and links are hidden. Discussion context comes only from your own resume or listed skills.
          </span>
        </div>
      )}

      {/* ACTIVE MEDIA SOURCE BADGE */}
      {source === 'phone' && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-ink flex items-center gap-2 shadow-sm">
          <Smartphone className="w-4 h-4 text-accent-cyan shrink-0" />
          <span>
            Paired with Smartphone: Audio &amp; video will be ingested from your phone.
          </span>
        </div>
      )}

      {/* SESSION BILLING & CREDIT QUOTA BADGE */}
      {billingUnavailable ? (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-accent-amber border border-amber-500/20">
              <Coins className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm">Billing details unavailable</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Credits and demo eligibility could not be confirmed. No count is shown here; the interview service will verify eligibility before launch.
              </p>
            </div>
          </div>
          <a
            href="/candidate/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-accent-cyan hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Manage Wallet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : billing ? (
        (() => {
          const isDemo = billing.isDemoEligible === true;
          const isFreeTier = !isDemo && billing.chargingEnabled === false;
          const quotaLabel = typeof billing.freeDemosRemaining === 'number' && Number.isFinite(billing.freeDemosRemaining)
            ? `Free Demo Interview (${Math.max(0, billing.freeDemosRemaining)} Available)`
            : 'Free Demo Interview (quota unavailable)';
          const rateLabel = formatRatePerMinute(billing.ratePerMinuteCredits);
          const sessionLabel = typeof lobbyInfo?.durationMinutes === 'number' && lobbyInfo.durationMinutes > 0
            ? `${lobbyInfo.durationMinutes} MIN SESSION`
            : 'Duration unavailable';

          return (
            <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all ${
              isDemo
                ? 'bg-emerald-500/10 border-emerald-500/30 text-ink'
                : isFreeTier
                ? 'bg-violet-500/10 border-violet-500/30 text-ink'
                : 'bg-cyan-500/10 border-cyan-500/30 text-ink'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isDemo
                    ? 'bg-emerald-500/10 text-accent-emerald border border-emerald-500/20'
                    : isFreeTier
                    ? 'bg-violet-500/10 text-accent-violet border border-violet-500/20'
                    : 'bg-cyan-500/10 text-accent-cyan border border-cyan-500/20'
                }`}>
                  {isDemo ? <Sparkles className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink text-sm">
                      {isDemo
                        ? quotaLabel
                        : isFreeTier
                        ? 'Evaluation Tier (no customer charge)'
                        : `Pay-as-you-go: ${rateLabel}`}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isDemo
                        ? 'bg-emerald-500/20 text-accent-emerald border border-emerald-500/40'
                        : isFreeTier
                        ? 'bg-violet-500/20 text-accent-violet border border-violet-500/40'
                        : 'bg-cyan-500/20 text-accent-cyan border border-cyan-500/40'
                    }`}>
                      {isDemo ? 'Free demo' : isFreeTier ? 'No charge' : '₹1 = 1 credit'}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {billing.billingNotice || (isDemo
                      ? 'Free demo quota applies to this session.'
                      : isFreeTier
                        ? 'This evaluation tier does not charge your wallet.'
                        : 'Charged from your wallet at the server-provided rate.')}
                  </p>
                </div>
              </div>
              <div className="sm:text-right shrink-0 flex items-center sm:flex-col justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                <span className="font-mono font-bold text-xs text-ink">
                  {isDemo ? sessionLabel : isFreeTier ? 'No charge' : `${formatCredits(candidateWalletBalance ?? 0)} Balance`}
                </span>
                <a
                  href="/candidate/wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-accent-cyan hover:underline flex items-center gap-1"
                >
                  <span>Manage Wallet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })()
      ) : null}

      {/* RESUME SNAPSHOT CARD – renders only real, server-provided resume data. */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-line pb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-accent-cyan shrink-0" />
            <span className="text-body font-medium text-ink text-sm truncate">
              {hasResume ? (lobbyInfo?.resumeFileName || 'Resume') : 'No resume on file'}
            </span>
          </div>
          {lobbyInfo?.resumeFileName && (
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan font-mono text-[11px] shrink-0">
              {lobbyInfo.resumeStatus || 'PARSED'}
            </span>
          )}
        </div>

        {hasResume ? (
          <div className="space-y-2">
            <p className="text-caption text-ink-muted text-xs font-mono">
              {highlightsLabel}
            </p>
            {resumeHighlights.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {resumeHighlights.map((anchor, index) => (
                  <span
                    key={`${index}-${anchor.slice(0, 32)}`}
                    className="px-2.5 py-1 rounded-lg bg-inset border border-line text-xs text-ink font-medium"
                  >
                    {anchor}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-caption text-ink-muted text-[11px]">
                Your resume is parsed. Topic anchors will appear once skills are extracted.
              </p>
            )}
          </div>
        ) : (
          <p className="text-caption text-ink-muted text-[11px] leading-tight">
            No resume is on file yet. Upload one from your profile so the interviewer can tailor
            resume-probe questions to your background.
          </p>
        )}

        <p className="text-caption text-ink-muted text-[11px] leading-tight">
          The AI interviewer adapts technical questions to the role requirements and the profile context shown above.
        </p>
      </div>

      {/* AI TRANSPARENCY — READ THIS BEFORE YOU BEGIN */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <ShieldCheck className="w-5 h-5 text-accent-cyan" />
          <h3 className="text-sm font-bold text-ink">Before you begin — what this is</h3>
        </div>

        <ul className="space-y-2.5 text-xs text-ink">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span><strong>You&apos;ll be interviewed by Sarah — an AI</strong>, not a secret human. She is disclosed on purpose; you deserve to know.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span><strong>What she listens for:</strong> how you think, how you build, how you work with people — scored against the role rubric, with exact quotes kept as evidence.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span><strong>What she never judges:</strong> your face, your eyes, your emotion, your accent, or how confident you sound. There is no camera analysis.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span><strong>What the team sees:</strong> your answers, your code, and simple counts of tab switches / pastes — facts, not verdicts. A human reviews everything before any decision.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span><strong>Your rights:</strong> you can ask for a human review or an alternative assessment at any time, and you can reschedule — just tell us. Details in the <a href="/ai-transparency" target="_blank" className="text-accent-cyan hover:underline">AI Transparency &amp; AEDT Notice</a>.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
            <span>Speak naturally — pauses are thinking, not failure. If you need a moment or a rephrase, just say so.</span>
          </li>
        </ul>

        {/* CONSENT & VERIFICATION CHECKBOX (MENTIONS PHONE CAMERA/MIC & RECORDING) */}
        <label className="flex items-start gap-3 pt-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded bg-inset border-line-strong text-cyan-500 focus:ring-cyan-500 cursor-pointer"
          />
          <span className="text-xs text-ink leading-tight">
            I understand Sarah is an AI interviewer, my answers are recorded and reviewed by a human, and I agree
            to take the interview on camera per the{' '}
            <a href="/ai-transparency" target="_blank" className="text-accent-cyan hover:underline">AI Transparency &amp; AEDT Notice</a>.
            <span className="text-accent-rose font-bold ml-1">*</span>
          </span>
        </label>

        {/* TRACK DROPPED ERROR ALERT */}
        {droppedTrackError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-accent-rose text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-rose shrink-0 mt-0.5" />
            <p className="leading-relaxed">{droppedTrackError}</p>
          </div>
        )}

        {/* ZERO BALANCE WARNING */}
        {isZeroBalance ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 text-accent-amber text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-accent-amber">Insufficient Wallet Balance (0 Credits)</p>
              <p className="text-ink-muted mt-0.5">
                Your wallet balance is zero. You cannot enter practice or paid interviews without credits.
              </p>
              <a
                href="/candidate/wallet"
                className="inline-flex items-center gap-1 font-semibold text-accent-cyan hover:underline mt-1.5"
              >
                Recharge Wallet 
              </a>
            </div>
          </div>
        ) : isLowBalance ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 text-accent-amber text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-accent-amber">Low Wallet Balance</p>
              <p className="text-ink-muted mt-0.5">
                Your wallet balance is low ({formatCredits(lowBalanceValue)}). You have enough for {Math.max(1, Math.floor(lowBalanceValue / 2))} more practice interview(s). Please recharge your wallet to continue.
              </p>
              <a
                href="/candidate/wallet"
                className="inline-flex items-center gap-1 font-semibold text-accent-cyan hover:underline mt-1.5"
              >
                Recharge Wallet 
              </a>
            </div>
          </div>
        ) : null}

        {/* PENDING TOOLTIP / REASON */}
        {!isLaunchEnabled && !isZeroBalance && (
          <p className="text-[11px] font-mono text-accent-amber bg-amber-500/10 p-2.5 rounded-xl flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-accent-amber shrink-0" />
            <span>Pending requirement: {getPendingReason()}</span>
          </p>
        )}

        {/* GATED LAUNCH ACTION CTA */}
        <button
          type="button"
          onClick={handleLaunchInterview}
          disabled={!isLaunchEnabled || isLaunching}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            isLaunchEnabled
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white hover:scale-[1.01] shadow-lg shadow-cyan-500/25 active:scale-[0.99]'
              : 'bg-inset border border-line text-ink-muted opacity-50 cursor-not-allowed'
          }`}
        >
          {isLaunching ? (
            <RefreshCw className="w-4 h-4 animate-spin text-ink" />
          ) : isZeroBalance ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              <span>Recharge Required (0 Credits)</span>
            </>
          ) : isLowBalance ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              <span>Low Balance ({formatCredits(lowBalanceValue)})</span>
            </>
          ) : (
            <>
              <span>Enter Video Interview Room</span>
              </>
          )}
        </button>
      </div>
    </div>
  );
};