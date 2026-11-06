"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";
import { FRONTEND_CONFIG } from "@/lib/config";

interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export function ProctoringIndicator() {
  const [attentionScore, setAttentionScore] = useState(100);
  const [warnings, setWarnings] = useState(0);
  const [_isDetected, setIsDetected] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerType | null>(null);

  useEffect(() => {
    let disposed = false;

    async function initDetector() {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        if (disposed) return;
        const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/tasks-vision/wasm");
        if (disposed) return;
        const loaded = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FRONTEND_CONFIG.mediaPipeFaceModelUrl },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (disposed) {
          loaded.close();
          return;
        }
        landmarkerRef.current = loaded;
      } catch (err) {
        console.warn("Proctoring indicator detector initialization failed:", err);
      }
    }

    initDetector();

    return () => {
      disposed = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {}
        landmarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let lastTimestamp = 0;
    let animationId: number;

    const annotateFrame = async (timestamp: number) => {
      if (timestamp - lastTimestamp < 100) {
        animationId = requestAnimationFrame(annotateFrame);
        return;
      }

      const video = videoRef.current;
      const detector = landmarkerRef.current;

      if (video && detector && video.readyState >= 2) {
        try {
          const result = detector.detectForVideo(video, timestamp);
          const faces = result.faceLandmarks ?? [];

          if (faces.length > 0) {
            const landmarks = faces[0];
            const ear = calculateEyeAspectRatio(landmarks);
            const mar = calculateMouthAspectRatio(landmarks);
            const headPose = calculateHeadPose(landmarks);

            let score = 100;
            const flags: string[] = [];

            if (ear < 0.2) {
              score -= 30;
              flags.push("eyes_closed");
            }
            if (Math.abs(headPose) > 25) {
              score -= 25;
              flags.push("head_turned");
            }
            if (mar > 0.8) {
              score -= 10;
              flags.push("mouth_open");
            }

            score = Math.max(0, Math.min(100, score));
            setAttentionScore(score);

            if (score < 30 || flags.length > 0) {
              setWarnings((prev) => prev + (score < 30 ? 1 : 0) + flags.length);
            }

            setIsDetected(score > 0);
          } else {
            setIsDetected(false);
            setAttentionScore(0);
            setWarnings((prev) => prev + 1);
          }
        } catch (e) {
          console.error("Proctoring detection error:", e);
        }
      }

      lastTimestamp = timestamp;
      animationId = requestAnimationFrame(annotateFrame);
    };

    animationId = requestAnimationFrame(annotateFrame);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const indicatorColor =
    attentionScore < 30 ? "red" : attentionScore < 70 ? "orange" : "green";
  const warningStatus = warnings >= 5 ? "⚠️ FLAGGED" : "";

  return (
    <div className="proctoring-indicator">
      <div className="attention-score">{attentionScore}%</div>
      <div className="indicator-dot" style={{ backgroundColor: indicatorColor }} />
      {warningStatus && <div className="warning-count">{warningStatus}</div>}
      <video ref={videoRef} autoPlay playsInline muted />
    </div>
  );
}

function calculateEyeAspectRatio(landmarks: Landmark[]): number {
  const v1 = distance(landmarks[159], landmarks[145]);
  const v2 = distance(landmarks[158], landmarks[144]);
  const v3 = distance(landmarks[157], landmarks[146]);
  const v4 = distance(landmarks[156], landmarks[148]);
  const h = distance(landmarks[39], landmarks[37]);
  return h === 0 ? 0 : (v1 + v2 + v3 + v4) / (4.0 * h);
}

function calculateMouthAspectRatio(landmarks: Landmark[]): number {
  const v = distance(landmarks[14], landmarks[18]);
  const h = distance(landmarks[13], landmarks[19]);
  return h === 0 ? 0 : v / h;
}

function calculateHeadPose(landmarks: Landmark[]): number {
  const noseTip = landmarks[1];
  const leftEar = landmarks[78];
  const rightEar = landmarks[324];
  if (!noseTip || !leftEar || !rightEar) return 0;
  return (noseTip.y - (leftEar.y + rightEar.y) / 2) * 0.1;
}

function distance(p1?: Landmark, p2?: Landmark): number {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}