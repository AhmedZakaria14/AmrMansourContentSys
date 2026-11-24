import { useEffect } from 'react';
import { Calendar, Clock, Copy, ExternalLink, FileText, Video, X } from 'lucide-react';
import type { ContentStatus, TopicBundle } from '../types/content';
import { countCharacters } from '../utils/contentUtils';
import { formatArabicContentDate, formatDurationArabic } from '../utils/dateUtils';
import { CategoryBadge } from './Badges';
import { StatusWorkflow } from './StatusWorkflow';

interface DetailModalProps {
  bundle: TopicBundle | null;
  updatingIds: Record<string, boolean>;
  onClose: () => void;
  onCopy: (text: string) => void;
  onUpdateStatus: (id: string, status: ContentStatus) => void;
}

export function DetailModal({
  bundle,
  updatingIds,
  onClose,
  onCopy,
  onUpdateStatus,
}: DetailModalProps) {
  useEffect(() => {
    if (!bundle) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bundle, onClose]);

  if (!bundle) return null;

  const { topic, linkedPost, linkedScript } = bundle;
  const postText = linkedPost?.post_text ?? '';
  const scriptText = linkedScript?.script_text ?? '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#07111F]/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0B192C] text-white px-5 py-4 sm:px-7 sm:py-5 flex items-start justify-between gap-4 border-b border-[#C9A45C]/30">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300">
              <CategoryBadge category={topic.category} />
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" aria-hidden="true" />
                <span>{formatArabicContentDate(topic.content_date)}</span>
              </span>
              {topic.source_url ? (
                <a
                  href={topic.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#E7C986] hover:underline"
                >
                  <span>المصدر: {topic.source_name}</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              ) : (
                <span>المصدر: {topic.source_name}</span>
              )}
            </div>

            <h2
              id="detail-modal-title"
              className="text-lg sm:text-xl font-bold leading-snug text-white"
            >
              {topic.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التفاصيل"
            className="p-2 min-w-[40px] min-h-[40px] rounded-lg bg-[#132944] hover:bg-[#1E3A5F] text-slate-200 hover:text-white transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#C9A45C]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 bg-[#F6F7F9]">
          {/* Topic Summary & Legal Angle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5">
              <h3 className="text-xs font-bold text-[#64748B] mb-2">ملخص الخبر</h3>
              <p className="text-sm text-[#1E293B] leading-relaxed">
                {topic.summary || 'لا يوجد ملخص مرفق.'}
              </p>
            </div>
            <div className="bg-[#FBF8F1] border border-[#E5D3AE] rounded-xl p-4 sm:p-5">
              <h3 className="text-xs font-bold text-[#7A581B] mb-2">الزاوية القانونية</h3>
              <p className="text-sm text-[#1E293B] leading-relaxed">
                {topic.legal_angle || 'لا توجد زاوية قانونية مرفقة.'}
              </p>
            </div>
          </div>

          {/* Side-by-Side Post & Script Boxes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Post Box */}
            <section
              aria-labelledby="detail-post-heading"
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#0B192C]" aria-hidden="true" />
                    <div>
                      <h3
                        id="detail-post-heading"
                        className="text-base font-bold text-[#0B192C]"
                      >
                        بوست فيسبوك الجاهز
                      </h3>
                      <p className="text-xs text-[#64748B] tabular-nums">
                        عدد الأحرف: {countCharacters(postText)} حرف
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!postText}
                    onClick={() => onCopy(postText)}
                    aria-label="نسخ بوست فيسبوك"
                    className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
                    <span>نسخ</span>
                  </button>
                </div>

                {linkedPost && postText ? (
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] leading-relaxed whitespace-pre-line max-h-[290px] overflow-y-auto">
                    {postText}
                  </div>
                ) : (
                  <div className="p-8 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-sm text-[#64748B]">
                    لا يوجد بوست فيسبوك مرتبط بهذا الموضوع حتى الآن.
                  </div>
                )}
              </div>

              {linkedPost && (
                <StatusWorkflow
                  itemId={linkedPost.id}
                  itemTitle={linkedPost.title}
                  currentStatus={linkedPost.status}
                  isUpdating={Boolean(updatingIds[linkedPost.id])}
                  onChangeStatus={onUpdateStatus}
                />
              )}
            </section>

            {/* Script Box */}
            <section
              aria-labelledby="detail-script-heading"
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-[#0B192C]" aria-hidden="true" />
                    <div>
                      <h3
                        id="detail-script-heading"
                        className="text-base font-bold text-[#0B192C]"
                      >
                        سكربت الفيديو القصير
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[#64748B] tabular-nums">
                        <span>عدد الأحرف: {countCharacters(scriptText)} حرف</span>
                        {linkedScript?.duration_sec && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#0B192C] font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#B8924A]" aria-hidden="true" />
                              {formatDurationArabic(linkedScript.duration_sec)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!scriptText}
                    onClick={() => onCopy(scriptText)}
                    aria-label="نسخ سكربت الفيديو"
                    className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
                    <span>نسخ</span>
                  </button>
                </div>

                {linkedScript && scriptText ? (
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] leading-relaxed whitespace-pre-line max-h-[290px] overflow-y-auto">
                    {scriptText}
                  </div>
                ) : (
                  <div className="p-8 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-sm text-[#64748B]">
                    لا يوجد سكربت فيديو مرتبط بهذا الموضوع حتى الآن.
                  </div>
                )}
              </div>

              {linkedScript && (
                <StatusWorkflow
                  itemId={linkedScript.id}
                  itemTitle={linkedScript.title}
                  currentStatus={linkedScript.status}
                  isUpdating={Boolean(updatingIds[linkedScript.id])}
                  onChangeStatus={onUpdateStatus}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
