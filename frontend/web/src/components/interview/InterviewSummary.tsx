"use client";

import { useEffect, useState } from "react";

interface SummaryProps {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
}

interface SummaryData {
  strengths?: string;
  weaknesses?: string;
  recommendation?: string;
  confidence_score?: number;
}

export function InterviewSummary({ sessionId, visible, onClose }: SummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !sessionId) return;

    setLoading(true);
    setError(null);

    // Fetch from the proxied endpoint (rewritten to Flask backend)
    fetch(`/api/generate/summary?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.error || "Failed to generate summary");
          });
        }
        return res.json();
      })
      .then((data) => {
        setSummary(data.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Summary fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [visible, sessionId]);

  if (loading) return <div>Generating interview summary...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!summary) return null;

  return (
    <div className="interview-summary-modal">
      <h3>Interview Summary</h3>

      <div className="summary-card">
        <div className="strengths-box">
          <strong>Key Strengths:</strong> {summary.strengths}
        </div>

        <div className="weaknesses-box">
          <strong>Areas for Improvement:</strong> {summary.weaknesses}
        </div>
      </div>

      <div className="recommendation-box">
        <strong>Recommendation:</strong> {summary.recommendation}
        <span className="confidence-score">
          Confidence: {summary.confidence_score}%
        </span>
      </div>

      {summary.recommendation === "LEAN_HIRE" && (
        <div className="proctoring-concern">
          <strong>⚠️ Proctoring Concern:</strong> Interview integrity threshold was reached.
          Recruiter review is required before hiring decision.
        </div>
      )}

      <button onClick={onClose} className="close-button">
        Close Summary
      </button>
    </div>
  );
}