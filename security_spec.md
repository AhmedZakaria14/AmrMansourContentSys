# Security Specification — `aggregator_content` & `aggregator_dates`

## 1. Data Invariants

1. **Server-Side Ingestion Only**: Documents in `aggregator_content` and `aggregator_dates` are written exclusively by the external AI aggregator via Firebase Admin SDK (which bypasses client security rules). Client SDKs may NEVER `create` or `delete` documents in `aggregator_content`, and may NEVER `create`, `update`, or `delete` documents in `aggregator_dates`.
2. **Single Password-Authenticated Admin Only**: Unauthenticated requests and any account other than the password-authenticated `admin` account (`admin@amromansour-law.eg`) are denied for every operation (`get`, `list`, `create`, `update`, `delete`) across the entire database.
3. **Status-Only Client Mutation**: The authenticated `admin` user may ONLY update the `status` field of an existing `aggregator_content/{docId}` document, and only to one of `'draft'`, `'approved'`, or `'published'`.
4. **No PII Storage**: `aggregator_content` and `aggregator_dates` store only public news headlines, legal commentary, Facebook posts, video scripts, and daily counts for the law firm—never personal emails, phone numbers, or private user profiles.
5. **Default-Deny Catch-All**: Any path outside `/aggregator_content/{docId}` and `/aggregator_dates/{dateId}` is denied for both `read` and `write`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)

1. **Unauthenticated Read**: `get` `/aggregator_content/doc-1` or `/aggregator_dates/2026-11-24` with `auth: null`.
2. **Unauthenticated List**: `list` `/aggregator_content` or `/aggregator_dates` with `auth: null`.
3. **Client Create Attempt**: `create` `/aggregator_content/new-doc` or `/aggregator_dates/2026-11-24` by the admin user.
4. **Client Delete Attempt**: `delete` `/aggregator_content/doc-1` or `/aggregator_dates/2026-11-24` by the admin user.
5. **Client Dates Index Update Attempt**: `update` `/aggregator_dates/2026-11-24` with `{ count: 999 }`.
6. **Shadow Field Injection**: `update` `/aggregator_content/doc-1` with `{ status: "approved", isAdmin: true }`.
7. **Title Tampering**: `update` `/aggregator_content/doc-1` with `{ status: "approved", title: "Hacked" }`.
8. **Post Text Tampering**: `update` `/aggregator_content/doc-1` with `{ post_text: "Injected spam link" }`.
9. **Invalid Status Enum**: `update` `/aggregator_content/doc-1` with `{ status: "deleted" }`.
10. **Value Type & Size Poisoning**: `update` `/aggregator_content/doc-1` with `{ status: true }` or `{ status: "a".repeat(1000000) }`.
11. **Path ID Poisoning**: `update` `/aggregator_content/invalid$id!with..chars` with `{ status: "approved" }`, or `get` `/aggregator_dates/not-a-date`.
12. **Unauthorized Collection Access**: `read` or `write` on `/users/u1` or `/admin_settings/config`.
