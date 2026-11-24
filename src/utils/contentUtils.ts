import type {
  AggregatorContentItem,
  ArchiveFilters,
  ContentCategory,
  ContentStatus,
  ContentType,
  DateCountOption,
  DayContentSummary,
  TopicBundle,
} from '../types/content';
import { CONTENT_CATEGORIES } from '../types/content';

const VALID_TYPES = new Set<ContentType>(['topic', 'post', 'script']);
const VALID_STATUSES = new Set<ContentStatus>(['draft', 'approved', 'published']);
const VALID_CATEGORIES = new Set<ContentCategory>(CONTENT_CATEGORIES);

export function isValidContentStatus(value: unknown): value is ContentStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value as ContentStatus);
}

/**
 * Safe numeric sort key for created_at.
 * Pending Firestore server timestamps (null) sort as newest so newly-written docs appear at top.
 */
export function getCreatedAtSortKey(date: Date | null | undefined): number {
  if (date === null || date === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function sortItemsByCreatedAtDesc(
  items: AggregatorContentItem[]
): AggregatorContentItem[] {
  return [...items].sort(
    (a, b) => getCreatedAtSortKey(b.created_at) - getCreatedAtSortKey(a.created_at)
  );
}

function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  return fallback;
}

/**
 * Normalizes raw Firestore document data into a strongly typed AggregatorContentItem.
 * Handles missing, null, or malformed fields defensively so UI never crashes.
 */
export function normalizeFirestoreDocument(
  id: string,
  data: Record<string, unknown> | null | undefined,
  fallbackDate: string
): AggregatorContentItem {
  const safeData = data && typeof data === 'object' ? data : {};

  const rawType = typeof safeData.type === 'string' ? safeData.type.trim() : 'topic';
  const type: ContentType = VALID_TYPES.has(rawType as ContentType)
    ? (rawType as ContentType)
    : 'topic';

  const rawStatus = typeof safeData.status === 'string' ? safeData.status.trim() : 'draft';
  const status: ContentStatus = VALID_STATUSES.has(rawStatus as ContentStatus)
    ? (rawStatus as ContentStatus)
    : 'draft';

  const rawCategory =
    typeof safeData.category === 'string' ? safeData.category.trim() : 'قضية رأي عام';
  const category: ContentCategory = VALID_CATEGORIES.has(rawCategory as ContentCategory)
    ? (rawCategory as ContentCategory)
    : 'قضية رأي عام';

  const rawCreatedAt = safeData.created_at as
    | { toDate?: () => Date; seconds?: number }
    | Date
    | number
    | string
    | null
    | undefined;

  let createdAt: Date | null = null;
  if (rawCreatedAt === null || rawCreatedAt === undefined) {
    // Pending Firestore serverTimestamp() or omitted field — keep null gracefully
    createdAt = null;
  } else if (rawCreatedAt instanceof Date) {
    createdAt = Number.isNaN(rawCreatedAt.getTime()) ? null : rawCreatedAt;
  } else if (
    typeof rawCreatedAt === 'object' &&
    'toDate' in rawCreatedAt &&
    typeof rawCreatedAt.toDate === 'function'
  ) {
    try {
      const converted = rawCreatedAt.toDate();
      createdAt =
        converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    } catch {
      createdAt = null;
    }
  } else if (
    typeof rawCreatedAt === 'object' &&
    'seconds' in rawCreatedAt &&
    typeof rawCreatedAt.seconds === 'number' &&
    Number.isFinite(rawCreatedAt.seconds)
  ) {
    createdAt = new Date(rawCreatedAt.seconds * 1000);
  } else if (typeof rawCreatedAt === 'number' || typeof rawCreatedAt === 'string') {
    const parsed = new Date(rawCreatedAt);
    createdAt = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const rawContentDate =
    typeof safeData.content_date === 'string' ? safeData.content_date.trim() : '';
  const contentDate = /^\d{4}-\d{2}-\d{2}$/.test(rawContentDate)
    ? rawContentDate
    : fallbackDate;

  const durationRaw = safeData.duration_sec;
  let durationSec: number | undefined;
  if (type === 'script') {
    if (typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0) {
      durationSec = durationRaw;
    } else if (
      typeof durationRaw === 'string' &&
      durationRaw.trim() !== '' &&
      Number.isFinite(Number(durationRaw)) &&
      Number(durationRaw) > 0
    ) {
      durationSec = Number(durationRaw);
    }
  }

  const titleText = safeString(safeData.title).trim();
  const sourceNameText = safeString(safeData.source_name).trim();
  const topicIdText = safeString(safeData.topic_id).trim();
  const postText = type === 'post' ? safeString(safeData.post_text) : undefined;
  const scriptText = type === 'script' ? safeString(safeData.script_text) : undefined;

  return {
    id: String(id || ''),
    title: titleText || 'بدون عنوان',
    summary: safeString(safeData.summary),
    legal_angle: safeString(safeData.legal_angle),
    category,
    type,
    topic_id: topicIdText || undefined,
    post_text: postText || undefined,
    script_text: scriptText || undefined,
    duration_sec: durationSec,
    source_name: sourceNameText || 'مصدر إخباري',
    source_url: sanitizeExternalUrl(safeString(safeData.source_url)),
    status,
    content_date: contentDate,
    created_at: createdAt,
  };
}

/**
 * Ensures source URLs only allow safe http/https schemes.
 */
export function sanitizeExternalUrl(url: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Builds a lookup map of posts and scripts linked to topic IDs across all items.
 */
export function buildLinkedContentMaps(allItems: AggregatorContentItem[]): {
  postByTopicId: Map<string, AggregatorContentItem>;
  scriptByTopicId: Map<string, AggregatorContentItem>;
  topicById: Map<string, AggregatorContentItem>;
} {
  const postByTopicId = new Map<string, AggregatorContentItem>();
  const scriptByTopicId = new Map<string, AggregatorContentItem>();
  const topicById = new Map<string, AggregatorContentItem>();

  for (const item of allItems) {
    if (item.type === 'topic') {
      topicById.set(item.id, item);
    } else if (item.type === 'post' && item.topic_id) {
      if (!postByTopicId.has(item.topic_id)) {
        postByTopicId.set(item.topic_id, item);
      }
    } else if (item.type === 'script' && item.topic_id) {
      if (!scriptByTopicId.has(item.topic_id)) {
        scriptByTopicId.set(item.topic_id, item);
      }
    }
  }

  return { postByTopicId, scriptByTopicId, topicById };
}

/**
 * Groups items for a specific date (typically Today in Egypt time) into topics, posts, scripts, and summary stats.
 */
export function groupDayContent(
  allItems: AggregatorContentItem[],
  targetDate: string
): DayContentSummary {
  const dayItems = sortItemsByCreatedAtDesc(
    allItems.filter((item) => item.content_date === targetDate)
  );

  const { postByTopicId, scriptByTopicId } = buildLinkedContentMaps(allItems);

  const topics: TopicBundle[] = [];
  const posts: AggregatorContentItem[] = [];
  const scripts: AggregatorContentItem[] = [];

  for (const item of dayItems) {
    if (item.type === 'topic') {
      topics.push({
        topic: item,
        linkedPost: postByTopicId.get(item.id),
        linkedScript: scriptByTopicId.get(item.id),
      });
    } else if (item.type === 'post') {
      posts.push(item);
    } else if (item.type === 'script') {
      scripts.push(item);
    }
  }

  const publishedCount = dayItems.filter(
    (item) => (item.type === 'post' || item.type === 'script') && item.status === 'published'
  ).length;

  return {
    topics,
    posts,
    scripts,
    stats: {
      topicsCount: topics.length,
      postsCount: posts.length,
      scriptsCount: scripts.length,
      publishedCount,
    },
  };
}

/**
 * Resolves a TopicBundle for the Detail Modal from ANY clicked item (topic, post, or script).
 */
export function resolveDetailBundle(
  selectedItem: AggregatorContentItem,
  allItems: AggregatorContentItem[]
): TopicBundle {
  const { postByTopicId, scriptByTopicId, topicById } = buildLinkedContentMaps(allItems);

  if (selectedItem.type === 'topic') {
    return {
      topic: selectedItem,
      linkedPost: postByTopicId.get(selectedItem.id),
      linkedScript: scriptByTopicId.get(selectedItem.id),
    };
  }

  const parentTopic = selectedItem.topic_id ? topicById.get(selectedItem.topic_id) : undefined;

  if (parentTopic) {
    return {
      topic: parentTopic,
      linkedPost:
        selectedItem.type === 'post' ? selectedItem : postByTopicId.get(parentTopic.id),
      linkedScript:
        selectedItem.type === 'script' ? selectedItem : scriptByTopicId.get(parentTopic.id),
    };
  }

  // Standalone post or script without a topic document
  return {
    topic: selectedItem,
    linkedPost: selectedItem.type === 'post' ? selectedItem : undefined,
    linkedScript: selectedItem.type === 'script' ? selectedItem : undefined,
  };
}

/**
 * Normalizes Arabic text slightly for more forgiving Arabic search (alef/taa marbuta/diacritics).
 */
export function normalizeArabicSearch(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Filters archive items by date, category, type, and search query over title & summary.
 */
export function filterArchiveContent(
  allItems: AggregatorContentItem[],
  filters: ArchiveFilters
): AggregatorContentItem[] {
  const normalizedQuery = normalizeArabicSearch(filters.searchQuery);

  return allItems
    .filter((item) => {
      if (filters.selectedDate && item.content_date !== filters.selectedDate) {
        return false;
      }
      if (filters.category !== 'all' && item.category !== filters.category) {
        return false;
      }
      if (filters.type !== 'all' && item.type !== filters.type) {
        return false;
      }
      if (normalizedQuery) {
        const titleMatch = normalizeArabicSearch(item.title).includes(normalizedQuery);
        const summaryMatch = normalizeArabicSearch(item.summary).includes(normalizedQuery);
        if (!titleMatch && !summaryMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.content_date !== b.content_date) {
        return b.content_date.localeCompare(a.content_date);
      }
      return getCreatedAtSortKey(b.created_at) - getCreatedAtSortKey(a.created_at);
    });
}

/**
 * Extracts unique available dates sorted descending (newest first) with item counts.
 */
export function getAvailableDates(allItems: AggregatorContentItem[]): DateCountOption[] {
  const counts = new Map<string, number>();
  for (const item of allItems) {
    if (item.content_date) {
      counts.set(item.content_date, (counts.get(item.content_date) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Counts characters in a post or script accurately.
 */
export function countCharacters(text?: string | null): number {
  if (!text) return 0;
  return text.trim().length;
}

export const ADMIN_USERNAME = 'admin';
export const ADMIN_AUTH_DOMAIN = 'amromansour-law.eg';
export const ADMIN_AUTH_EMAIL = `${ADMIN_USERNAME}@${ADMIN_AUTH_DOMAIN}`;

/**
 * Maps a short username (e.g. "admin") to its Firebase Email/Password identity
 * ("admin@amromansour-law.eg"), or passes through an explicit email address.
 */
export function resolveUsernameToEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@${ADMIN_AUTH_DOMAIN}`;
}

/**
 * Validates login form inputs (username or email + password) and returns Arabic error messages.
 */
export function validateLoginForm(
  username: string,
  password: string
): { valid: boolean; usernameError?: string; passwordError?: string } {
  const trimmedUsername = username.trim();
  let usernameError: string | undefined;
  let passwordError: string | undefined;

  if (!trimmedUsername) {
    usernameError = 'يرجى إدخال اسم المستخدم';
  } else if (trimmedUsername.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUsername)) {
      usernameError = 'صيغة اسم المستخدم أو البريد الإلكتروني غير صحيحة';
    }
  } else if (!/^[a-zA-Z0-9._-]{2,64}$/.test(trimmedUsername)) {
    usernameError = 'اسم المستخدم يجب أن يحتوي على أحرف أو أرقام إنجليزية فقط';
  }

  if (!password) {
    passwordError = 'يرجى إدخال كلمة المرور';
  } else if (password.length < 6) {
    passwordError = 'كلمة المرور يجب أن لا تقل عن 6 أحرف';
  }

  return {
    valid: !usernameError && !passwordError,
    usernameError,
    passwordError,
  };
}
