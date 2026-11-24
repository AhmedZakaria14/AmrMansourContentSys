import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { XMLParser } from 'fast-xml-parser';

export type LiveContentCategory =
  | 'قضية رأي عام'
  | 'حكم محكمة'
  | 'قانون جديد'
  | 'قرار رسمي'
  | 'تريند';

export interface RawRssItem {
  id: string;
  story_id: string;
  title: string;
  link: string;
  description: string;
  source_name: string;
  source_id: string;
  pub_date: string;
  published_ms: number;
  from_trends: boolean;
  approx_traffic?: string;
}

export interface ScoredLiveNewsItem extends RawRssItem {
  legal_score: number;
  category: LiveContentCategory;
  is_legal: boolean;
  legal_angle: string;
  is_trending: boolean;
}

export interface FeedFetchStatus {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface LiveNewsPayload {
  items: ScoredLiveNewsItem[];
  trendingTerms: string[];
  feeds: FeedFetchStatus[];
  fetchedAt: string;
  cached: boolean;
  scoredBy: 'gemini' | 'keyword_fallback';
  scoringWarning?: string;
  totalFetched: number;
}

export interface FeedDefinition {
  id: string;
  name: string;
  url: string;
  isTrends?: boolean;
}

export const LIVE_RSS_FEEDS: FeedDefinition[] = [
  {
    id: 'youm7',
    name: 'اليوم السابع',
    url: 'https://www.youm7.com/rss/SectionRss?SectionID=65',
  },
  {
    id: 'almasryalyoum',
    name: 'المصري اليوم',
    url: 'https://www.almasryalyoum.com/rss/feed',
  },
  {
    id: 'egyptindependent',
    name: 'Egypt Independent',
    url: 'https://www.egyptindependent.com/feed/',
  },
  {
    id: 'google_trends_eg',
    name: 'Google Trends مصر',
    url: 'https://trends.google.com/trending/rss?geo=EG',
    isTrends: true,
  },
];

const VALID_CATEGORIES = new Set<LiveContentCategory>([
  'قضية رأي عام',
  'حكم محكمة',
  'قانون جديد',
  'قرار رسمي',
  'تريند',
]);

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RECENT_ITEMS = 60;
const FIRM_NAME = 'مؤسسة عمرو منصور للمحاماة والاستشارات القانونية';

let cachedPayload: { data: LiveNewsPayload; expiresAt: number } | null = null;
let inflightRefresh: Promise<LiveNewsPayload> | null = null;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
});

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseMimeType: string;
    responseSchema: Record<string, unknown>;
  }
) {
  try {
    return await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: params.responseMimeType,
        responseSchema: params.responseSchema,
      },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 503 || status === 429) {
      await new Promise((r) => setTimeout(r, 700));
      return await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseMimeType,
          responseSchema: params.responseSchema,
        },
      });
    }
    throw err;
  }
}

export function stripHtmlAndDecode(input: unknown): string {
  if (typeof input !== 'string') return '';
  let text = input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const namedEntities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&raquo;': '»',
    '&laquo;': '«',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
  };

  text = text.replace(
    /&(nbsp|amp|lt|gt|quot|apos|raquo|laquo|ndash|mdash|hellip|#39);/gi,
    (m) => namedEntities[m.toLowerCase()] ?? ' '
  );
  text = text.replace(/&#(\d+);/g, (_, code) => {
    const num = Number(code);
    return Number.isFinite(num) && num > 0 ? String.fromCodePoint(num) : ' ';
  });
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const num = Number.parseInt(hex, 16);
    return Number.isFinite(num) && num > 0 ? String.fromCodePoint(num) : ' ';
  });

  return text.replace(/\s+/g, ' ').trim();
}

export function sanitizeHttpUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

export function canonicalizeLink(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const paramsToDrop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'];
    for (const key of paramsToDrop) {
      parsed.searchParams.delete(key);
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.hostname.toLowerCase().replace(/^www\./, '')}${cleanPath}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createLinkHash(link: string, fallbackTitle: string): string {
  const basis = canonicalizeLink(link) || normalizeTitleForDedup(fallbackTitle) || link || fallbackTitle;
  const digest = crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
  return `live_${digest}`;
}

function parseTimestampMs(rawDate: unknown): { iso: string; ms: number } {
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const ms = Date.parse(rawDate.trim());
    if (!Number.isNaN(ms)) {
      return { iso: new Date(ms).toISOString(), ms };
    }
  }
  const now = Date.now();
  return { iso: new Date(now).toISOString(), ms: now };
}

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function extractXmlText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as { '#text'?: unknown })['#text'] ?? '');
  }
  return '';
}

function extractAtomLink(linkNode: unknown): string {
  for (const candidate of asArray(linkNode)) {
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') {
      const rec = candidate as Record<string, unknown>;
      const href = rec['@_href'];
      const rel = rec['@_rel'];
      if (typeof href === 'string' && (!rel || rel === 'alternate')) {
        return href;
      }
    }
  }
  return '';
}

export function parseRssOrAtomXml(
  xmlText: string,
  feed: FeedDefinition
): { items: RawRssItem[]; trendingTerms: string[] } {
  const parsed = xmlParser.parse(xmlText) as Record<string, unknown>;
  const items: RawRssItem[] = [];
  const trendingTerms: string[] = [];

  // RSS 2.0 format
  const rss = parsed?.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const rssItems = asArray(channel?.item as Record<string, unknown>[] | Record<string, unknown> | undefined);

  if (rssItems.length > 0) {
    for (const rawItem of rssItems) {
      if (!rawItem || typeof rawItem !== 'object') continue;

      if (feed.isTrends) {
        const trendTitle = stripHtmlAndDecode(extractXmlText(rawItem.title));
        const traffic = stripHtmlAndDecode(extractXmlText(rawItem['ht:approx_traffic']));
        const trendTime = parseTimestampMs(extractXmlText(rawItem.pubDate));
        if (trendTitle) {
          trendingTerms.push(trendTitle);
        }

        const nestedNews = asArray(
          rawItem['ht:news_item'] as Record<string, unknown>[] | Record<string, unknown> | undefined
        );
        if (nestedNews.length > 0) {
          // Take the primary linked news article for each trending query so trends remain focused
          const primaryNews = nestedNews[0];
          const newsTitle =
            stripHtmlAndDecode(extractXmlText(primaryNews['ht:news_item_title'])) || trendTitle;
          const newsUrl = sanitizeHttpUrl(extractXmlText(primaryNews['ht:news_item_url']));
          const newsSource =
            stripHtmlAndDecode(extractXmlText(primaryNews['ht:news_item_source'])) || feed.name;
          const newsSnippet = stripHtmlAndDecode(
            extractXmlText(primaryNews['ht:news_item_snippet'])
          );
          const link = newsUrl || sanitizeHttpUrl(extractXmlText(rawItem.link)) || feed.url;
          if (newsTitle) {
            const storyId = createLinkHash(link, newsTitle);
            items.push({
              id: storyId,
              story_id: storyId,
              title: newsTitle,
              link,
              description:
                newsSnippet ||
                (trendTitle && trendTitle !== newsTitle
                  ? `تريند بحث في مصر: ${trendTitle}${traffic ? ` (${traffic})` : ''}`
                  : `موضوع متصدر في محركات البحث بمصر${traffic ? ` (${traffic})` : ''}`),
              source_name: `${newsSource} (تريند مصر)`,
              source_id: feed.id,
              pub_date: trendTime.iso,
              published_ms: trendTime.ms,
              from_trends: true,
              approx_traffic: traffic || undefined,
            });
          }
        } else if (trendTitle) {
          const link = sanitizeHttpUrl(extractXmlText(rawItem.link)) || feed.url;
          const storyId = createLinkHash(link, trendTitle);
          items.push({
            id: storyId,
            story_id: storyId,
            title: trendTitle,
            link,
            description: `موضوع متصدر في بحث جوجل بمصر${traffic ? ` (${traffic})` : ''}`,
            source_name: feed.name,
            source_id: feed.id,
            pub_date: trendTime.iso,
            published_ms: trendTime.ms,
            from_trends: true,
            approx_traffic: traffic || undefined,
          });
        }
        continue;
      }

      const title = stripHtmlAndDecode(extractXmlText(rawItem.title));
      const link = sanitizeHttpUrl(
        extractXmlText(rawItem.link) || extractXmlText(rawItem.guid)
      );
      const rawDesc =
        extractXmlText(rawItem.description) || extractXmlText(rawItem['content:encoded']);
      const description = stripHtmlAndDecode(rawDesc).slice(0, 420);
      const pubTime = parseTimestampMs(
        extractXmlText(rawItem.pubDate) || extractXmlText(rawItem['dc:date'])
      );

      if (!title || !link) continue;
      const storyId = createLinkHash(link, title);
      items.push({
        id: storyId,
        story_id: storyId,
        title,
        link,
        description,
        source_name: feed.name,
        source_id: feed.id,
        pub_date: pubTime.iso,
        published_ms: pubTime.ms,
        from_trends: false,
      });
    }
    return { items, trendingTerms };
  }

  // Atom format fallback
  const atomFeed = parsed?.feed as Record<string, unknown> | undefined;
  const atomEntries = asArray(
    atomFeed?.entry as Record<string, unknown>[] | Record<string, unknown> | undefined
  );
  for (const entry of atomEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const title = stripHtmlAndDecode(extractXmlText(entry.title));
    const link = sanitizeHttpUrl(extractAtomLink(entry.link));
    const description = stripHtmlAndDecode(
      extractXmlText(entry.summary) || extractXmlText(entry.content)
    ).slice(0, 420);
    const pubTime = parseTimestampMs(
      extractXmlText(entry.published) || extractXmlText(entry.updated)
    );
    if (!title || !link) continue;
    const storyId = createLinkHash(link, title);
    items.push({
      id: storyId,
      story_id: storyId,
      title,
      link,
      description,
      source_name: feed.name,
      source_id: feed.id,
      pub_date: pubTime.iso,
      published_ms: pubTime.ms,
      from_trends: Boolean(feed.isTrends),
    });
  }

  return { items, trendingTerms };
}

function discoverRssUrlFromHtml(html: string, baseUrl: string): string | null {
  const alternateMatch = /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i.exec(
    html
  );
  const hrefMatch = alternateMatch?.[1] || /href=["']([^"']*\/rss\/rssfeed[^"']*)["']/i.exec(html)?.[1];
  if (!hrefMatch) return null;
  try {
    const resolved = new URL(hrefMatch, baseUrl);
    const originHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    const targetHost = resolved.hostname.replace(/^www\./, '');
    if (
      (resolved.protocol === 'http:' || resolved.protocol === 'https:') &&
      targetHost === originHost
    ) {
      return resolved.toString();
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchSingleFeed(
  feed: FeedDefinition
): Promise<{ status: FeedFetchStatus; items: RawRssItem[]; trendingTerms: string[] }> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
  };

  try {
    const res = await fetch(feed.url, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    let bodyText = await res.text();
    const looksLikeHtml =
      /<html[\s>]/i.test(bodyText.slice(0, 600)) &&
      !/<rss[\s>]|<feed[\s>]/i.test(bodyText.slice(0, 600));

    if (looksLikeHtml) {
      const discoveredUrl = discoverRssUrlFromHtml(bodyText, feed.url);
      if (discoveredUrl) {
        const rssRes = await fetch(discoveredUrl, {
          headers,
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (!rssRes.ok) {
          throw new Error(`HTTP ${rssRes.status}`);
        }
        bodyText = await rssRes.text();
      } else {
        throw new Error('Returned HTML instead of RSS/Atom XML');
      }
    }

    if (!/<rss[\s>]|<feed[\s>]|<channel[\s>]/i.test(bodyText)) {
      throw new Error('Unsupported or empty XML feed format');
    }

    const { items, trendingTerms } = parseRssOrAtomXml(bodyText, feed);
    return {
      status: {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        ok: items.length > 0,
        count: items.length,
        error: items.length === 0 ? 'لم يتم العثور على عناصر في الخلاصة' : undefined,
      },
      items,
      trendingTerms,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Feed fetch failed';
    return {
      status: {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        ok: false,
        count: 0,
        error: rawMsg,
      },
      items: [],
      trendingTerms: [],
    };
  }
}

export function deduplicateAndLimitItems(
  allItems: RawRssItem[],
  maxItems: number = MAX_RECENT_ITEMS
): RawRssItem[] {
  const sorted = [...allItems].sort((a, b) => b.published_ms - a.published_ms);
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: RawRssItem[] = [];

  for (const item of sorted) {
    const linkKey = canonicalizeLink(item.link);
    const titleKey = normalizeTitleForDedup(item.title);
    if (titleKey && seenTitles.has(titleKey)) continue;
    // Note: Google Trends items without ht:news_item may share the main trends link, so only dedup by link if not trends-root
    const isTrendsRoot = linkKey.startsWith('trends.google.com/trending/rss');
    if (linkKey && !isTrendsRoot && seenLinks.has(linkKey)) continue;

    if (titleKey) seenTitles.add(titleKey);
    if (linkKey && !isTrendsRoot) seenLinks.add(linkKey);

    deduped.push(item);
    if (deduped.length >= maxItems) break;
  }

  return deduped;
}

const LEGAL_KEYWORDS_AR: Array<{ term: string; weight: number; category?: LiveContentCategory }> = [
  { term: 'محكمة', weight: 28, category: 'حكم محكمة' },
  { term: 'الجنايات', weight: 28, category: 'حكم محكمة' },
  { term: 'الجنح', weight: 26, category: 'حكم محكمة' },
  { term: 'النقض', weight: 28, category: 'حكم محكمة' },
  { term: 'الإدارية العليا', weight: 28, category: 'حكم محكمة' },
  { term: 'النيابة', weight: 24, category: 'قضية رأي عام' },
  { term: 'النائب العام', weight: 26, category: 'قضية رأي عام' },
  { term: 'قضية', weight: 22, category: 'قضية رأي عام' },
  { term: 'حكم', weight: 20, category: 'حكم محكمة' },
  { term: 'براءة', weight: 22, category: 'حكم محكمة' },
  { term: 'المؤبد', weight: 25, category: 'حكم محكمة' },
  { term: 'حبس', weight: 22, category: 'حكم محكمة' },
  { term: 'سجن', weight: 20, category: 'حكم محكمة' },
  { term: 'قانون', weight: 26, category: 'قانون جديد' },
  { term: 'تشريع', weight: 26, category: 'قانون جديد' },
  { term: 'مجلس النواب', weight: 20, category: 'قانون جديد' },
  { term: 'تعديل قانون', weight: 28, category: 'قانون جديد' },
  { term: 'قرار وزاري', weight: 24, category: 'قرار رسمي' },
  { term: 'قرار رئيس', weight: 22, category: 'قرار رسمي' },
  { term: 'الجريدة الرسمية', weight: 28, category: 'قرار رسمي' },
  { term: 'وزارة العدل', weight: 24, category: 'قرار رسمي' },
  { term: 'جريمة', weight: 22, category: 'قضية رأي عام' },
  { term: 'متهم', weight: 20, category: 'قضية رأي عام' },
  { term: 'عقوبة', weight: 22, category: 'حكم محكمة' },
  { term: 'غرامة', weight: 18, category: 'قرار رسمي' },
  { term: 'تحقيق', weight: 18, category: 'قضية رأي عام' },
  { term: 'ضرائب', weight: 18, category: 'قرار رسمي' },
  { term: 'الضرائب', weight: 18, category: 'قرار رسمي' },
  { term: 'تعويض', weight: 20, category: 'حكم محكمة' },
  { term: 'دستور', weight: 22, category: 'قانون جديد' },
  { term: 'استئناف', weight: 24, category: 'حكم محكمة' },
  { term: 'محامي', weight: 20, category: 'قضية رأي عام' },
  { term: 'العمل الجديد', weight: 22, category: 'قانون جديد' },
  { term: 'إيجار', weight: 18, category: 'قانون جديد' },
];

const LEGAL_KEYWORDS_EN: Array<{ term: string; weight: number; category?: LiveContentCategory }> = [
  { term: 'court', weight: 26, category: 'حكم محكمة' },
  { term: 'verdict', weight: 28, category: 'حكم محكمة' },
  { term: 'ruling', weight: 26, category: 'حكم محكمة' },
  { term: 'prosecution', weight: 25, category: 'قضية رأي عام' },
  { term: 'prosecutor', weight: 25, category: 'قضية رأي عام' },
  { term: 'sentence', weight: 22, category: 'حكم محكمة' },
  { term: 'law', weight: 24, category: 'قانون جديد' },
  { term: 'legislation', weight: 26, category: 'قانون جديد' },
  { term: 'parliament', weight: 18, category: 'قانون جديد' },
  { term: 'decree', weight: 24, category: 'قرار رسمي' },
  { term: 'ministry of justice', weight: 26, category: 'قرار رسمي' },
  { term: 'crime', weight: 20, category: 'قضية رأي عام' },
  { term: 'trial', weight: 24, category: 'حكم محكمة' },
  { term: 'penalty', weight: 20, category: 'قانون جديد' },
  { term: 'arrest', weight: 18, category: 'قضية رأي عام' },
  { term: 'tax', weight: 16, category: 'قرار رسمي' },
  { term: 'legal', weight: 20, category: 'قانون جديد' },
  { term: 'lawsuit', weight: 24, category: 'قضية رأي عام' },
];

function matchesTrendingTerms(item: RawRssItem, trendingTerms: string[]): boolean {
  if (item.from_trends) return true;
  if (trendingTerms.length === 0) return false;
  const haystack = normalizeTitleForDedup(`${item.title} ${item.description}`);
  for (const term of trendingTerms) {
    const cleanTerm = normalizeTitleForDedup(term);
    if (cleanTerm.length >= 4 && haystack.includes(cleanTerm)) {
      return true;
    }
  }
  return false;
}

export function scoreLiveItemByKeywords(
  item: RawRssItem,
  trendingTerms: string[]
): ScoredLiveNewsItem {
  const combined = `${item.title} ${item.description}`;
  const normalizedAr = normalizeTitleForDedup(combined);
  const lowerEn = combined.toLowerCase();

  let score = 8;
  let matchedTerms: string[] = [];
  let inferredCategory: LiveContentCategory = item.from_trends ? 'تريند' : 'قرار رسمي';
  let topWeight = 0;

  for (const kw of LEGAL_KEYWORDS_AR) {
    if (normalizedAr.includes(normalizeTitleForDedup(kw.term))) {
      score += kw.weight;
      matchedTerms.push(kw.term);
      if (kw.weight > topWeight && kw.category) {
        topWeight = kw.weight;
        inferredCategory = kw.category;
      }
    }
  }

  for (const kw of LEGAL_KEYWORDS_EN) {
    if (new RegExp(`\\b${kw.term.replace(/\s+/g, '\\s+')}\\b`, 'i').test(lowerEn)) {
      score += kw.weight;
      matchedTerms.push(kw.term);
      if (kw.weight > topWeight && kw.category) {
        topWeight = kw.weight;
        inferredCategory = kw.category;
      }
    }
  }

  const isTrending = matchesTrendingTerms(item, trendingTerms);
  if (isTrending && topWeight === 0) {
    inferredCategory = 'تريند';
  }

  const clampedScore = Math.max(0, Math.min(98, score));
  const isLegal = clampedScore >= 35;

  let legalAngle = '';
  if (isLegal) {
    legalAngle = `يتضمن الخبر أبعاداً قانونية متعلقة بـ (${matchedTerms
      .slice(0, 3)
      .join('، ')}) وفق ما ورد في نص الخبر.`;
  }

  return {
    ...item,
    legal_score: clampedScore,
    category: inferredCategory,
    is_legal: isLegal,
    legal_angle: legalAngle,
    is_trending: isTrending,
  };
}

export function scoreBatchByKeywords(
  items: RawRssItem[],
  trendingTerms: string[]
): ScoredLiveNewsItem[] {
  return items
    .map((item) => scoreLiveItemByKeywords(item, trendingTerms))
    .sort((a, b) => b.legal_score - a.legal_score || b.published_ms - a.published_ms);
}

interface GeminiBatchScoreRow {
  id?: string;
  legal_score?: number;
  category?: string;
  is_legal?: boolean;
  legal_angle?: string;
  is_trending?: boolean;
}

async function scoreBatchWithGemini(
  items: RawRssItem[],
  trendingTerms: string[]
): Promise<{ scored: ScoredLiveNewsItem[]; usedGemini: boolean; warning?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      scored: scoreBatchByKeywords(items, trendingTerms),
      usedGemini: false,
      warning: 'مفتاح GEMINI_API_KEY غير متاح حالياً؛ تم التقييم باستخدام الكلمات المفتاحية القانونية.',
    };
  }

  if (items.length === 0) {
    return { scored: [], usedGemini: true };
  }

  const compactPayload = items.map((item) => ({
    id: item.id,
    source: item.source_name,
    title: item.title,
    description: item.description,
    from_trends: item.from_trends,
  }));

  const systemInstruction = `You are a senior Egyptian legal editorial analyst working for the Egyptian law firm «${FIRM_NAME}».
Evaluate a batch of Egyptian news headlines and Google Trends items for legal relevance.

STRICT GROUNDING RULES:
1. Base legal_score and legal_angle ONLY on each item's title and description as given.
2. NEVER invent laws, article numbers, court rulings, case numbers, penalties, or facts not explicitly present in the item's title/description.
3. General non-legal news (sports matches, entertainment gossip, weather, routine celebrity news unless involving a legal dispute/crime/law) MUST receive a low legal_score (0-25), is_legal=false, and an EMPTY legal_angle ("").
4. For legally relevant items (laws, decrees, court rulings, prosecutions, public-interest crimes/disputes, regulatory decisions, tax/labor/real-estate rules), write ONE concise, accurate Arabic sentence in legal_angle explaining why it matters legally based strictly on the provided text.
5. Set category to EXACTLY one of: "قضية رأي عام", "حكم محكمة", "قانون جديد", "قرار رسمي", "تريند".
6. Set is_trending=true when from_trends=true, when the item matches any Google Trends Egypt query provided, or when it is clearly a viral Egyptian public topic.`;

  const prompt = `Trending queries in Egypt right now (Google Trends EG):
${trendingTerms.length > 0 ? trendingTerms.join(' | ') : '(none)'}

Evaluate ALL ${compactPayload.length} items below and return a JSON array with one entry per item matching its exact "id":
${JSON.stringify(compactPayload)}`;

  try {
    const response = await generateWithModelFallback(ai, {
      contents: prompt,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            legal_score: { type: Type.INTEGER },
            category: { type: Type.STRING },
            is_legal: { type: Type.BOOLEAN },
            legal_angle: { type: Type.STRING },
            is_trending: { type: Type.BOOLEAN },
          },
          required: ['id', 'legal_score', 'category', 'is_legal', 'legal_angle', 'is_trending'],
        },
      },
    });

    const rawJson = (response.text ?? '[]').trim();
    const parsed = JSON.parse(rawJson) as GeminiBatchScoreRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Empty Gemini scoring response');
    }

    const byId = new Map<string, GeminiBatchScoreRow>();
    for (const row of parsed) {
      if (row && typeof row.id === 'string') {
        byId.set(row.id, row);
      }
    }

    const merged = items.map((item) => {
      const row = byId.get(item.id);
      if (!row) {
        return scoreLiveItemByKeywords(item, trendingTerms);
      }
      const rawScore =
        typeof row.legal_score === 'number' && Number.isFinite(row.legal_score)
          ? Math.round(row.legal_score)
          : 15;
      const legalScore = Math.max(0, Math.min(100, rawScore));
      const isLegal = Boolean(row.is_legal) && legalScore >= 30;
      const category = VALID_CATEGORIES.has(row.category as LiveContentCategory)
        ? (row.category as LiveContentCategory)
        : item.from_trends
        ? 'تريند'
        : 'قرار رسمي';
      const legalAngle = isLegal ? (row.legal_angle ?? '').trim() : '';
      const isTrending = Boolean(row.is_trending) || matchesTrendingTerms(item, trendingTerms);

      return {
        ...item,
        legal_score: legalScore,
        category,
        is_legal: isLegal,
        legal_angle: legalAngle,
        is_trending: isTrending,
      };
    });

    merged.sort((a, b) => b.legal_score - a.legal_score || b.published_ms - a.published_ms);
    return { scored: merged, usedGemini: true };
  } catch (err) {
    const anyErr = err as { status?: number; message?: string };
    const statusTag = anyErr?.status ? ` [${anyErr.status}]` : '';
    const errMsg = err instanceof Error ? err.message : 'Gemini scoring error';
    console.warn(
      `Gemini batch legal scoring unavailable${statusTag}; falling back to keyword scoring:`,
      errMsg
    );
    return {
      scored: scoreBatchByKeywords(items, trendingTerms),
      usedGemini: false,
      warning: 'تعذر التقييم الذكي مؤقتاً؛ تم ترتيب الأخبار تلقائياً بالكلمات المفتاحية القانونية.',
    };
  }
}

export async function fetchAndScoreLiveNews(options: {
  force?: boolean;
} = {}): Promise<LiveNewsPayload> {
  const now = Date.now();
  if (!options.force && cachedPayload && cachedPayload.expiresAt > now) {
    return {
      ...cachedPayload.data,
      cached: true,
    };
  }

  if (!options.force && inflightRefresh) {
    return inflightRefresh;
  }

  const run = async (): Promise<LiveNewsPayload> => {
    const results = await Promise.all(LIVE_RSS_FEEDS.map((feed) => fetchSingleFeed(feed)));
    const feeds = results.map((r) => r.status);
    const allRawItems = results.flatMap((r) => r.items);
    const trendingTerms = Array.from(
      new Set(results.flatMap((r) => r.trendingTerms).filter(Boolean))
    );

    const recentItems = deduplicateAndLimitItems(allRawItems, MAX_RECENT_ITEMS);
    const { scored, usedGemini, warning } = await scoreBatchWithGemini(
      recentItems,
      trendingTerms
    );

    const payload: LiveNewsPayload = {
      items: scored,
      trendingTerms,
      feeds,
      fetchedAt: new Date().toISOString(),
      cached: false,
      scoredBy: usedGemini ? 'gemini' : 'keyword_fallback',
      scoringWarning: warning,
      totalFetched: allRawItems.length,
    };

    cachedPayload = {
      data: payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return payload;
  };

  if (!options.force) {
    inflightRefresh = run().finally(() => {
      inflightRefresh = null;
    });
    return inflightRefresh;
  }

  return run();
}

export interface DraftGenerationInput {
  story: {
    story_id?: string;
    title: string;
    link?: string;
    summary?: string;
    legal_angle?: string;
    category?: string;
    source_name?: string;
  };
  draftType: 'post' | 'script';
}

export async function generateDraftWithGemini(input: DraftGenerationInput): Promise<{
  story_id: string;
  draft_type: 'post' | 'script';
  text: string;
  duration_sec?: number;
  created_at: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('MISSING_GEMINI_KEY');
  }

  const { story, draftType } = input;
  const storyId =
    story.story_id && story.story_id.trim()
      ? story.story_id.trim()
      : createLinkHash(story.link || '', story.title);

  const systemInstruction = `أنت مستشار ومحرر قانوني متخصص تعمل لدى «${FIRM_NAME}».
مهمتك صياغة محتوى إعلامي قانوني رصين وموثوق باللغة العربية انطلاقاً من الخبر المرفق فقط.

قواعد صارمة لا يجوز مخالفتها أبداً:
1. التزم التزاماً تاماً بالوقائع الواردة في العنوان والملخص والزاوية القانونية والمصدر فقط.
2. يُمنع منعاً باتاً اختراع أو تخمين أرقام مواد قانونية أو أرقام قضايا أو أحكام أو عقوبات أو تواريخ غير مذكورة صراحةً في المعطيات.
3. إذا كانت هناك تفاصيل غير مذكورة في الخبر، قدّم توعية قانونية عامة ومهنية دون نسب وقائع غير واردة للمصدر.
4. لا تستخدم لغة دعائية مبتذلة؛ حافظ على نبرة قانونية مهنية واضحة وموثوقة.`;

  const storyContext = `العنوان: ${story.title}
التصنيف: ${story.category || 'عام'}
المصدر: ${story.source_name || 'مصدر إخباري'}
الملخص: ${story.summary || 'غير متوفر'}
الزاوية القانونية: ${story.legal_angle || 'غير محددة'}`;

  if (draftType === 'post') {
    const response = await generateWithModelFallback(ai, {
      contents: `اكتب بوست فيسبوك احترافي وجاهز للنشر لصفحة «${FIRM_NAME}» بناءً على الخبر التالي فقط.
اشرح الفكرة الرئيسية والبعد القانوني للمتابعين بأسلوب واضح ومنظم، واختتم البوست بتوقيع:
«${FIRM_NAME}»

${storyContext}`,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          post_text: {
            type: Type.STRING,
            description: 'Full ready-to-publish Arabic Facebook post signed with the firm name.',
          },
        },
        required: ['post_text'],
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as { post_text?: string };
    const text = (parsed.post_text ?? '').trim();
    if (!text) {
      throw new Error('EMPTY_GENERATION');
    }

    return {
      story_id: storyId,
      draft_type: 'post',
      text,
      created_at: new Date().toISOString(),
    };
  }

  const response = await generateWithModelFallback(ai, {
    contents: `اكتب سكربت فيديو قصير (Reels / Shorts مدته 45-60 ثانية) باللهجة المصرية المهنية المبسطة لـ «${FIRM_NAME}» بناءً على الخبر التالي فقط.
قسّم السكربت بشكل واضح:
- [0-3 ثوانٍ]: جملة خطافية افتتاحية قوية
- [المعلومة القانونية]: شرح مبسط ومباشر للخبر وزاويته القانونية
- [الخلاصة والنصيحة]: نصيحة عملية وتوقيع باسم المؤسسة

${storyContext}`,
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        script_text: {
          type: Type.STRING,
          description: 'Full spoken Arabic short video script.',
        },
        duration_sec: {
          type: Type.INTEGER,
          description: 'Estimated speaking duration in seconds (typically 35 to 75).',
        },
      },
      required: ['script_text', 'duration_sec'],
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    script_text?: string;
    duration_sec?: number;
  };
  const text = (parsed.script_text ?? '').trim();
  if (!text) {
    throw new Error('EMPTY_GENERATION');
  }
  const durationSec =
    typeof parsed.duration_sec === 'number' && parsed.duration_sec > 0
      ? Math.round(parsed.duration_sec)
      : 50;

  return {
    story_id: storyId,
    draft_type: 'script',
    text,
    duration_sec: durationSec,
    created_at: new Date().toISOString(),
  };
}
