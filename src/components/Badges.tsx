import type { ContentCategory, ContentStatus, ContentType } from '../types/content';
import { CONTENT_TYPE_LABELS, STATUS_LABELS } from '../types/content';

const CATEGORY_STYLES: Record<ContentCategory, string> = {
  'قضية رأي عام': 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
  'حكم محكمة': 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]',
  'قانون جديد': 'bg-[#F7F1E3] text-[#7A581B] border-[#E5D3AE]',
  'قرار رسمي': 'bg-[#F1F5F9] text-[#1E293B] border-[#CBD5E1]',
  'تريند': 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
};

const STATUS_STYLES: Record<ContentStatus, string> = {
  draft: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
  approved: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  published: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
};

export function CategoryBadge({ category }: { category: ContentCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded border whitespace-nowrap shrink-0 ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded border whitespace-nowrap shrink-0 ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TypeLabel({ type }: { type: ContentType }) {
  return (
    <span className="text-xs font-medium text-[#475569] whitespace-nowrap shrink-0">
      {CONTENT_TYPE_LABELS[type]}
    </span>
  );
}

export function SampleDataBadge() {
  return (
    <span
      data-testid="sample-data-badge"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-[#D4B475] bg-[#FBF6EA] text-[#7A581B] whitespace-nowrap shrink-0"
    >
      بيانات تجريبية
    </span>
  );
}
