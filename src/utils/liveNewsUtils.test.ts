import test from 'node:test';
import assert from 'node:assert/strict';
import type { AggregatorContentItem, LiveNewsItem } from '../types/content';
import {
  extractTrendingItems,
  filterLiveNewsItems,
  findAggregatorMatch,
  formatCairoTimeHHMM,
  getDraftMapKey,
} from './liveNewsUtils';

function makeLiveItem(overrides: Partial<LiveNewsItem>): LiveNewsItem {
  return {
    id: 'live_1',
    story_id: 'live_1',
    title: 'قانون العمل الجديد وحقوق الموظفين',
    link: 'https://www.almasryalyoum.com/news/details/555',
    description: 'تفاصيل التعديلات الجديدة',
    source_name: 'المصري اليوم',
    source_id: 'almasryalyoum',
    pub_date: '2026-11-24T10:00:00.000Z',
    published_ms: Date.parse('2026-11-24T10:00:00.000Z'),
    from_trends: false,
    legal_score: 82,
    category: 'قانون جديد',
    is_legal: true,
    legal_angle: 'يحدد القانون التزامات جهة العمل وحقوق العامل.',
    is_trending: false,
    ...overrides,
  };
}

function makeFirestoreItem(overrides: Partial<AggregatorContentItem>): AggregatorContentItem {
  return {
    id: 'fs-1',
    title: 'عنوان افتراضي',
    summary: '',
    legal_angle: '',
    category: 'قانون جديد',
    type: 'topic',
    source_name: 'المصري اليوم',
    source_url: '',
    status: 'draft',
    content_date: '2026-11-24',
    created_at: null,
    ...overrides,
  };
}

test('findAggregatorMatch matches by normalized source_url or normalized Arabic title', () => {
  const liveByUrl = makeLiveItem({
    link: 'https://almasryalyoum.com/news/details/555/?utm_source=rss',
    title: 'عنوان مختلف تماماً',
  });
  const fsItems: AggregatorContentItem[] = [
    makeFirestoreItem({
      id: 'topic-555',
      source_url: 'https://www.almasryalyoum.com/news/details/555',
      title: 'موضوع معتمد',
    }),
    makeFirestoreItem({
      id: 'topic-title',
      source_url: 'https://other.example.com/1',
      title: 'إحالة متهم للمحاكمة الجنائية بتهمة النصب',
    }),
  ];

  assert.equal(findAggregatorMatch(liveByUrl, fsItems)?.id, 'topic-555');

  const liveByTitle = makeLiveItem({
    link: 'https://egyptindependent.com/other',
    title: 'احاله متهم للمحاكمه الجنائية بتهمه النصب!',
  });
  assert.equal(findAggregatorMatch(liveByTitle, fsItems)?.id, 'topic-title');

  const unmatched = makeLiveItem({
    link: 'https://egyptindependent.com/new-story',
    title: 'خبر جديد غير موجود في الأجريجاتور',
  });
  assert.equal(findAggregatorMatch(unmatched, fsItems), null);
});

test('filterLiveNewsItems applies legalOnly and category filters and keeps legal_score descending', () => {
  const items: LiveNewsItem[] = [
    makeLiveItem({ id: 'a', legal_score: 40, is_legal: true, category: 'قرار رسمي' }),
    makeLiveItem({ id: 'b', legal_score: 90, is_legal: true, category: 'حكم محكمة' }),
    makeLiveItem({ id: 'c', legal_score: 12, is_legal: false, category: 'تريند', is_trending: true }),
  ];

  const legalOnlyAll = filterLiveNewsItems(items, { legalOnly: true, category: 'all' });
  assert.deepEqual(
    legalOnlyAll.map((i) => i.id),
    ['b', 'a']
  );

  const courtOnly = filterLiveNewsItems(items, { legalOnly: false, category: 'حكم محكمة' });
  assert.deepEqual(
    courtOnly.map((i) => i.id),
    ['b']
  );

  const trends = extractTrendingItems(items);
  assert.deepEqual(
    trends.map((i) => i.id),
    ['c']
  );
});

test('formatCairoTimeHHMM and getDraftMapKey produce deterministic outputs', () => {
  const hhmm = formatCairoTimeHHMM('2026-11-24T12:30:00.000Z');
  assert.match(hhmm, /^\d{2}:\d{2}$/);
  assert.equal(getDraftMapKey('live_abc123', 'post'), 'live_abc123::post');
});
