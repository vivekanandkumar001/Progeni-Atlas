'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CirclePlus, Pencil, RefreshCw, Save, Tags, Trash2 } from 'lucide-react';
import { Card, CardHeader, ErrorBanner, PageHeader, Spinner } from '@/components/super-admin/ui';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { saFetch } from '@/lib/super-admin';
import { invalidateApiCache } from '@/lib/api';

type Skill = {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  active: boolean;
  updated_at?: string;
};

type Drill = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  coreSkillsTested: string[];
  match_skills: string[];
  description: string;
  sampleStarterQuestion: string;
  recommendedReason: string;
  active: boolean;
  updated_at?: string;
};

type CatalogPayload = { success: boolean; skills: Skill[]; drills: Drill[] };
type CatalogKind = 'skills' | 'drills';

const FIELD_CLASS = 'w-full rounded-xl border border-line bg-inset px-3 py-2.5 text-sm text-ink outline-none focus:border-cyan-500/50';
const LABEL_CLASS = 'mb-1 block text-xs font-semibold text-ink-muted';

const emptySkill = (): Skill => ({ id: '', name: '', category: 'General', aliases: [], active: true });
const emptyDrill = (): Drill => ({
  id: '', title: '', category: 'SYSTEM_DESIGN', difficulty: 'INTERMEDIATE', estimatedMinutes: 10,
  coreSkillsTested: [], match_skills: [], description: '', sampleStarterQuestion: '', recommendedReason: '', active: true,
});

export default function SkillPracticeCatalogPage() {
  const { toast } = useSuperAdmin();
  const [kind, setKind] = useState<CatalogKind>('skills');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skillForm, setSkillForm] = useState<Skill>(emptySkill());
  const [drillForm, setDrillForm] = useState<Drill>(emptyDrill());

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await saFetch<CatalogPayload>('/api/super-admin/catalog', { cache: 'no-store' });
      setSkills(Array.isArray(response.skills) ? response.skills : []);
      setDrills(Array.isArray(response.drills) ? response.drills : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCatalog(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  const resetEditor = () => {
    setEditingId(null);
    setSkillForm(emptySkill());
    setDrillForm(emptyDrill());
  };

  const editSkill = (skill: Skill) => {
    setKind('skills');
    setEditingId(skill.id);
    setSkillForm({ ...skill, aliases: skill.aliases || [] });
  };

  const editDrill = (drill: Drill) => {
    setKind('drills');
    setEditingId(drill.id);
    setDrillForm({ ...drill, coreSkillsTested: drill.coreSkillsTested || [], match_skills: drill.match_skills || [] });
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = kind === 'skills'
        ? { ...skillForm, aliases: skillForm.aliases }
        : { ...drillForm, estimatedMinutes: Number(drillForm.estimatedMinutes) };
      const path = editingId
        ? `/api/super-admin/catalog/${kind}/${encodeURIComponent(editingId)}`
        : `/api/super-admin/catalog/${kind}`;
      await saFetch(path, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      invalidateApiCache('/candidate/skills');
      invalidateApiCache('/practice/drills');
      invalidateApiCache('/candidate/skill-insights');
      toast(`${kind === 'skills' ? 'Skill' : 'Drill'} ${editingId ? 'updated' : 'created'}.`);
      resetEditor();
      await loadCatalog();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unable to save catalog item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (itemKind: CatalogKind, item: Skill | Drill) => {
    try {
      if (item.active) {
        await saFetch(`/api/super-admin/catalog/${itemKind}/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      } else {
        await saFetch(`/api/super-admin/catalog/${itemKind}/${encodeURIComponent(item.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, active: true }),
        });
      }
      invalidateApiCache('/candidate/skills');
      invalidateApiCache('/practice/drills');
      invalidateApiCache('/candidate/skill-insights');
      toast(item.active ? 'Catalog item archived.' : 'Catalog item activated.');
      await loadCatalog();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unable to change catalog item status.', 'error');
    }
  };

  const parseList = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Skills & Practice Catalog"
        description="Manage resume skill matching and candidate practice drills. Changes are stored in MongoDB and take effect without a deployment."
        actions={(
          <button type="button" onClick={() => void loadCatalog()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        )}
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2">
        {(['skills', 'drills'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setKind(tab); resetEditor(); }}
            className={`rounded-xl border px-4 py-2 text-xs font-bold capitalize transition ${kind === tab ? 'border-cyan-500/40 bg-cyan-500/10 text-accent-cyan' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
          >
            {tab} ({tab === 'skills' ? skills.length : drills.length})
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <Card>
          <CardHeader
            title={kind === 'skills' ? 'Skill taxonomy' : 'Practice drills'}
            subtitle="Archived items stay in the catalog but are hidden from candidates."
            icon={kind === 'skills' ? Tags : BookOpen}
            action={<span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold text-ink-muted">{kind === 'skills' ? skills.filter((x) => x.active).length : drills.filter((x) => x.active).length} active</span>}
          />

          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="mt-4 space-y-2">
              {kind === 'skills' ? skills.map((skill) => (
                <div key={skill.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-inset/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{skill.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-muted">{skill.category} · {skill.aliases?.length ? skill.aliases.join(', ') : 'No aliases'} · {skill.active ? 'Active' : 'Archived'}</p>
                  </div>
                  <button type="button" onClick={() => editSkill(skill)} className="rounded-lg border border-line p-2 text-ink-muted hover:text-accent-cyan" aria-label={`Edit ${skill.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void toggleActive('skills', skill)} className="rounded-lg border border-line p-2 text-ink-muted hover:text-accent-rose" aria-label={skill.active ? `Archive ${skill.name}` : `Activate ${skill.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )) : drills.map((drill) => (
                <div key={drill.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-inset/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{drill.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-muted">{drill.category} · {drill.difficulty} · {drill.estimatedMinutes} min · {drill.active ? 'Active' : 'Archived'}</p>
                  </div>
                  <button type="button" onClick={() => editDrill(drill)} className="rounded-lg border border-line p-2 text-ink-muted hover:text-accent-cyan" aria-label={`Edit ${drill.title}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void toggleActive('drills', drill)} className="rounded-lg border border-line p-2 text-ink-muted hover:text-accent-rose" aria-label={drill.active ? `Archive ${drill.title}` : `Activate ${drill.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {!loading && (kind === 'skills' ? skills.length === 0 : drills.length === 0) && <p className="py-8 text-center text-sm text-ink-muted">No catalog items yet.</p>}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={editingId ? 'Edit item' : `Add ${kind === 'skills' ? 'skill' : 'drill'}`}
            subtitle={editingId ? `ID: ${editingId}` : 'Changes are saved directly to the live catalog.'}
            icon={editingId ? Pencil : CirclePlus}
            action={editingId ? <button type="button" onClick={resetEditor} className="text-xs font-semibold text-ink-muted hover:text-ink">New item</button> : undefined}
          />

          {kind === 'skills' ? (
            <form onSubmit={saveItem} className="mt-4 space-y-3">
              <label className="block"><span className={LABEL_CLASS}>Skill name</span><input required maxLength={100} className={FIELD_CLASS} value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} placeholder="e.g. Kubernetes" /></label>
              <label className="block"><span className={LABEL_CLASS}>Category</span><input maxLength={80} className={FIELD_CLASS} value={skillForm.category} onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })} placeholder="Cloud & DevOps" /></label>
              <label className="block"><span className={LABEL_CLASS}>Aliases (comma-separated)</span><input className={FIELD_CLASS} value={(skillForm.aliases || []).join(', ')} onChange={(e) => setSkillForm({ ...skillForm, aliases: parseList(e.target.value) })} placeholder="k8s, Kubernetes Engine" /></label>
              <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={skillForm.active} onChange={(e) => setSkillForm({ ...skillForm, active: e.target.checked })} /> Active for suggestions and resume parsing</label>
            </form>
          ) : (
            <form onSubmit={saveItem} className="mt-4 space-y-3">
              <label className="block"><span className={LABEL_CLASS}>Stable ID {editingId && '(cannot change)'}</span><input required disabled={!!editingId} pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,99}" className={FIELD_CLASS} value={drillForm.id} onChange={(e) => setDrillForm({ ...drillForm, id: e.target.value })} placeholder="drill-kubernetes-basics" /></label>
              <label className="block"><span className={LABEL_CLASS}>Title</span><input required maxLength={180} className={FIELD_CLASS} value={drillForm.title} onChange={(e) => setDrillForm({ ...drillForm, title: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={LABEL_CLASS}>Category</span><select className={FIELD_CLASS} value={drillForm.category} onChange={(e) => setDrillForm({ ...drillForm, category: e.target.value })}>{['SYSTEM_DESIGN', 'DATA_STRUCTURES', 'DISTRIBUTED_SYSTEMS', 'BEHAVIORAL', 'DATABASE_INTERNALS'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="block"><span className={LABEL_CLASS}>Difficulty</span><select className={FIELD_CLASS} value={drillForm.difficulty} onChange={(e) => setDrillForm({ ...drillForm, difficulty: e.target.value })}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((x) => <option key={x}>{x}</option>)}</select></label>
              </div>
              <label className="block"><span className={LABEL_CLASS}>Estimated minutes</span><input required type="number" min={1} max={240} className={FIELD_CLASS} value={drillForm.estimatedMinutes} onChange={(e) => setDrillForm({ ...drillForm, estimatedMinutes: Number(e.target.value) })} /></label>
              <label className="block"><span className={LABEL_CLASS}>Match skills (comma-separated)</span><input className={FIELD_CLASS} value={(drillForm.match_skills || []).join(', ')} onChange={(e) => setDrillForm({ ...drillForm, match_skills: parseList(e.target.value) })} placeholder="python, backend, system design" /></label>
              <label className="block"><span className={LABEL_CLASS}>Core skills tested (comma-separated)</span><input className={FIELD_CLASS} value={(drillForm.coreSkillsTested || []).join(', ')} onChange={(e) => setDrillForm({ ...drillForm, coreSkillsTested: parseList(e.target.value) })} /></label>
              <label className="block"><span className={LABEL_CLASS}>Description</span><textarea required maxLength={5000} rows={3} className={FIELD_CLASS} value={drillForm.description} onChange={(e) => setDrillForm({ ...drillForm, description: e.target.value })} /></label>
              <label className="block"><span className={LABEL_CLASS}>Starter question</span><textarea required maxLength={3000} rows={3} className={FIELD_CLASS} value={drillForm.sampleStarterQuestion} onChange={(e) => setDrillForm({ ...drillForm, sampleStarterQuestion: e.target.value })} /></label>
              <label className="block"><span className={LABEL_CLASS}>Recommendation reason (optional)</span><input className={FIELD_CLASS} value={drillForm.recommendedReason} onChange={(e) => setDrillForm({ ...drillForm, recommendedReason: e.target.value })} /></label>
              <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={drillForm.active} onChange={(e) => setDrillForm({ ...drillForm, active: e.target.checked })} /> Active for candidates</label>
            </form>
          )}

          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <button type="button" disabled={saving} onClick={(event) => {
              const form = (event.currentTarget.closest('.rounded-2xl') as HTMLElement | null)?.querySelector('form');
              form?.requestSubmit();
            }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to catalog'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}