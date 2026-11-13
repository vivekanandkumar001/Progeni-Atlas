'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Globe,
  Languages,
  Lock,
  Mail,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Timer,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  Spinner,
} from '@/components/super-admin/ui';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { formatDateTime, saFetch, type SystemHealth } from '@/lib/super-admin';

export type PlatformSetting = {
  key: string;
  label: string;
  note: string;
  value: string;
  badge: string;
  tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'neutral';
  config: Record<string, any>;
  updatedAt?: string;
  updatedBy?: string;
  lastReason?: string;
};

const DEFAULT_POLICY_ROWS: PlatformSetting[] = [
  {
    key: 'maintenance_mode',
    label: 'Maintenance mode',
    value: 'Off',
    badge: 'OFF',
    tone: 'neutral',
    note: 'Requires a scheduled, announced window.',
    config: {
      enabled: false,
      message: 'Progeni Atlas is currently undergoing scheduled platform maintenance. Services will resume shortly.',
      scheduled_start: '',
      scheduled_end: '',
      allow_super_admin: true,
    },
  },
  {
    key: 'rate_limits',
    label: 'API rate limiting',
    value: '120 RPM (Enforced)',
    badge: 'ENFORCED',
    tone: 'cyan',
    note: 'Applied per client to protect shared capacity.',
    config: {
      enforced: true,
      requests_per_minute: 120,
      burst_limit: 200,
      exempt_super_admin: true,
      strategy: 'Token Bucket',
    },
  },
  {
    key: 'allowed_integrations',
    label: 'Allowed integrations',
    value: '3 Active Providers',
    badge: 'MANAGED ALLOW-LIST',
    tone: 'neutral',
    note: 'New third-party integrations require review.',
    config: {
      policy: 'allowlist_only',
      allowed_providers: [
        { id: 'slack', name: 'Slack Enterprise Webhooks', enabled: true },
        { id: 'google_workspace', name: 'Google Workspace Calendar & SSO', enabled: true },
        { id: 'github', name: 'GitHub OAuth & Code Sync', enabled: true },
        { id: 'greenhouse', name: 'Greenhouse ATS Connector', enabled: false },
        { id: 'lever', name: 'Lever ATS Connector', enabled: false },
        { id: 'workday', name: 'Workday HCM Integration', enabled: false },
      ],
    },
  },
  {
    key: 'default_interview',
    label: 'Default interview settings',
    value: '30 mins default · Standard',
    badge: 'PLATFORM DEFAULT',
    tone: 'neutral',
    note: 'Tenants may narrow, not weaken, these defaults.',
    config: {
      duration_minutes: 30,
      proctoring_warning_threshold: 5,
      proctoring_terminate_on_flagged: false,
      camera_required: true,
      microphone_required: true,
      screen_share_required: false,
      auto_evaluation: true,
    },
  },
  {
    key: 'languages',
    label: 'Supported languages',
    value: '8 Languages Supported',
    badge: 'CONFIGURED CENTRALLY',
    tone: 'neutral',
    note: 'Interview language set at the platform level.',
    config: {
      primary_language: 'English (US)',
      supported_languages: [
        'English (US)',
        'English (UK)',
        'Spanish (ES)',
        'French (FR)',
        'German (DE)',
        'Hindi (IN)',
        'Mandarin Chinese',
        'Japanese',
      ],
    },
  },
  {
    key: 'notifications',
    label: 'Notification templates',
    value: 'Email & In-App',
    badge: 'PLATFORM-WIDE',
    tone: 'neutral',
    note: 'Transactional templates are version-controlled.',
    config: {
      email_notifications: true,
      in_app_notifications: true,
      slack_alerts: false,
      send_interview_invitations: true,
      send_candidate_reminders: true,
      send_scorecard_ready: true,
      sender_name: 'Progeni Atlas Notifications',
    },
  },
];

export default function SuperAdminSettingsPage() {
  const { toast } = useSuperAdmin();

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [settings, setSettings] = useState<PlatformSetting[]>(DEFAULT_POLICY_ROWS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedSetting, setSelectedSetting] = useState<PlatformSetting | null>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [auditReason, setAuditReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, settingsRes] = await Promise.all([
        saFetch<SystemHealth & { success: boolean }>('/api/super-admin/system-health'),
        saFetch<{ success: boolean; settings: PlatformSetting[] }>('/api/super-admin/settings').catch(
          () => ({ success: false, settings: DEFAULT_POLICY_ROWS })
        ),
      ]);
      setHealth(healthRes);
      if (settingsRes.success && Array.isArray(settingsRes.settings)) {
        setSettings(settingsRes.settings);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load platform posture.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenSetting = (row: PlatformSetting) => {
    setSelectedSetting(row);
    setFormConfig(JSON.parse(JSON.stringify(row.config || {})));
    setAuditReason('');
  };

  const handleSaveSetting = async () => {
    if (!selectedSetting) return;
    if (auditReason.trim().length < 10) {
      toast('Please enter a change justification of at least 10 characters.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await saFetch<{ success: boolean; message: string; setting: PlatformSetting }>(
        `/api/super-admin/settings/${selectedSetting.key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: formConfig,
            reason: auditReason.trim(),
          }),
        }
      );

      if (res.success) {
        toast(res.message || 'Platform setting updated and audited successfully!', 'success');
        setSelectedSetting(null);
        await loadData();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update platform setting.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getSettingIcon = (key: string) => {
    switch (key) {
      case 'maintenance_mode':
        return <Radio className="h-4 w-4" />;
      case 'rate_limits':
        return <Zap className="h-4 w-4" />;
      case 'allowed_integrations':
        return <Globe className="h-4 w-4" />;
      case 'default_interview':
        return <Video className="h-4 w-4" />;
      case 'languages':
        return <Languages className="h-4 w-4" />;
      case 'notifications':
        return <Mail className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings & Governance"
        description="Global platform defaults, runtime rate limits, and security configuration. Click any setting to view details and apply audited operational changes."
        actions={<RefreshButton onClick={loadData} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      {/* Governed Operational Change Notice */}
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-accent-cyan" />
          <div>
            <p className="text-sm font-bold text-ink">Audited Operational Change Control</p>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              Every setting below is active, responsive, and clickable. Changes are verified server-side,
              persisted to the primary configuration store, and recorded in the immutable audit log with full
              justification and Super Admin attribution.
            </p>
          </div>
        </div>
      </Card>

      {/* GLOBAL CONFIGURATION LIST */}
      <Card>
        <CardHeader
          title="Global configuration"
          subtitle="Effective platform defaults"
          icon={Settings}
        />

        <div className="mt-4 divide-y divide-line/60">
          {settings.map((row) => (
            <div
              key={row.key}
              onClick={() => handleOpenSetting(row)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleOpenSetting(row);
              }}
              className="group flex flex-col gap-2 rounded-xl px-3 py-3 -mx-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-accent-cyan group-hover:bg-cyan-500/20 transition-colors">
                  {getSettingIcon(row.key)}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink group-hover:text-accent-cyan transition-colors">
                    {row.label}
                  </p>
                  <p className="text-[11px] text-ink-faint">{row.note}</p>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Pill tone={row.tone || 'neutral'}>{row.badge}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ARCHITECTURAL POSTURE CARDS */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Security policy" subtitle="Applied platform-wide" icon={ShieldCheck} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-emerald shrink-0" />
              Class-based RBAC enforced server-side on every request.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-emerald shrink-0" />
              Privileged actions require an explicit support reason.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-emerald shrink-0" />
              Audit rows are append-only, tamper-resistant in MongoDB.
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Integration limits" subtitle="External surface" icon={Globe} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan shrink-0" />
              Allowed integrations are explicitly enumerated.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan shrink-0" />
              Rate limits protect shared capacity across tenants.
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan shrink-0" />
              Outbound credentials never leave encrypted storage.
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Platform posture" subtitle="Live dependency snapshot" icon={Timer} />
          {loading && !health ? (
            <Spinner />
          ) : (
            <div className="mt-4 space-y-2.5 text-xs text-ink-muted">
              <div className="flex items-center justify-between">
                <span>Services healthy</span>
                <span className="font-semibold text-ink font-mono">
                  {health ? `${health.operationalCount}/${health.totalCount}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Overall status</span>
                <Pill tone={health?.overall === 'operational' ? 'emerald' : 'amber'}>
                  {health?.overall || '—'}
                </Pill>
              </div>
              <div className="flex items-center justify-between">
                <span>Checked at</span>
                <span className="text-ink-faint font-mono">{formatDateTime(health?.checkedAt)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------- AUDITED CONFIGURATION MODAL */}
      {selectedSetting && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSetting(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-accent-cyan">
                  {getSettingIcon(selectedSetting.key)}
                </span>
                <div>
                  <h3 className="font-bold text-ink text-base">{selectedSetting.label}</h3>
                  <p className="text-xs text-ink-muted">Audited Platform Policy Configuration</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSetting(null)}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Dynamic Form Controls */}
            <div className="mt-5 space-y-5 text-xs">
              {/* 1. Maintenance Mode */}
              {selectedSetting.key === 'maintenance_mode' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                    <div>
                      <p className="font-bold text-ink">Enable Maintenance Window</p>
                      <p className="text-[11px] text-ink-muted">
                        Restricts general access while allowing Super Admin diagnostics.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!formConfig.enabled}
                      onChange={(e) => setFormConfig({ ...formConfig, enabled: e.target.checked })}
                      className="h-5 w-5 rounded border-line text-rose-500 focus:ring-0"
                    />
                  </div>

                  <div>
                    <label className="block text-ink-muted mb-1 font-semibold">
                      Public Maintenance Notice *
                    </label>
                    <textarea
                      rows={2}
                      value={formConfig.message || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, message: e.target.value })}
                      placeholder="Progeni Atlas is undergoing scheduled maintenance..."
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">Scheduled Start (UTC)</label>
                      <input
                        type="datetime-local"
                        value={formConfig.scheduled_start || ''}
                        onChange={(e) => setFormConfig({ ...formConfig, scheduled_start: e.target.value })}
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">Scheduled End (UTC)</label>
                      <input
                        type="datetime-local"
                        value={formConfig.scheduled_end || ''}
                        onChange={(e) => setFormConfig({ ...formConfig, scheduled_end: e.target.value })}
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                    <div>
                      <p className="font-semibold text-ink">Super Admin Bypass Allowed</p>
                      <p className="text-[11px] text-ink-muted">admin@progeni.live retains access</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formConfig.allow_super_admin ?? true}
                      onChange={(e) => setFormConfig({ ...formConfig, allow_super_admin: e.target.checked })}
                      className="h-4 w-4 rounded border-line text-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* 2. API Rate Limiting */}
              {selectedSetting.key === 'rate_limits' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                    <div>
                      <p className="font-bold text-ink">Rate Limiting Enforcement</p>
                      <p className="text-[11px] text-ink-muted">Protects backend endpoints against abuse.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!formConfig.enforced}
                      onChange={(e) => setFormConfig({ ...formConfig, enforced: e.target.checked })}
                      className="h-5 w-5 rounded border-line text-cyan-500 focus:ring-0"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">
                        Requests Per Minute (RPM) *
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="2000"
                        value={formConfig.requests_per_minute || 120}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, requests_per_minute: parseInt(e.target.value) || 60 })
                        }
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono font-bold text-ink outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">Burst Limit *</label>
                      <input
                        type="number"
                        min="20"
                        max="5000"
                        value={formConfig.burst_limit || 200}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, burst_limit: parseInt(e.target.value) || 100 })
                        }
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono font-bold text-ink outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-muted mb-1 font-semibold">Rate Limiting Strategy</label>
                    <select
                      value={formConfig.strategy || 'Token Bucket'}
                      onChange={(e) => setFormConfig({ ...formConfig, strategy: e.target.value })}
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none"
                    >
                      <option value="Token Bucket">Token Bucket (Smoothed with Bursts)</option>
                      <option value="Leaky Bucket">Leaky Bucket (Strict Constant Rate)</option>
                      <option value="Fixed Window">Fixed Window Counter (Simple)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 3. Allowed Integrations */}
              {selectedSetting.key === 'allowed_integrations' && (
                <div className="space-y-3">
                  <p className="text-ink-muted">
                    Enable or disable authorized third-party integrations across all tenant organizations:
                  </p>
                  <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                    {(formConfig.allowed_providers || []).map((provider: any, idx: number) => (
                      <div
                        key={provider.id || idx}
                        className="flex items-center justify-between py-1.5 border-b border-line/40 last:border-b-0"
                      >
                        <span className="font-semibold text-ink">{provider.name}</span>
                        <input
                          type="checkbox"
                          checked={!!provider.enabled}
                          onChange={(e) => {
                            const updated = [...(formConfig.allowed_providers || [])];
                            updated[idx] = { ...provider, enabled: e.target.checked };
                            setFormConfig({ ...formConfig, allowed_providers: updated });
                          }}
                          className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Default Interview Settings */}
              {selectedSetting.key === 'default_interview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">
                        Default Duration (Minutes) *
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="180"
                        value={formConfig.duration_minutes || 30}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            duration_minutes: parseInt(e.target.value) || 30,
                          })
                        }
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono font-bold text-ink outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-muted mb-1 font-semibold">
                        Proctoring Alert Threshold *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formConfig.proctoring_warning_threshold || 5}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            proctoring_warning_threshold: parseInt(e.target.value) || 5,
                          })
                        }
                        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono font-bold text-ink outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">Terminate on Critical Flag</span>
                      <input
                        type="checkbox"
                        checked={!!formConfig.proctoring_terminate_on_flagged}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, proctoring_terminate_on_flagged: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-line text-rose-500 focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">Camera Required</span>
                      <input
                        type="checkbox"
                        checked={formConfig.camera_required ?? true}
                        onChange={(e) => setFormConfig({ ...formConfig, camera_required: e.target.checked })}
                        className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">Microphone Required</span>
                      <input
                        type="checkbox"
                        checked={formConfig.microphone_required ?? true}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, microphone_required: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Supported Languages */}
              {selectedSetting.key === 'languages' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-ink-muted mb-1 font-semibold">Primary Platform Language</label>
                    <select
                      value={formConfig.primary_language || 'English (US)'}
                      onChange={(e) => setFormConfig({ ...formConfig, primary_language: e.target.value })}
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none"
                    >
                      <option value="English (US)">English (US)</option>
                      <option value="English (UK)">English (UK)</option>
                      <option value="Spanish (ES)">Spanish (ES)</option>
                      <option value="French (FR)">French (FR)</option>
                      <option value="German (DE)">German (DE)</option>
                      <option value="Hindi (IN)">Hindi (IN)</option>
                      <option value="Mandarin Chinese">Mandarin Chinese</option>
                      <option value="Japanese">Japanese</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-ink-muted mb-2 font-semibold">
                      Supported Screening Languages ({formConfig.supported_languages?.length || 0})
                    </label>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3">
                      {[
                        'English (US)',
                        'English (UK)',
                        'Spanish (ES)',
                        'French (FR)',
                        'German (DE)',
                        'Hindi (IN)',
                        'Mandarin Chinese',
                        'Japanese',
                        'Arabic',
                        'Portuguese',
                      ].map((lang) => {
                        const isChecked = (formConfig.supported_languages || []).includes(lang);
                        return (
                          <label key={lang} className="flex items-center gap-2 cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const current: string[] = formConfig.supported_languages || [];
                                const updated = e.target.checked
                                  ? [...current, lang]
                                  : current.filter((l) => l !== lang);
                                setFormConfig({ ...formConfig, supported_languages: updated });
                              }}
                              className="h-4 w-4 rounded border-line text-cyan-500"
                            />
                            <span className="text-xs text-ink">{lang}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. Notifications */}
              {selectedSetting.key === 'notifications' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-ink-muted mb-1 font-semibold">Sender Display Name</label>
                    <input
                      type="text"
                      value={formConfig.sender_name || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, sender_name: e.target.value })}
                      placeholder="Progeni Atlas Notifications"
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">Email Notifications (SMTP)</span>
                      <input
                        type="checkbox"
                        checked={formConfig.email_notifications ?? true}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, email_notifications: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">In-App Notification Feed</span>
                      <input
                        type="checkbox"
                        checked={formConfig.in_app_notifications ?? true}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, in_app_notifications: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-ink">Slack Realtime Alerts</span>
                      <input
                        type="checkbox"
                        checked={!!formConfig.slack_alerts}
                        onChange={(e) => setFormConfig({ ...formConfig, slack_alerts: e.target.checked })}
                        className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mandatory Operational Justification */}
              <div className="rounded-xl bg-amber-500/10 p-3.5 space-y-2">
                <label className="block font-bold text-accent-amber">
                  Operational Change Justification (Required for Audit Log) *
                </label>
                <textarea
                  rows={2}
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="Enter change-control operational justification (minimum 10 characters)..."
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-amber-500 text-xs"
                />
                <p className="text-[11px] text-ink-muted">
                  Changes will be permanently recorded in the immutable audit log under your Super Admin credentials.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setSelectedSetting(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSetting()}
                disabled={saving || auditReason.trim().length < 10}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30 disabled:opacity-50 transition"
              >
                {saving ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
                Save & Apply (Audited)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}