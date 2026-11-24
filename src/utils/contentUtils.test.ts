import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countCharacters,
  filterArchiveContent,
  getAvailableDates,
  groupDayContent,
  isValidContentStatus,
  normalizeArabicSearch,
  normalizeFirestoreDocument,
  resolveDetailBundle,
  sanitizeExternalUrl,
  sortItemsByCreatedAtDesc,
  validateLoginForm,
} from './contentUtils';
import {
  formatArabicContentDate,
  formatArabicTimeEgypt,
  formatDurationArabic,
  getEgyptDateString,
  getEgyptOffsetDateString,
} from './dateUtils';
import { buildSampleContent } from '../data/sampleContent';

test('getEgyptDateString and offset produce valid YYYY-MM-DD strings in Cairo timezone', () => {
  const fixedDate = new Date('2026-11-24T22:30:00Z'); // 2026-11-25 00:30 in Africa/Cairo (UTC+2)
  assert.equal(getEgyptDateString(fixedDate), '2026-11-25');
  assert.equal(getEgyptOffsetDateString(-1, fixedDate), '2026-11-24');
  assert.equal(getEgyptOffsetDateString(-3, fixedDate), '2026-11-22');
});

test('formatArabicContentDate formats valid dates in Arabic and handles invalid dates', () => {
  const formatted = formatArabicContentDate('2026-11-24');
  assert.ok(formatted.includes('نوفمبر'), `Expected Arabic month in "${formatted}"`);
  assert.equal(formatArabicContentDate('invalid'), 'invalid');
  assert.equal(formatArabicTimeEgypt(null), '');
});

test('formatDurationArabic renders seconds and minutes clearly', () => {
  assert.equal(formatDurationArabic(45), '45 ثانية');
  assert.equal(formatDurationArabic(60), 'دقيقة واحدة');
  assert.equal(formatDurationArabic(95), 'دقيقة و35 ثانية');
  assert.equal(formatDurationArabic(0), 'غير محددة');
});

test('groupDayContent groups topics, posts, scripts and computes stats accurately', () => {
  const baseDate = new Date('2026-11-24T12:00:00Z');
  const sample = buildSampleContent(baseDate);
  const today = getEgyptDateString(baseDate);

  const grouped = groupDayContent(sample, today);
  assert.equal(grouped.stats.topicsCount, 3);
  assert.equal(grouped.stats.postsCount, 3);
  assert.equal(grouped.stats.scriptsCount, 2);
  assert.equal(grouped.stats.publishedCount, 1);

  const topicWithBoth = grouped.topics.find((b) => b.topic.id === 'sample-topic-today-1');
  assert.ok(topicWithBoth?.linkedPost);
  assert.ok(topicWithBoth?.linkedScript);

  const topicWithOnlyPost = grouped.topics.find((b) => b.topic.id === 'sample-topic-today-3');
  assert.ok(topicWithOnlyPost?.linkedPost);
  assert.equal(topicWithOnlyPost?.linkedScript, undefined);
});

test('resolveDetailBundle resolves parent topic and siblings from a clicked post or script', () => {
  const baseDate = new Date('2026-11-24T12:00:00Z');
  const sample = buildSampleContent(baseDate);
  const postItem = sample.find((i) => i.id === 'sample-post-today-2')!;
  const bundle = resolveDetailBundle(postItem, sample);

  assert.equal(bundle.topic.id, 'sample-topic-today-2');
  assert.equal(bundle.linkedPost?.id, 'sample-post-today-2');
  assert.equal(bundle.linkedScript?.id, 'sample-script-today-2');
});

test('filterArchiveContent filters by date, category, type, and Arabic normalized search', () => {
  const baseDate = new Date('2026-11-24T12:00:00Z');
  const sample = buildSampleContent(baseDate);
  const yesterday = getEgyptOffsetDateString(-1, baseDate);

  const byDate = filterArchiveContent(sample, {
    selectedDate: yesterday,
    category: 'all',
    type: 'all',
    searchQuery: '',
  });
  assert.equal(byDate.length, 3);

  const byCategoryAndType = filterArchiveContent(sample, {
    selectedDate: '',
    category: 'قانون جديد',
    type: 'script',
    searchQuery: '',
  });
  assert.equal(byCategoryAndType.length, 2);

  const bySearch = filterArchiveContent(sample, {
    selectedDate: '',
    category: 'all',
    type: 'all',
    searchQuery: 'ايجار',
  });
  assert.equal(bySearch.length, 3);
  assert.equal(normalizeArabicSearch('الإيجار'), normalizeArabicSearch('الايجار'));
});

test('getAvailableDates returns unique dates sorted descending with counts', () => {
  const baseDate = new Date('2026-11-24T12:00:00Z');
  const sample = buildSampleContent(baseDate);
  const dates = getAvailableDates(sample);

  assert.equal(dates.length, 4);
  assert.equal(dates[0].date, getEgyptDateString(baseDate));
  assert.equal(dates[0].count, 8);
  assert.ok(dates[0].date > dates[1].date);
});

test('normalizeFirestoreDocument safely handles null/missing fields, pending serverTimestamp, and blocks unsafe URLs', () => {
  // Pending server timestamp (created_at: null) and all-null optional fields
  const pendingItem = normalizeFirestoreDocument(
    'doc-pending',
    {
      title: null,
      summary: null,
      legal_angle: null,
      category: null,
      type: 'post',
      topic_id: null,
      post_text: 'نص بوست جاهز',
      script_text: 'should be ignored for post type',
      duration_sec: 45,
      source_name: null,
      source_url: 'javascript:alert(1)',
      status: null,
      content_date: null,
      created_at: null,
    },
    '2026-11-24'
  );

  assert.equal(pendingItem.title, 'بدون عنوان');
  assert.equal(pendingItem.summary, '');
  assert.equal(pendingItem.legal_angle, '');
  assert.equal(pendingItem.category, 'قضية رأي عام');
  assert.equal(pendingItem.status, 'draft');
  assert.equal(pendingItem.post_text, 'نص بوست جاهز');
  assert.equal(pendingItem.script_text, undefined);
  assert.equal(pendingItem.duration_sec, undefined);
  assert.equal(pendingItem.source_name, 'مصدر إخباري');
  assert.equal(pendingItem.source_url, '');
  assert.equal(pendingItem.content_date, '2026-11-24');
  assert.equal(pendingItem.created_at, null);

  // Completely undefined payload must never crash
  const emptyDoc = normalizeFirestoreDocument('doc-empty', undefined, '2026-11-24');
  assert.equal(emptyDoc.type, 'topic');
  assert.equal(emptyDoc.created_at, null);

  // Pending server timestamp (null) sorts ahead of older timestamps in desc order
  const olderDoc = normalizeFirestoreDocument(
    'doc-older',
    {
      title: 'حكم قديم',
      type: 'script',
      duration_sec: '65',
      created_at: { toDate: () => new Date('2026-11-24T09:00:00Z') },
    },
    '2026-11-24'
  );
  assert.equal(olderDoc.duration_sec, 65);
  const sorted = sortItemsByCreatedAtDesc([olderDoc, pendingItem]);
  assert.equal(sorted[0].id, 'doc-pending');

  assert.equal(
    sanitizeExternalUrl('https://gate.ahram.org.eg/news'),
    'https://gate.ahram.org.eg/news'
  );
});

test('isValidContentStatus validates allowed Firestore workflow statuses strictly', () => {
  assert.equal(isValidContentStatus('draft'), true);
  assert.equal(isValidContentStatus('approved'), true);
  assert.equal(isValidContentStatus('published'), true);
  assert.equal(isValidContentStatus('archived'), false);
  assert.equal(isValidContentStatus(null), false);
});

test('validateLoginForm rejects invalid/empty fields and accepts valid credentials', () => {
  const emptyResult = validateLoginForm('', '');
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.emailError);
  assert.ok(emptyResult.passwordError);

  const badEmail = validateLoginForm('not-an-email', '123456');
  assert.equal(badEmail.valid, false);
  assert.ok(badEmail.emailError);
  assert.equal(badEmail.passwordError, undefined);

  const shortPassword = validateLoginForm('lawyer@mansourlaw.eg', '123');
  assert.equal(shortPassword.valid, false);
  assert.ok(shortPassword.passwordError);

  const valid = validateLoginForm('lawyer@mansourlaw.eg', 'SecurePass123');
  assert.equal(valid.valid, true);
});

test('countCharacters trims whitespace and handles null safely', () => {
  assert.equal(countCharacters('  مرحبا  '), 5);
  assert.equal(countCharacters(undefined), 0);
  assert.equal(countCharacters(null), 0);
});
