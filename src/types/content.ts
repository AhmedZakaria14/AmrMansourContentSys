export type ContentCategory =
  | 'قضية رأي عام'
  | 'حكم محكمة'
  | 'قانون جديد'
  | 'قرار رسمي'
  | 'تريند';

export type ContentType = 'topic' | 'post' | 'script';

export type ContentStatus = 'draft' | 'approved' | 'published';

export interface AggregatorContentItem {
  id: string;
  title: string;
  summary: string;
  legal_angle: string;
  category: ContentCategory;
  type: ContentType;
  topic_id?: string;
  post_text?: string;
  script_text?: string;
  duration_sec?: number;
  source_name: string;
  source_url: string;
  status: ContentStatus;
  content_date: string; // YYYY-MM-DD
  created_at: Date | null;
}

export interface TopicBundle {
  topic: AggregatorContentItem;
  linkedPost?: AggregatorContentItem;
  linkedScript?: AggregatorContentItem;
}

export interface DayContentSummary {
  topics: TopicBundle[];
  posts: AggregatorContentItem[];
  scripts: AggregatorContentItem[];
  stats: {
    topicsCount: number;
    postsCount: number;
    scriptsCount: number;
    publishedCount: number;
  };
}

export interface ArchiveFilters {
  selectedDate: string; // '' means all dates, otherwise YYYY-MM-DD
  category: ContentCategory | 'all';
  type: ContentType | 'all';
  searchQuery: string;
}

export interface DateCountOption {
  date: string;
  count: number;
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  'قضية رأي عام',
  'حكم محكمة',
  'قانون جديد',
  'قرار رسمي',
  'تريند',
];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  topic: 'موضوع قانوني',
  post: 'بوست فيسبوك',
  script: 'سكربت فيديو',
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'مسودة',
  approved: 'معتمد',
  published: 'تم النشر',
};

export const FIRM_NAME = 'مؤسسة عمرو منصور للمحاماة والاستشارات القانونية';

export type DraftType = 'post' | 'script';

export interface LiveNewsItem {
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
  legal_score: number;
  category: ContentCategory;
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

export interface LiveNewsResponse {
  items: LiveNewsItem[];
  trendingTerms: string[];
  feeds: FeedFetchStatus[];
  fetchedAt: string;
  cached: boolean;
  scoredBy: 'gemini' | 'keyword_fallback';
  scoringWarning?: string;
  totalFetched: number;
}

export interface AppDraft {
  id: string;
  story_id: string;
  draft_type: DraftType;
  text: string;
  duration_sec?: number;
  created_at: string;
}

