# برومبت الربط — يُلصق في نفس مشروع Google AI Studio بعد البرومبت الأول

```
The app is already built. Now finalize its connection to the external aggregator system. The aggregator is an external AI system that writes content into my Firestore using the Firebase Admin SDK (server-side, bypasses security rules). This app must NEVER create documents in aggregator_content — it only reads them and updates the "status" field. Make exactly these adjustments:

1. DATA CONTRACT — make the app read collection "aggregator_content" with exactly these fields and types, and handle every field defensively (missing or null fields must never crash the UI):
   - title: string
   - summary: string
   - legal_angle: string
   - category: string — one of: "قضية رأي عام" | "حكم محكمة" | "قانون جديد" | "قرار رسمي" | "تريند"
   - type: string — one of: "topic" | "post" | "script"
   - topic_id: string (optional, links a post/script to its topic)
   - post_text: string (only when type = "post")
   - script_text: string (only when type = "script")
   - duration_sec: number (only when type = "script")
   - source_name: string
   - source_url: string
   - status: string — "draft" | "approved" | "published"
   - content_date: string in format "YYYY-MM-DD" (Africa/Cairo day the content belongs to)
   - created_at: Firestore Timestamp (server-written; may arrive as a pending server timestamp — handle null gracefully)

2. QUERIES — "Today" page: query where content_date == today's date in Africa/Cairo timezone, ordered by created_at desc, live via onSnapshot. Archive page: query by selected content_date, plus client-side filters for category, type, and text search on title + summary.

3. STATUS UPDATES — the status buttons must update ONLY the "status" field of the document (updateDoc with { status }), nothing else. Show an Arabic error toast if the update fails (for example due to permissions).

4. FIRESTORE SECURITY RULES — generate the exact rules for this app and show them to me in a code block so I can paste them into Firebase Console → Firestore Database → Rules. The rules must:
   - Deny everything by default.
   - Allow read on aggregator_content only for signed-in users (request.auth != null).
   - Allow update on aggregator_content only for signed-in users, and only when the ONLY changed field is "status" and its new value is one of "draft", "approved", "published".
   - Never allow create or delete on aggregator_content from the client.

5. CONFIG CHECK — on startup, if the Firebase config placeholders in src/firebase-config.ts are still unchanged, keep showing the clearly-marked demo data with the "بيانات تجريبية" badge and the preview login, exactly as now. Once real config is pasted, switch automatically to live Firestore data and real Firebase Authentication — no other code changes needed from me.

6. Do not change the design, layout, pages, or any existing feature. Only apply the connection adjustments above and confirm each one after applying it.
```

## ملحوظات للمستخدم (مش جزء من البرومبت)

- البرومبت ده بيظبط ناحية التطبيق بس. الربط الكامل محتاج خطوتين كمان:
  1. من عندك: تلصق Firebase Config بتاع مشروعك في `src/firebase-config.ts`، وتفعّل Email/Password من Firebase Authentication، وتلصق قواعد الأمان (Security Rules) اللي هيطلعها لك AI Studio في Firebase Console.
  2. من عندي: تديني الـ Firebase Project ID بتاع نفس المشروع، فأبدأ أكتب محتوى كل يوم في `aggregator_content` بنفس الحقول دي — وساعتها التطبيق هيعرضه لحظياً.
