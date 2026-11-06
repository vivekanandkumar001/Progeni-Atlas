'use client';

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AuthCard, buttonClass, inputClass } from "@/components/ui";

export default function TeamInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) { setError("This invitation link is invalid or incomplete."); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/api/auth/team-invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to accept invitation.");
      setDone(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err: any) {
      setError(err?.message || "Unable to accept invitation.");
    } finally { setBusy(false); }
  }

  if (done)
    return (
      <main className="min-h-screen grid place-items-center bg-canvas p-6 text-ink">
        <AuthCard className="max-w-md" innerClassName="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Invitation accepted</h1>
          <p className="text-sm text-ink-muted">
            Your workspace access is ready. Redirecting to sign in…
          </p>
        </AuthCard>
      </main>
    );

  return (
    <main className="min-h-screen grid place-items-center bg-canvas p-6 text-ink">
      <form onSubmit={submit} className="w-full max-w-md">
        <AuthCard innerClassName="space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Join your TalentPulse workspace
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Create your workspace password. If you already have a TalentPulse candidate account,
              enter its current password too.
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs font-medium text-accent-rose">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium text-ink">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass(false, "cyan", "mt-1.5")}
            />
          </label>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                required
                minLength={12}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass(false, "cyan")} pr-12`}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPassword((prev) => !prev);
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Current password (existing accounts only)
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${inputClass(false, "cyan")} pr-12`}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowCurrentPassword((prev) => !prev);
                }}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                aria-pressed={showCurrentPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none cursor-pointer"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className={buttonClass("primary", "lg", "pill", "w-full disabled:opacity-50")}
          >
            {busy ? "Accepting…" : "Accept invitation"}
          </button>
        </AuthCard>
      </form>
    </main>
  );
}
