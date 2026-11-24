# برومبت الوضع اللحظي — يُلصق في نفس مشروع Google AI Studio (بعد برومبت تكافؤ المميزات)

```
Make the «نشرة الأخبار» stream in this app TRULY LIVE and self-sufficient, exactly like the external aggregator's own dashboard: pressing «تحديث الآن» must fetch the latest Egypt news from the internet at that moment — not wait for the external aggregator's daily Firestore push. Implement this with a server-side endpoint in this app (the Cloud Run server side of this AI Studio app), because browsers cannot fetch these feeds directly (CORS). Keep the existing theme, pages, admin-only auth, and all current features. Requirements:

1. SERVER-SIDE LIVE FETCH ENDPOINT (e.g. GET /api/live-news):
   - Fetch and parse these public RSS feeds server-side: Youm7 (https://www.youm7.com/rss/SectionRss?SectionID=65), Al-Masry Al-Youm (https://www.almasryalyoum.com/rss/feed), Egypt Independent (https://www.egyptindependent.com/feed/), and Google Trends Egypt (https://trends.google.com/trending/rss?geo=EG) for trending signals. If any single feed fails or changes format, the endpoint must still return the others — never fail the whole request because of one source.
   - For each item extract: title, link, publication date, short description, source name. Deduplicate by normalized title/link across feeds. Keep at most the 60 most recent items.
   - Cache the raw fetch server-side for 10 minutes so repeated refresh clicks do not hammer the sources; add a query parameter (e.g. ?force=1) used by the «تحديث الآن» button to bypass the cache.

2. LEGAL SCORING WITH GEMINI (server-side, batched — one Gemini call for the whole batch, not one per story):
   - For each fetched item, Gemini returns: legal_score (0-100 legal relevance for a law firm), category (one of: "قضية رأي عام" | "حكم محكمة" | "قانون جديد" | "قرار رسمي" | "تريند"), is_legal (boolean), legal_angle (one Arabic sentence: why this matters legally, or empty if none), is_trending (boolean, true when the item matches a Google Trends Egypt trending query or is clearly a viral topic).
   - STRICT RULE for the scoring prompt: base scores and legal_angle ONLY on the item's title and description as given. Never invent laws, article numbers, court rulings, or facts not present in the item. General non-legal news gets a low legal_score and an empty legal_angle.
   - If Gemini is unavailable, fall back to keyword-based scoring (words like محكمة، نيابة، قضية، حكم، قانون، تشريع، جريمة، متهم، عقوبة raise the score) so the stream still works.

3. STREAM UI INTEGRATION:
   - The «نشرة الأخبار» tab shows the LIVE stream by default: sorted by legal_score descending, with the existing «قانوني فقط» toggle, category chips, and the separate «التريندات» section — same design as the Firestore stream.
   - «تحديث الآن» calls the endpoint with force=1 and updates the stream immediately, showing «آخر تحديث: HH:MM» and a «مباشر» badge on live items. Also auto-refresh the live stream every 15 minutes while the tab is open.
   - Items that also exist in the Firestore aggregator_stories collection (match by source_url or normalized title) get a badge «معتمد من الأجريجاتور»; live-only items get the «مباشر» badge. The Firestore stream remains available via the existing date/archive views exactly as before — do not remove it.
   - The per-story «بوست فيسبوك» and «سكربت فيديو» buttons work on live items exactly as on Firestore items (same strict generation system prompt from the previous step), and generated drafts still save into app_drafts with story_id set to the item's link hash for live items.

4. Keep all Firestore security rules unchanged for this feature (the live endpoint is server-side and needs no client Firestore access). After applying, confirm: the endpoint URL, which feeds succeeded, and that a forced refresh visibly updates the stream with current headlines.
```

## ملحوظات للمستخدم (مش جزء من البرومبت)

- كده تطبيقك هيبقى لحظي بجد: بيجلب الأخبار من مصادرها مباشرة وقت ما تدوس تحديث، وGemini بيرتبها قانونياً في نفس اللحظة — من غير ما يستنى دفعتي اليومية.
- شغلي أنا بيكمل زي ما هو بالتوازي: النشرة الصباحية على واتساب + المحتوى المُنتقى (المواضيع والبوستات والسكربتات الجاهزة) في Firestore — والأخبار المشتركة بين الاتنين هتظهر في التطبيق بشارة «معتمد من الأجريجاتور».
- ملحوظة واقعية: جودة «التريند» في الوضع اللحظي معتمدة على Google Trends مصر والعناوين المتداولة، وروابط الـ RSS ممكن تتغير صيغتها مع الوقت — البرومبت مظبط إن لو مصدر وقع، الباقي يكمّل عادي.
