import type { ContentStatus } from '../types/content';
import { STATUS_LABELS } from '../types/content';
import { StatusBadge } from './Badges';

interface StatusWorkflowProps {
  itemId: string;
  itemTitle: string;
  currentStatus: ContentStatus;
  isUpdating?: boolean;
  onChangeStatus: (id: string, status: ContentStatus) => void;
  compact?: boolean;
}

const STATUS_ORDER: ContentStatus[] = ['draft', 'approved', 'published'];

export function StatusWorkflow({
  itemId,
  itemTitle,
  currentStatus,
  isUpdating = false,
  onChangeStatus,
  compact = false,
}: StatusWorkflowProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 ${
        compact ? '' : 'pt-3 border-t border-[#E2E8F0]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#64748B]">الحالة:</span>
        <StatusBadge status={currentStatus} />
      </div>

      <div
        role="group"
        aria-label={`تغيير حالة ${itemTitle}`}
        className="inline-flex items-center p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg"
      >
        {STATUS_ORDER.map((statusOption) => {
          const isActive = currentStatus === statusOption;
          let activeClasses = 'bg-white text-[#0B192C] shadow-xs font-semibold';
          if (isActive && statusOption === 'published') {
            activeClasses = 'bg-[#15803D] text-white font-semibold shadow-xs';
          } else if (isActive && statusOption === 'approved') {
            activeClasses = 'bg-[#B8924A] text-white font-semibold shadow-xs';
          }

          return (
            <button
              key={statusOption}
              type="button"
              disabled={isUpdating}
              aria-pressed={isActive}
              aria-label={`تعيين حالة "${itemTitle}" إلى ${STATUS_LABELS[statusOption]}`}
              onClick={() => {
                if (!isActive) {
                  onChangeStatus(itemId, statusOption);
                }
              }}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0B192C] disabled:opacity-60 ${
                isActive
                  ? activeClasses
                  : 'text-[#475569] hover:text-[#0B192C] hover:bg-white/60'
              }`}
            >
              {STATUS_LABELS[statusOption]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
