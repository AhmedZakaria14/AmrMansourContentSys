import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../firebase-config';
import type {
  AppDraft,
  DraftType,
  LiveNewsItem,
  LiveNewsResponse,
} from '../types/content';
import {
  loadAppDraftsFromStorage,
  persistAppDraftToStorage,
} from '../utils/liveNewsUtils';

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function getBearerToken(): Promise<string | null> {
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export function useLiveNews(isSignedIn: boolean, isTabOpen: boolean) {
  const [data, setData] = useState<LiveNewsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, AppDraft>>(() =>
    loadAppDraftsFromStorage()
  );
  const [generatingKeys, setGeneratingKeys] = useState<Record<string, boolean>>({});
  const hasLoadedOnceRef = useRef<boolean>(false);

  const fetchLiveNews = useCallback(
    async (options: { force?: boolean; background?: boolean } = {}) => {
      if (!isSignedIn) return;
      const force = Boolean(options.force);

      if (force) {
        setRefreshing(true);
      } else if (!hasLoadedOnceRef.current && !options.background) {
        setLoading(true);
      }
      setError(null);

      try {
        const token = await getBearerToken();
        if (!token) {
          throw new Error('يرجى تسجيل الدخول بحساب الإدارة أولاً.');
        }

        const url = force ? '/api/live-news?force=1' : '/api/live-news';
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = (await res.json()) as LiveNewsResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || 'تعذر تحميل النشرة الإخبارية المباشرة.');
        }

        hasLoadedOnceRef.current = true;
        setData(json);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'تعذر تحميل النشرة الإخبارية المباشرة.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isSignedIn]
  );

  // Initial load when the «نشرة الأخبار» tab is opened + 15-minute auto-refresh while open
  useEffect(() => {
    if (!isSignedIn || !isTabOpen) return;

    void fetchLiveNews({ force: false });

    const intervalId = window.setInterval(() => {
      void fetchLiveNews({ force: true, background: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSignedIn, isTabOpen, fetchLiveNews]);

  const forceRefresh = useCallback(() => {
    return fetchLiveNews({ force: true });
  }, [fetchLiveNews]);

  const generateDraft = useCallback(
    async (
      item: LiveNewsItem,
      draftType: DraftType
    ): Promise<{ ok: boolean; draft?: AppDraft; error?: string }> => {
      const key = `${item.story_id}::${draftType}`;
      setGeneratingKeys((prev) => ({ ...prev, [key]: true }));

      try {
        const token = await getBearerToken();
        if (!token) {
          return { ok: false, error: 'انتهت جلسة تسجيل الدخول. يرجى إعادة تسجيل الدخول.' };
        }

        const res = await fetch('/api/generate-draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            draftType,
            story: {
              story_id: item.story_id,
              title: item.title,
              link: item.link,
              summary: item.description,
              legal_angle: item.legal_angle,
              category: item.category,
              source_name: item.source_name,
            },
          }),
        });

        const json = (await res.json()) as {
          story_id?: string;
          draft_type?: DraftType;
          text?: string;
          duration_sec?: number;
          created_at?: string;
          error?: string;
        };

        if (!res.ok || !json.text) {
          return {
            ok: false,
            error: json.error || 'تعذر توليد المسودة حالياً. يرجى المحاولة مرة أخرى.',
          };
        }

        const savedDraft: AppDraft = {
          id: `${json.story_id || item.story_id}_${draftType}`,
          story_id: json.story_id || item.story_id,
          draft_type: draftType,
          text: json.text,
          duration_sec: json.duration_sec,
          created_at: json.created_at || new Date().toISOString(),
        };

        setDrafts((prev) => persistAppDraftToStorage(prev, savedDraft));
        return { ok: true, draft: savedDraft };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتوليد المحتوى.' };
      } finally {
        setGeneratingKeys((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  return {
    data,
    loading,
    refreshing,
    error,
    drafts,
    generatingKeys,
    forceRefresh,
    generateDraft,
  };
}
