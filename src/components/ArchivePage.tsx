import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  AggregatorContentItem,
  ArchiveFilters,
  ContentCategory,
  ContentStatus,
  ContentType,
  DateCountOption,
} from '../types/content';
import { CONTENT_CATEGORIES, CONTENT_TYPE_LABELS } from '../types/content';
import { countCharacters, filterArchiveContent } from '../utils/contentUtils';
import { formatArabicContentDate, formatDurationArabic } from '../utils/dateUtils';
import { CategoryBadge, SampleDataBadge, TypeLabel } from './Badges';
import { StatusWorkflow } from './StatusWorkflow';

interface ArchivePageProps {
  items: AggregatorContentItem[];
  availableDates: DateCountOption[];
  totalAllDaysCount: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  loading: boolean;
  isSampleData: boolean;
  updatingIds: Record<string, boolean>;
  onUpdateStatus: (id: string, status: ContentStatus) => void;
  onCopy: (text: string) => void;
  onOpenDetail: (item: AggregatorContentItem) => void;
}

export function ArchivePage({
  items,
  availableDates,
  totalAllDaysCount,
  selectedDate,
  onSelectDate,
  loading,
  isSampleData,
  updatingIds,
  onUpdateStatus,
  onCopy,
  onOpenDetail,
}: ArchivePageProps) {
  const [category, setCategory] = useState<ContentCategory | 'all'>('all');
  const [type, setType] = useState<ContentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filters: ArchiveFilters = useMemo(
    () => ({
      selectedDate,
      category,
      type,
      searchQuery,
    }),
    [selectedDate, category, type, searchQuery]
  );

  const filteredItems = useMemo(
    () => filterArchiveContent(items, filters),
    [items, filters]
  );

  const hasActiveFilters =
    selectedDate !== '' ||
    category !== 'all' ||
    type !== 'all' ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    onSelectDate('');
    setCategory('all');
    setType('all');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="جاري تحميل الأرشيف">
        <div className="h-24 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0B192C]">
              أرشيف المحتوى القانوني
            </h1>
            {isSampleData && <SampleDataBadge />}
          </div>
          <p className="text-sm text-[#475569]">
            تصفح المواضيع والبوستات والسكربتات حسب التاريخ أو التصنيف أو البحث النصي.
          </p>
        </div>

        <p
          data-testid="archive-result-count"
          className="text-sm font-semibold text-[#0B192C] tabular-nums"
        >
          النتائج: {filteredItems.length} عنصر
        </p>
      </div>

      {/* Main Split Layout: Past Days Sidebar (Right in RTL) + Filter & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar: Date Picker + List of Past Days */}
        <aside
          aria-label="تصفح حسب التاريخ"
          className="lg:col-span-3 bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div>
            <label
              htmlFor="archive-date-picker"
              className="flex items-center gap-2 text-sm font-bold text-[#0B192C] mb-2"
            >
              <Calendar className="w-4 h-4 text-[#B8924A]" aria-hidden="true" />
              <span>اختيار تاريخ محدد</span>
            </label>
            <input
              id="archive-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="w-full px-3 py-2 min-h-[42px] text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C]"
            />
          </div>

          <div className="pt-3 border-t border-[#E2E8F0]">
            <p className="text-xs font-bold text-[#64748B] mb-2.5">الأيام السابقة</p>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              <button
                type="button"
                onClick={() => onSelectDate('')}
                aria-pressed={selectedDate === ''}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm transition-colors text-right ${
                  selectedDate === ''
                    ? 'bg-[#0B192C] text-white font-semibold'
                    : 'text-[#334155] hover:bg-[#F1F5F9]'
                }`}
              >
                <span>جميع الأيام</span>
                <span className="tabular-nums opacity-80">{totalAllDaysCount}</span>
              </button>

              {availableDates.map((entry) => {
                const active = selectedDate === entry.date;
                return (
                  <button
                    key={entry.date}
                    type="button"
                    onClick={() => onSelectDate(entry.date)}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm transition-colors text-right ${
                      active
                        ? 'bg-[#0B192C] text-white font-semibold'
                        : 'text-[#334155] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <span className="truncate">
                      {formatArabicContentDate(entry.date, { compact: true })}
                    </span>
                    <span className="tabular-nums opacity-80 shrink-0">
                      {entry.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Column: Search, Filters & Results */}
        <div className="lg:col-span-9 space-y-5">
          {/* Search & Filters Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Text search over title & summary */}
              <div className="md:col-span-6">
                <label htmlFor="archive-search" className="sr-only">
                  البحث في العنوان والملخص
                </label>
                <div className="relative">
                  <Search
                    className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="archive-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في العنوان أو الملخص..."
                    className="w-full pr-10 pl-9 py-2 min-h-[42px] text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="مسح نص البحث"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0B192C] rounded"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Select */}
              <div className="md:col-span-3">
                <label htmlFor="archive-category" className="sr-only">
                  التصنيف
                </label>
                <div className="relative">
                  <select
                    id="archive-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ContentCategory | 'all')
                    }
                    className="w-full appearance-none pr-3.5 pl-9 py-2 min-h-[42px] text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C]"
                  >
                    <option value="all">كل التصنيفات</option>
                    {CONTENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Type Select */}
              <div className="md:col-span-3">
                <label htmlFor="archive-type" className="sr-only">
                  نوع المحتوى
                </label>
                <div className="relative">
                  <select
                    id="archive-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as ContentType | 'all')}
                    className="w-full appearance-none pr-3.5 pl-9 py-2 min-h-[42px] text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C]"
                  >
                    <option value="all">كل الأنواع</option>
                    <option value="topic">{CONTENT_TYPE_LABELS.topic}</option>
                    <option value="post">{CONTENT_TYPE_LABELS.post}</option>
                    <option value="script">{CONTENT_TYPE_LABELS.script}</option>
                  </select>
                  <ChevronDown
                    className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
                <p className="text-xs text-[#64748B]">
                  {filters.selectedDate
                    ? `عرض محتوى يوم ${formatArabicContentDate(filters.selectedDate)}`
                    : 'يتم تطبيق فلاتر البحث الحالية'}
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] hover:text-[#B8924A] transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إعادة ضبط الفلاتر</span>
                </button>
              </div>
            )}
          </div>

          {/* Filtered Results */}
          {filteredItems.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
              <h2 className="text-base font-bold text-[#0B192C] mb-2">
                لا توجد نتائج مطابقة لخيارات التصفية
              </h2>
              <p className="text-sm text-[#64748B] mb-5">
                جرّب تغيير التاريخ أو التصنيف أو مسح نص البحث لعرض جميع العناصر المتاحة.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => {
                const copyableText =
                  item.type === 'post'
                    ? item.post_text
                    : item.type === 'script'
                    ? item.script_text
                    : undefined;

                return (
                  <article
                    key={item.id}
                    className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                        <CategoryBadge category={item.category} />
                        <span aria-hidden="true">·</span>
                        <TypeLabel type={item.type} />
                        <span aria-hidden="true">·</span>
                        <span>{formatArabicContentDate(item.content_date, { compact: true })}</span>
                        {item.type === 'script' && item.duration_sec && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
                              {formatDurationArabic(item.duration_sec)}
                            </span>
                          </>
                        )}
                      </div>

                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:text-[#B8924A] transition-colors"
                        >
                          <span>{item.source_name}</span>
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-[#64748B]">{item.source_name}</span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#0B192C] leading-snug">
                      {item.title}
                    </h3>

                    {item.summary && (
                      <p className="text-sm text-[#334155] leading-relaxed">
                        {item.summary}
                      </p>
                    )}

                    {item.type === 'topic' && item.legal_angle && (
                      <div className="p-3 rounded-lg bg-[#FBF8F1] border border-[#EDE2CA] text-xs sm:text-sm text-[#1E293B]">
                        <span className="font-bold text-[#7A581B] ml-1.5">
                          الزاوية القانونية:
                        </span>
                        {item.legal_angle}
                      </div>
                    )}

                    {copyableText && (
                      <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-sm text-[#1E293B] leading-relaxed whitespace-pre-line line-clamp-4">
                          {copyableText}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {copyableText && (
                          <button
                            type="button"
                            onClick={() => onCopy(copyableText)}
                            aria-label={`نسخ نص ${item.title}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-[#0B192C] hover:bg-[#132944] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                            <span>نسخ</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDetail(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#0B192C] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>عرض التفاصيل</span>
                        </button>
                      </div>

                      {copyableText && (
                        <span className="text-xs text-[#64748B] tabular-nums">
                          {countCharacters(copyableText)} حرف
                        </span>
                      )}
                    </div>

                    {(item.type === 'post' || item.type === 'script') && (
                      <StatusWorkflow
                        itemId={item.id}
                        itemTitle={item.title}
                        currentStatus={item.status}
                        isUpdating={Boolean(updatingIds[item.id])}
                        onChangeStatus={onUpdateStatus}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
