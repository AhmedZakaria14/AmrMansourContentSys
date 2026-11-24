import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  Video,
} from 'lucide-react';
import type {
  AggregatorContentItem,
  AppDraft,
  ContentCategory,
  DraftType,
  LiveNewsItem,
  LiveNewsResponse,
} from '../types/content';
import { CONTENT_CATEGORIES } from '../types/content';
import { countCharacters } from '../utils/contentUtils';
import { formatArabicTimeEgypt, formatDurationArabic } from '../utils/dateUtils';
import {
  extractTrendingItems,
  filterLiveNewsItems,
  findAggregatorMatch,
  formatCairoTimeHHMM,
  getDraftMapKey,
} from '../utils/liveNewsUtils';
import { CategoryBadge, LiveSourceBadge } from './Badges';

interface LiveNewsPageProps {
  data: LiveNewsResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  firestoreItems: AggregatorContentItem[];
  drafts: Record<string, AppDraft>;
  generatingKeys: Record<string, boolean>;
  onForceRefresh: () => void;
  onGenerateDraft: (
    item: LiveNewsItem,
    draftType: DraftType
  ) => Promise<{ ok: boolean; draft?: AppDraft; error?: string }>;
  onCopy: (text: string) => void;
  onOpenFirestoreDetail: (item: AggregatorContentItem) => void;
  onShowToast: (text: string, variant?: 'success' | 'error') => void;
}

export function LiveNewsPage({
  data,
  loading,
  refreshing,
  error,
  firestoreItems,
  drafts,
  generatingKeys,
  onForceRefresh,
  onGenerateDraft,
  onCopy,
  onOpenFirestoreDetail,
  onShowToast,
}: LiveNewsPageProps) {
  const [legalOnly, setLegalOnly] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | 'all'>('all');
  const [openDraftPanel, setOpenDraftPanel] = useState<Record<string, DraftType | null>>({});

  const allItems = data?.items ?? [];
  const lastUpdatedHHMM = formatCairoTimeHHMM(data?.fetchedAt);

  const trendingItems = useMemo(
    () => extractTrendingItems(allItems),
    [allItems]
  );

  const filteredStreamItems = useMemo(
    () =>
      filterLiveNewsItems(allItems, {
        legalOnly,
        category: selectedCategory,
      }),
    [allItems, legalOnly, selectedCategory]
  );

  const legalCount = useMemo(
    () => allItems.filter((i) => i.is_legal || i.legal_score >= 35).length,
    [allItems]
  );

  const succeededFeeds = useMemo(
    () => (data?.feeds ?? []).filter((f) => f.ok),
    [data?.feeds]
  );

  const handleDraftAction = async (item: LiveNewsItem, draftType: DraftType) => {
    const existing = drafts[getDraftMapKey(item.story_id, draftType)];
    const currentOpen = openDraftPanel[item.story_id];

    if (existing) {
      setOpenDraftPanel((prev) => ({
        ...prev,
        [item.story_id]: currentOpen === draftType ? null : draftType,
      }));
      return;
    }

    setOpenDraftPanel((prev) => ({ ...prev, [item.story_id]: draftType }));
    const result = await onGenerateDraft(item, draftType);
    if (!result.ok && result.error) {
      onShowToast(result.error, 'error');
    }
  };

  const handleRegenerateDraft = async (item: LiveNewsItem, draftType: DraftType) => {
    setOpenDraftPanel((prev) => ({ ...prev, [item.story_id]: draftType }));
    const result = await onGenerateDraft(item, draftType);
    if (result.ok) {
      onShowToast('تم تحديث المسودة وحفظها', 'success');
    } else if (result.error) {
      onShowToast(result.error, 'error');
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="جاري جلب الأخبار المباشرة">
        <div className="h-24 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        <div className="h-16 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-56 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        role="alert"
        className="bg-white border border-[#FECACA] rounded-xl p-8 text-center max-w-xl mx-auto my-8"
      >
        <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-lg font-bold text-[#0B192C] mb-2">تعذر جلب النشرة المباشرة</h2>
        <p className="text-sm text-[#475569] mb-5">{error}</p>
        <button
          type="button"
          onClick={onForceRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>تحديث الآن</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page Title & Live Refresh Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-[#475569] mb-2">
            <span data-testid="live-last-updated" className="tabular-nums">
              {lastUpdatedHHMM ? `آخر تحديث: ${lastUpdatedHHMM}` : 'متصل بالبث المباشر'}
            </span>
            <span aria-hidden="true">·</span>
            <span>بتوقيت القاهرة</span>
            {data?.feeds && data.feeds.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  المصادر المتصلة: {succeededFeeds.length}/{data.feeds.length}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">إجمالي الأخبار: {allItems.length}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B192C]">
            نشرة الأخبار المباشرة
          </h1>
          <p className="text-sm text-[#475569] mt-1">
            رصد فوري لأحدث أخبار مصر والتريندات مرتبة حسب الأهمية القانونية لمؤسسة عمرو منصور.
          </p>
        </div>

        <button
          type="button"
          onClick={onForceRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <RefreshCw
            className={`w-4 h-4 text-[#C9A45C] ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{refreshing ? 'جاري التحديث...' : 'تحديث الآن'}</span>
        </button>
      </div>

      {/* Warning banner if partial scoring fallback or refresh error occurred */}
      {(error || data?.scoringWarning) && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#FBF8F1] border border-[#E5D3AE] text-xs sm:text-sm text-[#7A581B] flex items-center justify-between gap-3"
        >
          <span>{error || data?.scoringWarning}</span>
        </div>
      )}

      {/* Feed Health Summary Strip */}
      {data?.feeds && data.feeds.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#475569]">
          <span className="font-semibold text-[#0B192C]">حالة المصادر:</span>
          {data.feeds.map((feed) => (
            <span key={feed.id} className="inline-flex items-center gap-1.5 tabular-nums">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${feed.ok ? 'text-[#15803D]' : 'text-[#94A3B8]'}`}
                aria-hidden="true"
              />
              <span className={feed.ok ? 'text-[#0F172A]' : 'text-[#64748B]'}>
                {feed.name} ({feed.ok ? feed.count : 'غير متاح'})
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Filter Controls Bar: «قانوني فقط» toggle + category chips */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={legalOnly}
            onClick={() => setLegalOnly((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              legalOnly
                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                : 'bg-[#F8FAFC] text-[#334155] border-[#CBD5E1] hover:bg-[#F1F5F9]'
            }`}
          >
            <Scale
              className={`w-4 h-4 ${legalOnly ? 'text-[#C9A45C]' : 'text-[#64748B]'}`}
              aria-hidden="true"
            />
            <span>قانوني فقط</span>
            <span className="tabular-nums opacity-80">({legalCount})</span>
          </button>

          <span className="hidden sm:inline-block h-6 w-px bg-[#E2E8F0] mx-1" aria-hidden="true" />

          {/* Category filter chips */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية حسب التصنيف">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              aria-pressed={selectedCategory === 'all'}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                  : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
              }`}
            >
              الكل
            </button>
            {CONTENT_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0B192C] text-white border-[#0B192C]'
                      : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <p
          data-testid="live-stream-count"
          className="text-xs sm:text-sm font-semibold text-[#0B192C] tabular-nums shrink-0"
        >
          المعروض: {filteredStreamItems.length} خبر
        </p>
      </div>

      {/* Main Live Stream sorted by legal_score descending */}
      <section aria-labelledby="section-live-stream-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="section-live-stream-heading"
            className="text-xl font-bold text-[#0B192C]"
          >
            البث الإخباري المرتب قانونياً
          </h2>
          <span className="text-xs font-medium text-[#64748B] tabular-nums">
            مرتب تنازلياً حسب الأهمية القانونية
          </span>
        </div>

        {filteredStreamItems.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
            <h3 className="text-base font-bold text-[#0B192C] mb-2">
              لا توجد أخبار مطابقة للتصفية الحالية
            </h3>
            <p className="text-sm text-[#64748B] mb-5">
              جرّب إلغاء فلتر «قانوني فقط» أو اختيار «الكل» لعرض جميع الأخبار المتاحة.
            </p>
            <button
              type="button"
              onClick={() => {
                setLegalOnly(false);
                setSelectedCategory('all');
              }}
              className="px-4 py-2 min-h-[42px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              عرض كل الأخبار
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredStreamItems.map((item) => {
              const matchedItem = findAggregatorMatch(item, firestoreItems);
              return (
                <LiveNewsCard
                  key={item.id}
                  item={item}
                  matchedItem={matchedItem}
                  drafts={drafts}
                  generatingKeys={generatingKeys}
                  activePanel={openDraftPanel[item.story_id] ?? null}
                  onToggleDraft={handleDraftAction}
                  onRegenerateDraft={handleRegenerateDraft}
                  onCopy={onCopy}
                  onOpenFirestoreDetail={onOpenFirestoreDetail}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Separate «التريندات» Section */}
      {trendingItems.length > 0 && (
        <section aria-labelledby="section-trends-heading" className="space-y-4 pt-2 border-t border-[#E2E8F0]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#B8924A]" aria-hidden="true" />
              <h2
                id="section-trends-heading"
                className="text-xl font-bold text-[#0B192C]"
              >
                التريندات
              </h2>
            </div>
            <span className="text-xs font-medium text-[#64748B] tabular-nums">
              {trendingItems.length} موضوع متداول في مصر
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingItems.slice(0, 6).map((item) => {
              const matchedItem = findAggregatorMatch(item, firestoreItems);
              return (
                <LiveNewsCard
                  key={`trend-${item.id}`}
                  item={item}
                  matchedItem={matchedItem}
                  compact
                  drafts={drafts}
                  generatingKeys={generatingKeys}
                  activePanel={openDraftPanel[item.story_id] ?? null}
                  onToggleDraft={handleDraftAction}
                  onRegenerateDraft={handleRegenerateDraft}
                  onCopy={onCopy}
                  onOpenFirestoreDetail={onOpenFirestoreDetail}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function LiveNewsCard({
  item,
  matchedItem,
  compact = false,
  drafts,
  generatingKeys,
  activePanel,
  onToggleDraft,
  onRegenerateDraft,
  onCopy,
  onOpenFirestoreDetail,
}: {
  item: LiveNewsItem;
  matchedItem: AggregatorContentItem | null;
  compact?: boolean;
  drafts: Record<string, AppDraft>;
  generatingKeys: Record<string, boolean>;
  activePanel: DraftType | null;
  onToggleDraft: (item: LiveNewsItem, draftType: DraftType) => void;
  onRegenerateDraft: (item: LiveNewsItem, draftType: DraftType) => void;
  onCopy: (text: string) => void;
  onOpenFirestoreDetail: (item: AggregatorContentItem) => void;
}) {
  const postKey = getDraftMapKey(item.story_id, 'post');
  const scriptKey = getDraftMapKey(item.story_id, 'script');
  const postDraft = drafts[postKey];
  const scriptDraft = drafts[scriptKey];
  const isGeneratingPost = Boolean(generatingKeys[postKey]);
  const isGeneratingScript = Boolean(generatingKeys[scriptKey]);

  const activeDraft =
    activePanel === 'post'
      ? postDraft
      : activePanel === 'script'
      ? scriptDraft
      : undefined;
  const activeGenerating =
    activePanel === 'post'
      ? isGeneratingPost
      : activePanel === 'script'
      ? isGeneratingScript
      : false;

  const pubTimeFormatted = useMemo(() => {
    const d = new Date(item.pub_date);
    return Number.isNaN(d.getTime()) ? '' : formatArabicTimeEgypt(d);
  }, [item.pub_date]);

  return (
    <article className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        {/* Top Metadata Row (single status badge + clean typographic separators) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
            <LiveSourceBadge isApproved={Boolean(matchedItem)} />
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#0B192C]">{item.category}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#64748B] tabular-nums">
            <span className="font-semibold text-[#0B192C]">
              أهمية قانونية: {item.legal_score}%
            </span>
            {pubTimeFormatted && (
              <>
                <span aria-hidden="true">·</span>
                <span>{pubTimeFormatted}</span>
              </>
            )}
          </div>
        </div>

        {/* Source & Title */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[#1E3A5F] hover:text-[#B8924A] transition-colors truncate max-w-full"
              >
                <span className="truncate">المصدر: {item.source_name}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <span>المصدر: {item.source_name}</span>
            )}
            {item.approx_traffic && (
              <span className="tabular-nums text-[#7A581B] font-medium whitespace-nowrap">
                عمليات البحث: {item.approx_traffic}
              </span>
            )}
          </div>

          <h3
            className={`${
              compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
            } font-bold text-[#0B192C] leading-snug`}
          >
            {item.title}
          </h3>
        </div>

        {/* Short Description */}
        {item.description && (
          <p className="text-sm text-[#334155] leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Legal Angle Callout */}
        {item.legal_angle && (
          <div className="p-3.5 rounded-lg bg-[#FBF8F1] border border-[#EDE2CA]">
            <p className="text-xs font-bold text-[#7A581B] mb-1">الزاوية القانونية</p>
            <p className="text-xs sm:text-sm text-[#1E293B] leading-relaxed">
              {item.legal_angle}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons: Post & Script generation + Matched Firestore view */}
      <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onToggleDraft(item, 'post')}
            disabled={isGeneratingPost}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'post' || postDraft
                ? 'bg-[#0B192C] text-white hover:bg-[#132944]'
                : 'bg-[#F8FAFC] text-[#0B192C] border border-[#CBD5E1] hover:bg-[#F1F5F9]'
            } disabled:opacity-60`}
          >
            {isGeneratingPost ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A45C]" aria-hidden="true" />
            ) : (
              <FileText
                className={`w-3.5 h-3.5 ${
                  activePanel === 'post' || postDraft ? 'text-[#C9A45C]' : 'text-[#0B192C]'
                }`}
                aria-hidden="true"
              />
            )}
            <span>
              {isGeneratingPost
                ? 'جاري صياغة البوست...'
                : postDraft
                ? 'بوست فيسبوك (جاهز)'
                : 'بوست فيسبوك'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void onToggleDraft(item, 'script')}
            disabled={isGeneratingScript}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activePanel === 'script' || scriptDraft
                ? 'bg-[#0B192C] text-white hover:bg-[#132944]'
                : 'bg-[#F8FAFC] text-[#0B192C] border border-[#CBD5E1] hover:bg-[#F1F5F9]'
            } disabled:opacity-60`}
          >
            {isGeneratingScript ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A45C]" aria-hidden="true" />
            ) : (
              <Video
                className={`w-3.5 h-3.5 ${
                  activePanel === 'script' || scriptDraft ? 'text-[#C9A45C]' : 'text-[#0B192C]'
                }`}
                aria-hidden="true"
              />
            )}
            <span>
              {isGeneratingScript
                ? 'جاري صياغة السكربت...'
                : scriptDraft
                ? 'سكربت فيديو (جاهز)'
                : 'سكربت فيديو'}
            </span>
          </button>

          {matchedItem && (
            <button
              type="button"
              onClick={() => onOpenFirestoreDetail(matchedItem)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#166534] bg-[#DCFCE7]/60 hover:bg-[#DCFCE7] border border-[#86EFAC] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>عرض المحتوى المعتمد</span>
            </button>
          )}
        </div>

        {/* Inline Draft Display */}
        {activePanel && (activeGenerating || activeDraft) && (
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            {activeGenerating ? (
              <div className="flex items-center gap-2 text-xs text-[#475569] py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#0B192C]" aria-hidden="true" />
                <span>جاري إعداد الصياغة القانونية انطلاقاً من معطيات الخبر فقط...</span>
              </div>
            ) : (
              activeDraft && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2 text-xs text-[#64748B] tabular-nums">
                      <span className="font-bold text-[#0B192C]">
                        {activeDraft.draft_type === 'post'
                          ? 'مسودة بوست فيسبوك'
                          : 'مسودة سكربت فيديو'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{countCharacters(activeDraft.text)} حرف</span>
                      {activeDraft.duration_sec && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[#0B192C]">
                            <Clock className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
                            {formatDurationArabic(activeDraft.duration_sec)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onRegenerateDraft(item, activeDraft.draft_type)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs font-medium text-[#1E3A5F] hover:bg-[#E2E8F0]/60 rounded-md transition-colors whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إعادة توليد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onCopy(activeDraft.text)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] bg-[#0B192C] hover:bg-[#132944] text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-line">
                    {activeDraft.text}
                  </p>
                </>
              )
            )}
          </div>
        )}
      </div>
    </article>
  );
}
