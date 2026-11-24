# برومبت إصلاحات — يُلصق في نفس مشروع Google AI Studio (بعد مراجعة الريبو)

```
I reviewed this app's code against the aggregator contract. Apply exactly these fixes — do not change the design, pages, or any working feature:

1. DATES INDEX (performance): The overview listener currently downloads EVERY document in aggregator_content just to build the dates sidebar and detect an empty collection. The external aggregator now also maintains a tiny collection named "aggregator_dates": one document per day, document ID = the date itself (YYYY-MM-DD), with fields: content_date (string), count (number), updated_at (timestamp). Change the app to build the available-dates sidebar and the empty-collection check from aggregator_dates instead of scanning aggregator_content. Add matching Firestore rules for aggregator_dates: signed-in admin read only, no client create/update/delete. If aggregator_dates is empty or missing, fall back to the current behavior so nothing breaks. The per-day and archive queries on aggregator_content stay exactly as they are.

2. TODAY DATE REFRESH: The "today" date is computed once when the app mounts, so an open dashboard keeps showing yesterday after midnight (Africa/Cairo). Recompute the Egypt date string when the tab becomes visible again and at least once per minute, and resubscribe the Today query when the date changes.

3. REMOVE DEAD CODE AND DEPENDENCIES: The packages "@google/genai", "express", and "dotenv" (and "@types/express") are declared but never imported anywhere — remove them from package.json. This app must never generate AI content; content only arrives from Firestore. Also delete the GEMINI_API_KEY section from .env.example, rename the package in package.json from "react-example" to "amr-mansour-content-system", and remove the startup testConnection() server read of the document test/connection from src/firebase-config.ts (the security rules deny it, so it logs a permission error on every load and wastes a read).

4. LOGIN CLARITY: Sign-in is intentionally restricted to the single admin account (username "admin" → admin@amromansour-law.eg, Email/Password) in both the client and the Firestore rules. There is NO Google sign-in in this app — remove any text, button, or hint anywhere in the UI or docs that suggests Google sign-in exists, and make sure the login screen clearly says to use the admin username and password.

After applying each fix, confirm it briefly and keep everything else untouched.
```

## ملحوظة للمستخدم (مش جزء من البرومبت)

- البند 1 محتاج من ناحيتي وأنا عملته خلاص: بقيت أكتب كل يوم مستند صغير في `aggregator_dates` (واحد لكل يوم، فيه التاريخ وعدد عناصر اليوم) — مستند النهاردة اتكتب واتأكد. بس خلي بالك: قواعد الأمان الحالية هتمنع التطبيق يقرأ المجموعة الجديدة لحد ما AI Studio يضيف قاعدة قراءتها ضمن الإصلاحات اللي فوق — لحد ما ده يحصل التطبيق شغال بالطريقة القديمة عادي من غير أي كسر.
- البند 4 قراره عندك: الوضع الحالي (حساب أدمن واحد بكلمة مرور) هو الأكثر أماناً. لو عايز دخول جوجل كمان، قولي وأنا أكتب لك برومبت منفصل بيضيفه لحساب جوجل بتاعك أنت بس تحديداً في الكود والقواعد مع بعض.
