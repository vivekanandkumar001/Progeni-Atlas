import { Check, Scale, X } from 'lucide-react';
import { Spinner } from '@/components/super-admin/ui';
import type { RateCard } from '@/lib/super-admin';

interface RateModalProps {
  rateModalOpen: boolean;
  setRateModalOpen: (open: boolean) => void;
  selectedRateCard: RateCard | null;
  formRateValues: Record<string, string>;
  setFormRateValues: (values: Record<string, string>) => void;
  actionLoading: boolean;
  handleUpdateRateCard: () => Promise<void>;
}

export function RateModal({
  rateModalOpen,
  setRateModalOpen,
  selectedRateCard,
  formRateValues,
  setFormRateValues,
  actionLoading,
  handleUpdateRateCard,
}: RateModalProps) {
  if (!rateModalOpen || !selectedRateCard) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setRateModalOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2 text-accent-cyan">
            <Scale className="h-5 w-5" />
            <h3 className="font-bold text-ink">
              Update Rate Card ({selectedRateCard.serviceType})
            </h3>
          </div>
          <button
            onClick={() => setRateModalOpen(false)}
            className="text-ink-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <p className="text-ink-muted">
            Editing rate card creates an incremented version (v{selectedRateCard.version + 1}) and
            records a Super Admin audit log entry.
          </p>
          {Object.keys(formRateValues).map((key) => (
            <div key={key}>
              <label className="block text-ink-muted mb-1 font-mono uppercase text-[11px]">
                {key.replace(/_/g, ' ')} (₹ INR)
              </label>
              <input
                type="text"
                value={formRateValues[key]}
                onChange={(e) =>
                  setFormRateValues({ ...formRateValues, [key]: e.target.value })
                }
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-ink outline-none"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setRateModalOpen(false)}
            className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleUpdateRateCard()}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {actionLoading ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
            Save Versioned Rate Card
          </button>
        </div>
      </div>
    </div>
  );
}
