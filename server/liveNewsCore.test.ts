import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeLink,
  createLinkHash,
  deduplicateAndLimitItems,
  parseRssOrAtomXml,
  scoreBatchByKeywords,
  stripHtmlAndDecode,
  type RawRssItem,
} from './liveNewsCore.ts';

test('stripHtmlAndDecode removes tags and decodes HTML entities cleanly', () => {
  const dirty = '<p>محكمة &laquo;النقض&raquo; تصدر حكماً&nbsp;جديداً&#39; اليوم</p>';
  assert.equal(stripHtmlAndDecode(dirty), "محكمة «النقض» تصدر حكماً جديداً' اليوم");
});

test('parseRssOrAtomXml parses RSS 2.0 items and Google Trends Egypt items', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>المصري اليوم</title>
      <item>
        <title>تعديل قانون الإجراءات الجنائية في البرلمان</title>
        <link>https://www.almasryalyoum.com/news/details/1001</link>
        <description><![CDATA[<p>ناقش مجلس النواب مشروع قانون جديد.</p>]]></description>
        <pubDate>Tue, 24 Nov 2026 09:00:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;

  const parsed = parseRssOrAtomXml(rssXml, {
    id: 'almasryalyoum',
    name: 'المصري اليوم',
    url: 'https://www.almasryalyoum.com/rss/feed',
  });

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, 'تعديل قانون الإجراءات الجنائية في البرلمان');
  assert.equal(parsed.items[0].description, 'ناقش مجلس النواب مشروع قانون جديد.');
  assert.equal(parsed.items[0].source_name, 'المصري اليوم');
  assert.match(parsed.items[0].story_id, /^live_[a-f0-9]{16}$/);

  const trendsXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
    <channel>
      <item>
        <title>قرار الضرائب الجديد</title>
        <ht:approx_traffic>5000+</ht:approx_traffic>
        <link>https://trends.google.com/trending/rss?geo=EG</link>
        <pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate>
        <ht:news_item>
          <ht:news_item_title>قرار جديد للمالية عن الضرائب</ht:news_item_title>
          <ht:news_item_url>https://www.almasryalyoum.com/news/details/2002</ht:news_item_url>
          <ht:news_item_source>المصري اليوم</ht:news_item_source>
          <ht:news_item_snippet>تفاصيل القرار الوزاري الجديد</ht:news_item_snippet>
        </ht:news_item>
      </item>
    </channel>
  </rss>`;

  const trendsParsed = parseRssOrAtomXml(trendsXml, {
    id: 'google_trends_eg',
    name: 'Google Trends مصر',
    url: 'https://trends.google.com/trending/rss?geo=EG',
    isTrends: true,
  });

  assert.deepEqual(trendsParsed.trendingTerms, ['قرار الضرائب الجديد']);
  assert.equal(trendsParsed.items.length, 1);
  assert.equal(trendsParsed.items[0].from_trends, true);
  assert.equal(trendsParsed.items[0].approx_traffic, '5000+');
});

test('deduplicateAndLimitItems removes duplicate titles/links and caps at 60 items', () => {
  const baseTime = Date.UTC(2026, 10, 24, 12, 0, 0);
  const items: RawRssItem[] = [];
  for (let i = 0; i < 70; i += 1) {
    items.push({
      id: `id-${i}`,
      story_id: `live_${i}`,
      title: `خبر رقم ${i}`,
      link: `https://example.com/news/${i}`,
      description: 'وصف قصير',
      source_name: 'مصدر',
      source_id: 'src',
      pub_date: new Date(baseTime - i * 60_000).toISOString(),
      published_ms: baseTime - i * 60_000,
      from_trends: false,
    });
  }
  // Duplicate with tracking query params and Arabic alef difference
  items.push({
    id: 'dup-1',
    story_id: 'live_dup',
    title: 'خبر رقم 0',
    link: 'https://www.example.com/news/0/?utm_source=fb',
    description: 'نسخة مكررة',
    source_name: 'مصدر آخر',
    source_id: 'src2',
    pub_date: new Date(baseTime + 1000).toISOString(),
    published_ms: baseTime + 1000,
    from_trends: false,
  });

  const deduped = deduplicateAndLimitItems(items, 60);
  assert.equal(deduped.length, 60);
  assert.equal(canonicalizeLink('https://www.example.com/news/0/?utm_source=fb'), 'example.com/news/0');
});

test('scoreBatchByKeywords elevates legal stories and marks Google Trends matches', () => {
  const now = Date.now();
  const sample: RawRssItem[] = [
    {
      id: 'non-legal',
      story_id: createLinkHash('https://ex.com/1', 'نتيجة مباراة كرة القدم اليوم'),
      title: 'نتيجة مباراة كرة القدم اليوم في الدوري',
      link: 'https://ex.com/1',
      description: 'فاز الفريق بهدفين نظيفين في الشوط الثاني',
      source_name: 'المصري اليوم',
      source_id: 'almasryalyoum',
      pub_date: new Date(now).toISOString(),
      published_ms: now,
      from_trends: false,
    },
    {
      id: 'legal-1',
      story_id: createLinkHash('https://ex.com/2', 'محكمة الجنايات تصدر حكماً في قضية كبرى'),
      title: 'محكمة الجنايات تصدر حكماً في قضية رأي عام',
      link: 'https://ex.com/2',
      description: 'قضت المحكمة بالسجن المشدد بعد تحقيقات النيابة العامة',
      source_name: 'المصري اليوم',
      source_id: 'almasryalyoum',
      pub_date: new Date(now - 1000).toISOString(),
      published_ms: now - 1000,
      from_trends: false,
    },
  ];

  const scored = scoreBatchByKeywords(sample, ['قضية رأي عام']);
  assert.equal(scored[0].id, 'legal-1');
  assert.equal(scored[0].is_legal, true);
  assert.equal(scored[0].is_trending, true);
  assert.ok(scored[0].legal_score > scored[1].legal_score);
  assert.equal(scored[1].is_legal, false);
  assert.equal(scored[1].legal_angle, '');
});
