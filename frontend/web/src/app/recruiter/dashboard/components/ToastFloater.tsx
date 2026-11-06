import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ToastState } from '../hooks/useToast';

export function ToastFloater({ toastMessage }: { toastMessage: ToastState | null }) {
  return (
    <>
      {/* TOAST NOTIFICATION FLOATER */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-surface border-indigo-500/40 text-accent-indigo backdrop-blur-md'
              : 'bg-surface border-rose-500/40 text-accent-rose backdrop-blur-md'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-accent-indigo shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-accent-rose shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </>
  );
}
