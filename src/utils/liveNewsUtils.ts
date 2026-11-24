import type {
  AggregatorContentItem,
  AppDraft,
  ContentCategory,
  DraftType,
  LiveNewsItem,
} from '../types/content';
import { normalizeArabicSearch } from './contentUtils';
import { EGYPT_TIMEZONE } from './dateUtils';

export const APP_DRAFTS_STORAGE_KEY = 'app_drafts';

export function normalizeUrlForMatch(rawUrl: string | undefined | null): string {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const paramsToDrop = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
    ];
    for (const p of paramsToDrop) {
      parsed.searchParams.delete(p);
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname.toLowerCase().replace(/^www\./, '')}${cleanPath}${parsed.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function normalizeTitleForMatch(title: string | undefined | null): string {
  return normalizeArabicSearch(title)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a live news item already exists in the firm's Firestore content
 * by normalized source_url or normalized title.
 */
export function findAggregatorMatch(
  liveItem: Pick<LiveNewsItem, 'link' | 'title'>,
  firestoreItems: AggregatorContentItem[]
): AggregatorContentItem | null {
  if (!firestoreItems || firestoreItems.length === 0) return null;

  const liveUrlKey = normalizeUrlForMatch(liveItem.link);
  const liveTitleKey = normalizeTitleForMatch(liveItem.title);
  const isTrendsRoot = liveUrlKey.startsWith('trends.google.com/trending/rss');

  // Prefer matching topic records first if available
  const ordered = [...firestoreItems].sort((a, b) => {
    if (a.type === 'topic' && b.type !== 'topic') return -1;
    if (b.type === 'topic' && a.type !== 'topic') return 1;
    return 0;
  });

  for (const item of ordered) {
    if (liveUrlKey && !isTrendsRoot && item.source_url) {
      const fsUrlKey = normalizeUrlForMatch(item.source_url);
      if (fsUrlKey && fsUrlKey === liveUrlKey) {
        return item;
      }
    }
    if (liveTitleKey && liveTitleKey.length >= 10) {
      const fsTitleKey = normalizeTitleForMatch(item.title);
      if (fsTitleKey && fsTitleKey === liveTitleKey) {
        return item;
      }
    }
  }

  return null;
}

export interface LiveNewsFilterOptions {
  legalOnly: boolean;
  category: ContentCategory | 'all';
}

/**
 * Filters live news items while preserving legal_score descending order.
 */
export function filterLiveNewsItems(
  items: LiveNewsItem[],
  options: LiveNewsFilterOptions
): LiveNewsItem[] {
  return items
    .filter((item) => {
      if (options.legalOnly && !item.is_legal && item.legal_score < 35) {
        return false;
      }
      if (options.category !== 'all' && item.category !== options.category) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.legal_score - a.legal_score || b.published_ms - a.published_ms);
}

/**
 * Extracts trending items for the separate «التريندات» section.
 */
export function extractTrendingItems(items: LiveNewsItem[]): LiveNewsItem[] {
  return items
    .filter((item) => item.is_trending || item.from_trends || item.category === 'تريند')
    .sort((a, b) => b.legal_score - a.legal_score || b.published_ms - a.published_ms);
}

/**
 * Formats an ISO date string as HH:MM in Africa/Cairo timezone.
 */
export function formatCairoTimeHHMM(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EGYPT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getDraftMapKey(storyId: string, draftType: DraftType): string {
  return `${storyId}::${draftType}`;
}

export function loadAppDraftsFromStorage(): Record<string, AppDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(APP_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, AppDraft> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        v &&
        typeof v === 'object' &&
        'story_id' in v &&
        'draft_type' in v &&
        'text' in v &&
        typeof (v as AppDraft).story_id === 'string' &&
        typeof (v as AppDraft).text === 'string'
      ) {
        result[k] = v as AppDraft;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function persistAppDraftToStorage(
  currentMap: Record<string, AppDraft>,
  draft: AppDraft
): Record<string, AppDraft> {
  const key = getDraftMapKey(draft.story_id, draft.draft_type);
  const next = {
    ...currentMap,
    [key]: draft,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(APP_DRAFTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}
