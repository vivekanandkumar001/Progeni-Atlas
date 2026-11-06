import { Briefcase, Plus, RefreshCw, X } from 'lucide-react';
import type { UseCreateJobReturn } from '../hooks/useCreateJob';

export function CreateJobModal({
  showCreateJobModal,
  setShowCreateJobModal,
  newJobTitle,
  setNewJobTitle,
  newJobDept,
  setNewJobDept,
  newJobLevel,
  setNewJobLevel,
  newJobDesc,
  setNewJobDesc,
  newJobDuration,
  setNewJobDuration,
  newJobSkills,
  setNewJobSkills,
  creatingJob,
  handleCreateJobSubmit,
}: UseCreateJobReturn) {
  if (!showCreateJobModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg p-6 rounded-2xl bg-surface border border-line space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent-indigo" />
            <h3 className="text-base font-bold text-ink">Configure New Job Role & AI Rubric</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateJobModal(false)}
            className="text-ink-muted hover:text-ink cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateJobSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink">
              Position Title <span className="text-accent-rose">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Please enter position title (e.g. Lead Distributed Systems Engineer)"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">Department</label>
              <input
                type="text"
                required
                placeholder="Please enter department (e.g. Infrastructure)"
                value={newJobDept}
                onChange={(e) => setNewJobDept(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">Seniority Level</label>
              <select
                value={newJobLevel}
                onChange={(e) => setNewJobLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Junior">Junior</option>
                <option value="Mid">Mid-Level</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Staff / Lead</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink">
              Required Technical Skills (Comma separated)
            </label>
            <input
              type="text"
              placeholder="Please enter required technical skills (e.g. Go, Kubernetes, Kafka)"
              value={newJobSkills}
              onChange={(e) => setNewJobSkills(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink">Interview Duration (minutes)</label>
            <input
              type="number"
              min={10}
              max={180}
              step={5}
              required
              value={newJobDuration}
              onChange={(e) => setNewJobDuration(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink">Job Description & Evaluation Focus</label>
            <textarea
              rows={3}
              placeholder="Please detail specific technical scenario expectations..."
              value={newJobDesc}
              onChange={(e) => setNewJobDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateJobModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingJob}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {creatingJob ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{creatingJob ? 'Publishing...' : 'Publish Position'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
