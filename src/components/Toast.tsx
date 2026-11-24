import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error';
}

interface ToastProps {
  toast: ToastMessage | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  const isError = toast.variant === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-5 z-50 pointer-events-none"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${
          isError
            ? 'bg-[#7F1D1D] text-white border-[#991B1B]'
            : 'bg-[#0B192C] text-white border-[#C9A45C]/50'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 text-[#FCA5A5] shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-[#C9A45C] shrink-0" aria-hidden="true" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
