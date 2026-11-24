import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scale } from 'lucide-react';
import type { ContentStatus } from './types/content';
import { FIRM_NAME } from './types/content';
import { useAuth } from './hooks/useAuth';
import { useAggregatorContent } from './hooks/useAggregatorContent';
import { useLiveNews } from './hooks/useLiveNews';
import { copyToClipboard } from './utils/clipboard';
import { resolveDetailBundle } from './utils/contentUtils';
import { Header, type ActivePage } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { TodayPage } from './components/TodayPage';
import { LiveNewsPage } from './components/LiveNewsPage';
import { ArchivePage } from './components/ArchivePage';
import { DetailModal } from './components/DetailModal';
import { Toast, type ToastMessage } from './components/Toast';

export default function App() {
  const {
    user,
    authLoading,
    authError,
    submitting,
    isFirebaseConfigured,
    signIn,
    signInDemoPreview,
    signOut,
    clearAuthError,
  } = useAuth();

  const [activePage, setActivePage] = useState<ActivePage>('today');
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string>('');
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const {
    todayDate,
    todayItems,
    archiveItems,
    allItemsForLookup,
    availableDates,
    totalAllDaysCount,
    loading,
    archiveLoading,
    error,
    isSampleData,
    sampleReason,
    updatingIds,
    updateItemStatus,
    retry,
  } = useAggregatorContent(Boolean(user), selectedArchiveDate, activePage);

  const liveNews = useLiveNews(Boolean(user), activePage === 'news');

  const showToast = useCallback((text: string, variant: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), text, variant });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        showToast('تم النسخ', 'success');
      } else {
        showToast('تعذر النسخ إلى الحافظة، يرجى النسخ يدوياً.', 'error');
      }
    },
    [showToast]
  );

  const handleUpdateStatus = useCallback(
    async (itemId: string, nextStatus: ContentStatus) => {
      const result = await updateItemStatus(itemId, nextStatus);
      if (!result.ok && result.error) {
        showToast(result.error, 'error');
      }
    },
    [updateItemStatus, showToast]
  );

  const handleSignOut = useCallback(async () => {
    setSelectedDetailId(null);
    setSelectedArchiveDate('');
    setActivePage('today');
    await signOut();
  }, [signOut]);

  const activeDetailBundle = useMemo(() => {
    if (!selectedDetailId) return null;
    const selectedItem = allItemsForLookup.find((i) => i.id === selectedDetailId);
    if (!selectedItem) return null;
    return resolveDetailBundle(selectedItem, allItemsForLookup);
  }, [allItemsForLookup, selectedDetailId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B192C] text-white flex flex-col items-center justify-center gap-4 p-6">
        <span className="w-12 h-12 rounded-xl bg-[#132944] border border-[#C9A45C]/40 flex items-center justify-center">
          <Scale className="w-6 h-6 text-[#C9A45C]" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-slate-200">جاري التحقق من الجلسة...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        isFirebaseConfigured={isFirebaseConfigured}
        authError={authError}
        submitting={submitting}
        onSignIn={signIn}
        onDemoPreview={signInDemoPreview}
        onClearError={clearAuthError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#0F172A] flex flex-col">
      <Header
        activePage={activePage}
        onNavigate={setActivePage}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activePage === 'today' ? (
          <TodayPage
            todayDate={todayDate}
            items={todayItems}
            loading={loading}
            error={error}
            isSampleData={isSampleData}
            sampleReason={sampleReason}
            updatingIds={updatingIds}
            onUpdateStatus={handleUpdateStatus}
            onCopy={handleCopy}
            onOpenDetail={(item) => setSelectedDetailId(item.id)}
            onRetry={retry}
            onGoToArchive={() => setActivePage('archive')}
          />
        ) : activePage === 'news' ? (
          <LiveNewsPage
            data={liveNews.data}
            loading={liveNews.loading}
            refreshing={liveNews.refreshing}
            error={liveNews.error}
            firestoreItems={allItemsForLookup}
            drafts={liveNews.drafts}
            generatingKeys={liveNews.generatingKeys}
            onForceRefresh={liveNews.forceRefresh}
            onGenerateDraft={liveNews.generateDraft}
            onCopy={handleCopy}
            onOpenFirestoreDetail={(item) => setSelectedDetailId(item.id)}
            onShowToast={showToast}
          />
        ) : (
          <ArchivePage
            items={archiveItems}
            availableDates={availableDates}
            totalAllDaysCount={totalAllDaysCount}
            selectedDate={selectedArchiveDate}
            onSelectDate={setSelectedArchiveDate}
            loading={loading || archiveLoading}
            isSampleData={isSampleData}
            updatingIds={updatingIds}
            onUpdateStatus={handleUpdateStatus}
            onCopy={handleCopy}
            onOpenDetail={(item) => setSelectedDetailId(item.id)}
          />
        )}
      </main>

      <footer className="border-t border-[#E2E8F0] bg-white py-5 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B]">
          <p>{FIRM_NAME}</p>
          <p>لوحة متابعة وإدارة المحتوى القانوني اليومي</p>
        </div>
      </footer>

      <DetailModal
        bundle={activeDetailBundle}
        updatingIds={updatingIds}
        onClose={() => setSelectedDetailId(null)}
        onCopy={handleCopy}
        onUpdateStatus={handleUpdateStatus}
      />

      <Toast toast={toast} />
    </div>
  );
}
