'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Cpu,
  KeyRound,
  Layers3,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  GhostButton,
  PageHeader,
  Pill,
  RefreshButton,
  Spinner,
} from '@/components/super-admin/ui';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import {
  formatDateTime,
  saFetch,
  type AiConfigPayload,
  type AiModelEntry,
  type AiModelPayload,
  type AiTestResult,
} from '@/lib/super-admin';

type FormState = {
  label: string;
  preset: string;
  kind: string;
  baseUrl: string;
  model: string;
  apiVersion: string;
  apiKey: string;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  label: '',
  preset: '',
  kind: 'openai_compatible',
  baseUrl: '',
  model: '',
  apiVersion: '',
  apiKey: '',
  enabled: true,
};

const KIND_LABELS: Record<string, string> = {
  openai_compatible: 'OpenAI-compatible',
  azure_openai: 'Azure OpenAI',
  anthropic: 'Anthropic',
  google_gemini: 'Google Gemini',
};

const inputClass =
  'w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-line-strong';

export default function SuperAdminAiConfigPage() {
  const { supportReason, openSupport, toast } = useSuperAdmin();

  const [data, setData] = useState<AiConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FormState>(EMPTY_FORM);
  const [testResults, setTestResults] = useState<Record<string, AiTestResult>>({});

  const reasonReady = supportReason.trim().length >= 10;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const body = await saFetch<AiConfigPayload>('/api/super-admin/ai-config');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load AI configuration.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const configuration = data?.configuration;
  const models = data?.models ?? [];
  const activeChain = data?.activeChain ?? [];
  const primary = activeChain[0];
  const enabledModels = models.filter((m) => m.enabled);

  const primaryOptions = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      model: string;
      kind: string;
      source: 'registry' | 'environment';
      enabled: boolean;
      hint: string;
    }> = [];

    // All active chain entries (registry and environment providers currently in the chain)
    for (const entry of activeChain) {
      list.push({
        id: entry.id,
        label: entry.label,
        model: entry.model || '',
        kind: entry.kind,
        source: entry.source as 'registry' | 'environment',
        enabled: true,
        hint: entry.source === 'environment' ? 'Environment' : 'Registry',
      });
    }

    // Configured models that are not currently in the active chain (e.g. disabled models)
    for (const m of models) {
      if (!list.some((item) => item.id === m.id)) {
        list.push({
          id: m.id,
          label: m.label,
          model: m.model || '',
          kind: m.kind,
          source: 'registry',
          enabled: m.enabled,
          hint: m.enabled ? 'Registry' : 'Disabled (will enable)',
        });
      }
    }

    return list;
  }, [activeChain, models]);

  const presetOptions = useMemo(
    () =>
      (data?.presets ?? []).map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.base_url,
        kind: p.kind,
        hint: p.model_hint,
      })),
    [data],
  );

  const guardReason = useCallback((): boolean => {
    if (reasonReady) return true;
    toast('Activate a Support Grant (reason of at least 10 characters) before changing provider configuration.', 'error');
    openSupport();
    return false;
  }, [reasonReady, toast, openSupport]);

  const run = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setBusy(key);
      try {
        await fn();
        await load(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'The change could not be applied.';
        setError(message);
        toast(message, 'error');
      } finally {
        setBusy(null);
      }
    },
    [load, toast],
  );

  const applyPreset = (id: string) => {
    const preset = presetOptions.find((p) => p.id === id);
    setForm((f) => ({
      ...f,
      preset: id,
      kind: preset ? preset.kind : f.kind,
      baseUrl: preset && preset.baseUrl && !preset.baseUrl.includes('<') ? preset.baseUrl : id ? f.baseUrl : '',
    }));
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardReason()) return;
    const label = form.label.trim();
    const baseUrl = form.baseUrl.trim();
    const model = form.model.trim();
    if (!label || !baseUrl || !model) {
      toast('Label, base URL and model id are all required.', 'error');
      return;
    }
    const payload: AiModelPayload = { label, kind: form.kind, baseUrl, model, enabled: form.enabled };
    if (form.preset) payload.preset = form.preset;
    if (form.apiVersion.trim()) payload.apiVersion = form.apiVersion.trim();
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

    await run('create', async () => {
      await saFetch('/api/super-admin/ai-config/models', { method: 'POST', body: JSON.stringify(payload) });
      toast('Provider entry added.', 'success');
      setForm(EMPTY_FORM);
    });
  };

  const toggleEnabled = (m: AiModelEntry) => {
    if (!guardReason()) return;
    if (!m.enabled && configuration && configuration.enabledCount >= configuration.maxEnabled) {
      toast(`At most ${configuration.maxEnabled} models can be enabled at once. Disable another entry first.`, 'error');
      return;
    }
    void run(`toggle-${m.id}`, async () => {
      await saFetch(`/api/super-admin/ai-config/models/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      toast(m.enabled ? 'Model disabled.' : 'Model enabled.', 'success');
    });
  };

  const handleSetPrimary = (selectedId: string) => {
    if (!selectedId || selectedId === primary?.id) return;
    if (!guardReason()) return;

    const targetOption = primaryOptions.find((p) => p.id === selectedId);
    if (!targetOption) return;

    const targetModel = models.find((m) => m.id === selectedId);
    if (targetModel && !targetModel.enabled) {
      if (configuration && configuration.enabledCount >= configuration.maxEnabled) {
        toast(`At most ${configuration.maxEnabled} models can be enabled at once. Disable another entry first.`, 'error');
        return;
      }
    }

    const chainIds = activeChain.map((e) => e.id);
    const order = [selectedId, ...chainIds.filter((id) => id !== selectedId)];

    void run(`primary-${selectedId}`, async () => {
      if (targetModel && !targetModel.enabled) {
        await saFetch(`/api/super-admin/ai-config/models/${targetModel.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: true }),
        });
      }

      await saFetch('/api/super-admin/ai-config/reorder', {
        method: 'POST',
        body: JSON.stringify({ order }),
      });
      toast(`"${targetOption.label}" is now the primary provider.`, 'success');
    });
  };

  const makePrimary = (m: AiModelEntry) => {
    handleSetPrimary(m.id);
  };

  const removeModel = (m: AiModelEntry) => {
    if (!guardReason()) return;
    if (!window.confirm(`Delete provider entry "${m.label}"? This cannot be undone.`)) return;
    void run(`del-${m.id}`, async () => {
      await saFetch(`/api/super-admin/ai-config/models/${m.id}`, { method: 'DELETE' });
      toast('Provider entry deleted.', 'success');
    });
  };

  const startEdit = (m: AiModelEntry) => {
    setEditingId(m.id);
    setEditDraft({
      label: m.label,
      preset: m.preset || '',
      kind: m.kind,
      baseUrl: m.baseUrl,
      model: m.model,
      apiVersion: m.apiVersion || '',
      apiKey: '',
      enabled: m.enabled,
    });
  };

  const saveEdit = (m: AiModelEntry) => {
    if (!guardReason()) return;
    const payload: AiModelPayload = {
      label: editDraft.label.trim(),
      kind: editDraft.kind,
      baseUrl: editDraft.baseUrl.trim(),
      model: editDraft.model.trim(),
      apiVersion: editDraft.apiVersion.trim() || null,
    };
    if (editDraft.apiKey.trim()) payload.apiKey = editDraft.apiKey.trim();
    if (!payload.label || !payload.baseUrl || !payload.model) {
      toast('Label, base URL and model id are all required.', 'error');
      return;
    }
    void run(`edit-${m.id}`, async () => {
      await saFetch(`/api/super-admin/ai-config/models/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast('Provider entry updated.', 'success');
      setEditingId(null);
    });
  };

  const clearKey = (m: AiModelEntry) => {
    if (!guardReason()) return;
    if (!window.confirm(`Remove the stored credential for "${m.label}"? The entry will stop working until a new key is added.`)) return;
    void run(`clearkey-${m.id}`, async () => {
      await saFetch(`/api/super-admin/ai-config/models/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ apiKey: '' }),
      });
      toast('Stored credential removed.', 'success');
    });
  };

  const testModel = async (m: AiModelEntry) => {
    setBusy(`test-${m.id}`);
    try {
      const body = await saFetch<{ success: boolean; result: AiTestResult }>(
        `/api/super-admin/ai-config/models/${m.id}/test`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setTestResults((prev) => ({ ...prev, [m.id]: body.result }));
      toast(
        body.result.ok ? `Connection OK (${body.result.latencyMs} ms).` : `Connection failed: ${body.result.error}`,
        body.result.ok ? 'success' : 'error',
      );
      await load(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The connection test could not be run.';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const resetRegistry = () => {
    if (!guardReason()) return;
    if (!window.confirm('Remove every provider entry and fall back to the environment configuration?')) return;
    void run('reset', async () => {
      await saFetch('/api/super-admin/ai-config/reset', { method: 'POST', body: JSON.stringify({}) });
      toast('Reverted to the environment configuration.', 'success');
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Configuration"
        description="Point the whole platform at any language model. Add a provider, store its credential and activate it — up to five enabled models form a primary + automatic failover chain."
        actions={<RefreshButton onClick={() => load()} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      {!reasonReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-accent-amber">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Support Grant required to change configuration</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Provider changes are privileged actions. Activate a Support Grant (reason of at least 10
              characters) to add, edit, enable, reorder or delete models. You can still review the
              current configuration without it.
            </p>
          </div>
          <GhostButton onClick={openSupport} icon={KeyRound}>
            Activate
          </GhostButton>
        </div>
      )}

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          <>
            <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
            <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
            <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
            <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
          </>
        ) : (
          <>
            <StatBlock
              label="Enabled models"
              value={`${configuration?.enabledCount ?? 0} / ${configuration?.maxEnabled ?? 5}`}
              hint="Primary + failover chain"
              icon={Layers3}
              tone="cyan"
            />
            <StatBlock
              label="Active primary"
              value={primary?.model || '—'}
              hint={primary?.label || 'No active provider'}
              icon={Zap}
              tone="violet"
            />
            <StatBlock
              label="Configuration source"
              value={configuration?.registryEmpty ? 'Environment' : 'Registry'}
              hint={
                configuration?.registryEmpty
                  ? 'Falling back to server env vars'
                  : configuration?.environmentFallbackAppended
                    ? 'Your models first, env vars kept as last resort'
                    : 'Managed from this console'
              }
              icon={Cpu}
              tone="emerald"
            />
            <StatBlock
              label="Credential encryption"
              value={configuration?.encryptionAvailable ? 'Enabled' : 'Not configured'}
              hint={configuration?.encryptionAvailable ? 'Keys sealed at rest' : 'Set SETTINGS_ENCRYPTION_KEY'}
              icon={Lock}
              tone={configuration?.encryptionAvailable ? 'emerald' : 'amber'}
            />
          </>
        )}
      </div>

      {/* Active chain */}
      <Card>
        <CardHeader
          title="Active provider chain"
          subtitle={
            configuration?.environmentFallbackAppended
              ? 'Tried in order: entry 1 is primary, the rest are automatic failovers. Server env vars are kept at the end as a last resort.'
              : 'Tried in order: the first entry is primary, the rest are automatic failovers.'
          }
          icon={Zap}
        />
        {primary && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/5 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-violet-500">
              <Star className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Primary model</p>
              <p className="text-[11px] text-ink-muted">
                Every request goes here first. Other enabled models are automatic failovers; server env vars are the last resort.
              </p>
            </div>
            <select
              className={`${inputClass} w-auto min-w-[260px] max-w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
              value={primary.id}
              disabled={primaryOptions.length < 2 || busy !== null}
              title={primaryOptions.length < 2 ? 'Only 1 provider available. Configure more providers below to enable switching.' : 'Select primary provider'}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId || nextId === primary.id) return;
                if (!guardReason()) {
                  e.target.value = primary.id;
                  return;
                }
                handleSetPrimary(nextId);
              }}
            >
              {primaryOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-surface text-ink">
                  {opt.label} · {opt.model || 'default'} ({opt.hint})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {(data?.activeChain ?? []).length === 0 ? (
            <EmptyState
              title="No active provider"
              icon={Cpu}
              hint="Add and enable a model below, or configure provider credentials in the server environment."
            />
          ) : (
            data?.activeChain.map((entry, index) => (
              <div
                key={`${entry.id}-${index}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-xs font-bold text-ink-muted">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{entry.label}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {entry.model || '—'} · {KIND_LABELS[entry.kind] || entry.kind}
                  </p>
                </div>
                {index === 0 && <Pill tone="violet">Primary</Pill>}
                <Pill tone={entry.source === 'environment' ? 'neutral' : 'cyan'}>
                  {entry.source === 'environment' ? 'Env' : 'Registry'}
                </Pill>
                <Pill tone={entry.configured ? 'emerald' : 'rose'}>
                  {entry.configured ? 'Credential set' : 'No credential'}
                </Pill>
                {index !== 0 && (
                  <GhostButton
                    onClick={() => handleSetPrimary(entry.id)}
                    icon={Star}
                    disabled={busy !== null}
                  >
                    Make primary
                  </GhostButton>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Add model */}
      <Card>
        <CardHeader
          title="Add a model"
          subtitle="Any OpenAI-compatible endpoint works (OpenAI, OpenRouter, Groq, DeepSeek, Together, xAI, self-hosted…), plus Azure OpenAI, Anthropic and Google Gemini."
          icon={Plus}
        />
        <form onSubmit={submitNew} className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Display label">
            <input
              className={inputClass}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g., Production GPT-4o mini"
            />
          </Field>

          <Field label="Provider preset">
            <select
              className={inputClass}
              value={form.preset}
              onChange={(e) => applyPreset(e.target.value)}
            >
              <option value="">Custom / OpenAI-compatible…</option>
              {presetOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Provider kind">
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            >
              {(data?.kinds ?? ['openai_compatible']).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k] || k}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Model id">
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder={presetOptions.find((p) => p.id === form.preset)?.hint || 'e.g., gpt-4o-mini'}
            />
          </Field>

          <Field label="Base URL" className="md:col-span-2">
            <input
              className={inputClass}
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </Field>

          {form.kind === 'azure_openai' && (
            <Field label="API version" className="md:col-span-2">
              <input
                className={inputClass}
                value={form.apiVersion}
                onChange={(e) => setForm((f) => ({ ...f, apiVersion: e.target.value }))}
                placeholder="2024-06-01"
              />
            </Field>
          )}

          <Field label="API key (write-only)" className="md:col-span-2">
            <input
              type="password"
              autoComplete="off"
              className={inputClass}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="Stored encrypted — never displayed again"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              The key is encrypted at rest and never returned by the API. Only a non-reversible
              fingerprint is stored for the audit trail.
            </p>
          </Field>

          <label className="flex items-center gap-2 text-xs text-ink-muted md:col-span-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enable immediately (counts toward the five-model limit)
          </label>

          <div className="flex items-center justify-end md:col-span-2">
            <button
              type="submit"
              disabled={busy === 'create'}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add model
            </button>
          </div>
        </form>
      </Card>

      {/* Models list */}
      <Card>
        <CardHeader
          title="Configured models"
          subtitle={`${models.length} entr${models.length === 1 ? 'y' : 'ies'} · up to ${configuration?.maxEnabled ?? 5} may be enabled at once`}
          icon={Cpu}
          action={
            models.length > 0 ? (
              <GhostButton onClick={resetRegistry} icon={Trash2} disabled={busy === 'reset'}>
                Revert to environment
              </GhostButton>
            ) : undefined
          }
        />
        <div className="mt-4 space-y-3">
          {loading && !data ? (
            <Spinner label="Loading provider registry…" />
          ) : models.length === 0 ? (
            <EmptyState
              title="No models configured yet"
              icon={Cpu}
              hint="Add your first provider above. Until then the platform uses the server environment configuration."
            />
          ) : (
            models.map((m) => {
              const test = testResults[m.id] || m.lastTest;
              return (
                <div key={m.id} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink">{m.label}</span>
                        <Pill tone={m.enabled ? 'emerald' : 'neutral'}>{m.enabled ? 'Enabled' : 'Disabled'}</Pill>
                        {m.enabled && m.priority === 1 && <Pill tone="violet">Primary</Pill>}
                        <Pill tone="cyan">{KIND_LABELS[m.kind] || m.kind}</Pill>
                      </div>
                      <p className="mt-1 break-all text-[11px] text-ink-muted">
                        <span className="font-semibold text-ink-muted">model:</span> {m.model}
                        <span className="mx-1.5 text-ink-faint">·</span>
                        <span className="font-semibold text-ink-muted">base:</span> {m.baseUrl}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {m.hasKey ? (
                          <span className="inline-flex items-center gap-1 font-mono text-accent-emerald">
                            <KeyRound className="h-3 w-3" />
                            {m.keyFingerprint || 'key set'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-accent-amber">
                            <AlertTriangle className="h-3 w-3" /> No credential
                          </span>
                        )}
                        {test && (
                          <span className={`inline-flex items-center gap-1 ${test.ok ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                            {test.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {test.ok ? `Last test OK (${test.latencyMs ?? '—'} ms)` : `Last test failed: ${test.error || 'unknown error'}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <GhostButton
                        onClick={() => testModel(m)}
                        icon={busy === `test-${m.id}` ? Loader2 : Zap}
                        disabled={busy === `test-${m.id}` || !m.hasKey}
                      >
                        Test
                      </GhostButton>
                      <GhostButton
                        onClick={() => makePrimary(m)}
                        icon={Star}
                        disabled={primary?.id === m.id || busy === `primary-${m.id}`}
                      >
                        Make primary
                      </GhostButton>
                      <GhostButton
                        onClick={() => toggleEnabled(m)}
                        icon={ArrowUp}
                        disabled={busy === `toggle-${m.id}`}
                      >
                        {m.enabled ? 'Disable' : 'Enable'}
                      </GhostButton>
                      <GhostButton onClick={() => startEdit(m)} disabled={busy === `edit-${m.id}`}>
                        Edit
                      </GhostButton>
                      <GhostButton onClick={() => removeModel(m)} icon={Trash2} disabled={busy === `del-${m.id}`}>
                        Delete
                      </GhostButton>
                    </div>
                  </div>

                  {editingId === m.id && (
                    <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2">
                      <Field label="Display label">
                        <input
                          className={inputClass}
                          value={editDraft.label}
                          onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                        />
                      </Field>
                      <Field label="Model id">
                        <input
                          className={inputClass}
                          value={editDraft.model}
                          onChange={(e) => setEditDraft((d) => ({ ...d, model: e.target.value }))}
                        />
                      </Field>
                      <Field label="Base URL" className="md:col-span-2">
                        <input
                          className={inputClass}
                          value={editDraft.baseUrl}
                          onChange={(e) => setEditDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                        />
                      </Field>
                      {editDraft.kind === 'azure_openai' && (
                        <Field label="API version" className="md:col-span-2">
                          <input
                            className={inputClass}
                            value={editDraft.apiVersion}
                            onChange={(e) => setEditDraft((d) => ({ ...d, apiVersion: e.target.value }))}
                          />
                        </Field>
                      )}
                      <Field label="Replace API key (leave blank to keep current)" className="md:col-span-2">
                        <input
                          type="password"
                          autoComplete="off"
                          className={inputClass}
                          value={editDraft.apiKey}
                          onChange={(e) => setEditDraft((d) => ({ ...d, apiKey: e.target.value }))}
                          placeholder="Write-only — never shown again"
                        />
                      </Field>
                      <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
                        {m.hasKey && (
                          <GhostButton onClick={() => clearKey(m)} icon={Trash2} disabled={busy === `clearkey-${m.id}`}>
                            Remove key
                          </GhostButton>
                        )}
                        <GhostButton onClick={() => setEditingId(null)}>Cancel</GhostButton>
                        <button
                          type="button"
                          disabled={busy === `edit-${m.id}`}
                          onClick={() => saveEdit(m)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busy === `edit-${m.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Save changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Recent changes + governance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent changes" subtitle="Every provider change is recorded in the audit log" icon={Layers3} />
          <div className="mt-4 space-y-2">
            {(data?.recentChanges ?? []).length === 0 ? (
              <EmptyState title="No changes recorded yet" icon={Layers3} />
            ) : (
              data?.recentChanges.map((c, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{c.action.replace(/^llm_/, '').replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-ink-faint">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {String((c.detail as Record<string, unknown>)?.label || (c.detail as Record<string, unknown>)?.model || c.actorId || '—')}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Guardrails" subtitle="Non-negotiable platform rules" icon={Lock} />
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-ink-muted">
            <li>• API keys are write-only: encrypted at rest and never returned by any endpoint — only a fingerprint.</li>
            <li>• At most five models may be enabled at once (primary + automatic failovers).</li>
            <li>• Base URLs are SSRF-checked; private, loopback and cloud-metadata endpoints are refused.</li>
            <li>• Every change requires an operational reason and is written to the tamper-resistant audit log.</li>
            <li>• Reverting to the environment configuration is always available and is itself audited.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="emerald">Keys encrypted</Pill>
            <Pill tone="cyan">Changes audited</Pill>
            <Pill tone="amber">Max 5 enabled</Pill>
            <Pill tone="violet">SSRF-guarded</Pill>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function StatBlock({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'cyan' | 'violet' | 'emerald' | 'amber';
}) {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-accent-cyan',
    violet: 'border-violet-500/20 bg-violet-500/10 text-accent-violet',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-accent-emerald',
    amber: 'border-amber-500/20 bg-amber-500/10 text-accent-amber',
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className={`rounded-xl border p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 truncate text-2xl font-black tracking-tight text-ink" title={value}>
        {value}
      </p>
      {hint && <p className="mt-2 truncate text-[11px] text-ink-muted" title={hint}>{hint}</p>}
    </div>
  );
}
