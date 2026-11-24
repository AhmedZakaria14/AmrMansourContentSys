import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  RefreshCw,
  Video,
} from 'lucide-react';
import type { AggregatorContentItem, ContentStatus, TopicBundle } from '../types/content';
import type { SampleDataReason } from '../hooks/useAggregatorContent';
import { countCharacters, groupDayContent } from '../utils/contentUtils';
import {
  formatArabicContentDate,
  formatDurationArabic,
  getEgyptDateString,
} from '../utils/dateUtils';
import { CategoryBadge, SampleDataBadge, StatusBadge } from './Badges';
import { StatusWorkflow } from './StatusWorkflow';

interface TodayPageProps {
  items: AggregatorContentItem[];
  loading: boolean;
  error: string | null;
  isSampleData: boolean;
  sampleReason: SampleDataReason;
  updatingIds: Record<string, boolean>;
  onUpdateStatus: (id: string, status: ContentStatus) => void;
  onCopy: (text: string) => void;
  onOpenDetail: (item: AggregatorContentItem) => void;
  onRetry: () => void;
  onGoToArchive: () => void;
}

type SectionFilter = 'all' | 'topics' | 'posts' | 'scripts';

export function TodayPage({
  items,
  loading,
  error,
  isSampleData,
  sampleReason,
  updatingIds,
  onUpdateStatus,
  onCopy,
  onOpenDetail,
  onRetry,
  onGoToArchive,
}: TodayPageProps) {
  const [activeSection, setActiveSection] = useState<SectionFilter>('all');
  const todayDate = useMemo(() => getEgyptDateString(), []);
  const formattedToday = useMemo(() => formatArabicContentDate(todayDate), [todayDate]);

  const daySummary = useMemo(
    () => groupDayContent(items, todayDate),
    [items, todayDate]
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="جاري تحميل محتوى اليوم">
        <div className="h-24 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((n) => (
            <div key={n} className="h-64 bg-white border border-[#E2E8F0] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="bg-white border border-[#FECACA] rounded-xl p-8 text-center max-w-xl mx-auto my-8"
      >
        <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-lg font-bold text-[#0B192C] mb-2">تعذر تحميل المحتوى</h2>
        <p className="text-sm text-[#475569] mb-5">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          <span>إعادة المحاولة</span>
        </button>
      </div>
    );
  }

  const isTodayEmpty =
    daySummary.stats.topicsCount === 0 &&
    daySummary.stats.postsCount === 0 &&
    daySummary.stats.scriptsCount === 0;

  return (
    <div className="space-y-8">
      {/* Page Title & Egypt Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569]">
              <Calendar className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
              <span>{formattedToday}</span>
              <span aria-hidden="true">·</span>
              <span>بتوقيت القاهرة</span>
            </span>
            {isSampleData && <SampleDataBadge />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B192C]">
            محتوى اليوم القانوني
          </h1>
          {isSampleData && (
            <p className="text-xs text-[#7A581B] mt-1.5">
              {sampleReason === 'empty_collection' ? (
                <>
                  مجموعة{' '}
                  <code dir="ltr" className="font-mono text-[#0B192C] whitespace-nowrap inline-block">
                    aggregator_content
                  </code>{' '}
                  فارغة حالياً — يتم عرض بيانات تجريبية لمعاينة اللوحة.
                </>
              ) : (
                <>
                  يتم عرض بيانات تجريبية لحين ربط إعدادات مشروع Firebase في{' '}
                  <code dir="ltr" className="font-mono text-[#0B192C] whitespace-nowrap inline-block">
                    src/firebase-config.ts
                  </code>
                  .
                </>
              )}
            </p>
          )}
        </div>

        {/* Section Filter Segmented Control */}
        <div
          role="tablist"
          aria-label="تصفية أقسام اليوم"
          className="inline-flex items-center p-1 bg-white border border-[#E2E8F0] rounded-lg self-start sm:self-auto overflow-x-auto max-w-full"
        >
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'topics', label: 'المواضيع' },
              { id: 'posts', label: 'البوستات' },
              { id: 'scripts', label: 'السكربتات' },
            ] as const
          ).map((tab) => {
            const selected = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveSection(tab.id)}
                className={`px-3.5 py-1.5 min-h-[36px] text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-[#0B192C] text-white'
                    : 'text-[#475569] hover:text-[#0B192C]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Bar (4 flat institutional cells) */}
      <section aria-label="إحصائيات محتوى اليوم">
        <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E2E8F0] rounded-xl divide-y lg:divide-y-0 divide-x divide-x-reverse divide-[#E2E8F0] overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-[#64748B]">مواضيع اليوم</p>
            <p
              data-testid="stat-topics"
              className="text-2xl sm:text-3xl font-bold text-[#0B192C] tabular-nums mt-1.5"
            >
              {daySummary.stats.topicsCount}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-[#64748B]">بوستات جاهزة</p>
            <p
              data-testid="stat-posts"
              className="text-2xl sm:text-3xl font-bold text-[#0B192C] tabular-nums mt-1.5"
            >
              {daySummary.stats.postsCount}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-[#64748B]">سكربتات فيديو</p>
            <p
              data-testid="stat-scripts"
              className="text-2xl sm:text-3xl font-bold text-[#0B192C] tabular-nums mt-1.5"
            >
              {daySummary.stats.scriptsCount}
            </p>
          </div>
          <div className="p-4 sm:p-5 bg-[#F8FAFC]">
            <p className="text-xs font-medium text-[#166534]">تم النشر اليوم</p>
            <p
              data-testid="stat-published"
              className="text-2xl sm:text-3xl font-bold text-[#15803D] tabular-nums mt-1.5"
            >
              {daySummary.stats.publishedCount}
            </p>
          </div>
        </div>
      </section>

      {isTodayEmpty ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
          <h2 className="text-lg font-bold text-[#0B192C] mb-2">
            لا يوجد محتوى مسجل ليوم {formattedToday} بعد
          </h2>
          <p className="text-sm text-[#475569] mb-6 max-w-md mx-auto">
            بمجرد وصول مواضيع اليوم الجديدة من نظام التجميع إلى Firestore ستظهر هنا تلقائياً بشكل
            فوري. يمكنك تصفح محتوى الأيام السابقة من الأرشيف.
          </p>
          <button
            type="button"
            onClick={onGoToArchive}
            className="px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            استعراض الأرشيف
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* SECTION 1: المواضيع القانونية */}
          {(activeSection === 'all' || activeSection === 'topics') && (
            <section aria-labelledby="section-topics-heading" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="section-topics-heading"
                  className="text-xl font-bold text-[#0B192C]"
                >
                  المواضيع القانونية
                </h2>
                <span className="text-xs font-medium text-[#64748B] tabular-nums">
                  {daySummary.topics.length} موضوع
                </span>
              </div>

              {daySummary.topics.length === 0 ? (
                <p className="text-sm text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl p-6">
                  لا توجد مواضيع قانونية مضافة لليوم.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {daySummary.topics.map((bundle) => (
                    <TopicCard
                      key={bundle.topic.id}
                      bundle={bundle}
                      onCopy={onCopy}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: بوستات جاهزة للنشر */}
          {(activeSection === 'all' || activeSection === 'posts') && (
            <section aria-labelledby="section-posts-heading" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="section-posts-heading"
                  className="text-xl font-bold text-[#0B192C]"
                >
                  بوستات جاهزة للنشر
                </h2>
                <span className="text-xs font-medium text-[#64748B] tabular-nums">
                  {daySummary.posts.length} بوست
                </span>
              </div>

              {daySummary.posts.length === 0 ? (
                <p className="text-sm text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl p-6">
                  لا توجد بوستات فيسبوك جاهزة لليوم.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {daySummary.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isUpdating={Boolean(updatingIds[post.id])}
                      onUpdateStatus={onUpdateStatus}
                      onCopy={onCopy}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: سكربتات فيديو */}
          {(activeSection === 'all' || activeSection === 'scripts') && (
            <section aria-labelledby="section-scripts-heading" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="section-scripts-heading"
                  className="text-xl font-bold text-[#0B192C]"
                >
                  سكربتات فيديو
                </h2>
                <span className="text-xs font-medium text-[#64748B] tabular-nums">
                  {daySummary.scripts.length} سكربت
                </span>
              </div>

              {daySummary.scripts.length === 0 ? (
                <p className="text-sm text-[#64748B] bg-white border border-[#E2E8F0] rounded-xl p-6">
                  لا توجد سكربتات فيديو جاهزة لليوم.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {daySummary.scripts.map((script) => (
                    <ScriptCard
                      key={script.id}
                      script={script}
                      isUpdating={Boolean(updatingIds[script.id])}
                      onUpdateStatus={onUpdateStatus}
                      onCopy={onCopy}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TopicCard({
  bundle,
  onCopy,
  onOpenDetail,
}: {
  bundle: TopicBundle;
  onCopy: (text: string) => void;
  onOpenDetail: (item: AggregatorContentItem) => void;
}) {
  const { topic, linkedPost, linkedScript } = bundle;

  return (
    <article className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-4">
      <div className="space-y-3.5">
        {/* Top Metadata Line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryBadge category={topic.category} />

          {topic.source_url ? (
            <a
              href={topic.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] hover:text-[#B8924A] transition-colors"
            >
              <span>المصدر: {topic.source_name}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs font-medium text-[#64748B]">
              المصدر: {topic.source_name}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-[#0B192C] leading-snug">
          {topic.title}
        </h3>

        {/* 2-line Summary */}
        {topic.summary && (
          <p className="text-sm text-[#334155] leading-relaxed line-clamp-2">
            {topic.summary}
          </p>
        )}

        {/* Legal Angle */}
        {topic.legal_angle && (
          <div className="p-3.5 rounded-lg bg-[#FBF8F1] border border-[#EDE2CA]">
            <p className="text-xs font-bold text-[#7A581B] mb-1">الزاوية القانونية</p>
            <p className="text-xs sm:text-sm text-[#1E293B] leading-relaxed">
              {topic.legal_angle}
            </p>
          </div>
        )}

        {/* Linked Post & Script Summary Strip */}
        {(linkedPost || linkedScript) && (
          <div className="pt-2 space-y-2">
            {linkedPost && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#0B192C] shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-[#0B192C] truncate">
                    بوست فيسبوك مرتبط
                  </span>
                  <StatusBadge status={linkedPost.status} />
                </div>
                {linkedPost.post_text && (
                  <button
                    type="button"
                    onClick={() => onCopy(linkedPost.post_text!)}
                    aria-label={`نسخ البوست المرتبط بموضوع ${topic.title}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] text-xs font-semibold text-[#0B192C] hover:bg-[#E2E8F0]/70 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
                    <span>نسخ البوست</span>
                  </button>
                )}
              </div>
            )}

            {linkedScript && (
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center gap-2 min-w-0">
                  <Video className="w-4 h-4 text-[#0B192C] shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-[#0B192C] truncate">
                    سكربت فيديو ({formatDurationArabic(linkedScript.duration_sec)})
                  </span>
                  <StatusBadge status={linkedScript.status} />
                </div>
                {linkedScript.script_text && (
                  <button
                    type="button"
                    onClick={() => onCopy(linkedScript.script_text!)}
                    aria-label={`نسخ السكربت المرتبط بموضوع ${topic.title}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] text-xs font-semibold text-[#0B192C] hover:bg-[#E2E8F0]/70 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
                    <span>نسخ السكربت</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end">
        <button
          type="button"
          onClick={() => onOpenDetail(topic)}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-[#0B192C] hover:bg-[#132944] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          <Eye className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
          <span>عرض التفاصيل والبوست والسكربت</span>
        </button>
      </div>
    </article>
  );
}

function PostCard({
  post,
  isUpdating,
  onUpdateStatus,
  onCopy,
  onOpenDetail,
}: {
  post: AggregatorContentItem;
  isUpdating: boolean;
  onUpdateStatus: (id: string, status: ContentStatus) => void;
  onCopy: (text: string) => void;
  onOpenDetail: (item: AggregatorContentItem) => void;
}) {
  const text = post.post_text ?? '';
  const charCount = countCharacters(text);

  return (
    <article className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryBadge category={post.category} />
          <span className="text-xs text-[#64748B] tabular-nums">
            {charCount} حرف
          </span>
        </div>

        <h3 className="text-base font-bold text-[#0B192C] leading-snug">
          {post.title}
        </h3>

        <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#1E293B] leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
          {text || 'لا يوجد نص للبوست.'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onCopy(text)}
            disabled={!text}
            aria-label={`نسخ نص ${post.title}`}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-[#0B192C] hover:bg-[#132944] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Copy className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
            <span>نسخ البوست</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(post)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#1E3A5F] hover:bg-[#F1F5F9] rounded-lg transition-colors whitespace-nowrap"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>عرض التفاصيل</span>
          </button>
        </div>

        <StatusWorkflow
          itemId={post.id}
          itemTitle={post.title}
          currentStatus={post.status}
          isUpdating={isUpdating}
          onChangeStatus={onUpdateStatus}
        />
      </div>
    </article>
  );
}

function ScriptCard({
  script,
  isUpdating,
  onUpdateStatus,
  onCopy,
  onOpenDetail,
}: {
  script: AggregatorContentItem;
  isUpdating: boolean;
  onUpdateStatus: (id: string, status: ContentStatus) => void;
  onCopy: (text: string) => void;
  onOpenDetail: (item: AggregatorContentItem) => void;
}) {
  const text = script.script_text ?? '';
  const charCount = countCharacters(text);

  return (
    <article className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CategoryBadge category={script.category} />
          <div className="flex items-center gap-2 text-xs text-[#64748B] tabular-nums">
            <span className="inline-flex items-center gap-1 font-medium text-[#0B192C]">
              <Clock className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
              <span>{formatDurationArabic(script.duration_sec)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{charCount} حرف</span>
          </div>
        </div>

        <h3 className="text-base font-bold text-[#0B192C] leading-snug">
          {script.title}
        </h3>

        <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#1E293B] leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
          {text || 'لا يوجد نص للسكربت.'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onCopy(text)}
            disabled={!text}
            aria-label={`نسخ نص ${script.title}`}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-[#0B192C] hover:bg-[#132944] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Copy className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
            <span>نسخ السكربت</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetail(script)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#1E3A5F] hover:bg-[#F1F5F9] rounded-lg transition-colors whitespace-nowrap"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>عرض التفاصيل</span>
          </button>
        </div>

        <StatusWorkflow
          itemId={script.id}
          itemTitle={script.title}
          currentStatus={script.status}
          isUpdating={isUpdating}
          onChangeStatus={onUpdateStatus}
        />
      </div>
    </article>
  );
}
