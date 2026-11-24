# Security Specification — `aggregator_content`

## 1. Data Invariants

1. **Server-Side Ingestion Only**: Documents in `aggregator_content` are written exclusively by the external AI aggregator via Firebase Admin SDK (which bypasses client security rules). Client SDKs may NEVER `create` or `delete` documents in `aggregator_content`.
2. **Single Password-Authenticated Admin Only**: Unauthenticated requests, Google Sign-In sessions, and any account other than the password-authenticated `admin` account (`admin@amromansour-law.eg`) are denied for every operation (`get`, `list`, `create`, `update`, `delete`) on `aggregator_content` and all other paths.
3. **Status-Only Client Mutation**: The authenticated `admin` user may ONLY update the `status` field of an existing `aggregator_content/{docId}` document, and only to one of `'draft'`, `'approved'`, or `'published'`.
4. **No PII Storage**: `aggregator_content` stores only public news headlines, legal commentary, Facebook posts, and video scripts for the law firm—never personal emails, phone numbers, or private user profiles.
5. **Default-Deny Catch-All**: Any path outside `/aggregator_content/{docId}` is denied for both `read` and `write`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)

1. **Unauthenticated Read**: `get` `/aggregator_content/doc-1` with `auth: null`.
2. **Unauthenticated List**: `list` `/aggregator_content` with `auth: null`.
3. **Client Create Attempt**: `create` `/aggregator_content/new-doc` by a signed-in user with valid schema fields.
4. **Client Delete Attempt**: `delete` `/aggregator_content/doc-1` by a signed-in user.
5. **Shadow Field Injection**: `update` `/aggregator_content/doc-1` with `{ status: "approved", isAdmin: true }`.
6. **Title Tampering**: `update` `/aggregator_content/doc-1` with `{ status: "approved", title: "Hacked" }`.
7. **Post Text Tampering**: `update` `/aggregator_content/doc-1` with `{ post_text: "Injected spam link" }`.
8. **Invalid Status Enum**: `update` `/aggregator_content/doc-1` with `{ status: "deleted" }`.
9. **Value Type Poisoning (Boolean)**: `update` `/aggregator_content/doc-1` with `{ status: true }`.
10. **Value Size Poisoning (1MB String)**: `update` `/aggregator_content/doc-1` with `{ status: "a".repeat(1000000) }`.
11. **Path ID Poisoning**: `update` `/aggregator_content/invalid$id!with..chars` with `{ status: "approved" }`.
12. **Unauthorized Collection Access**: `read` or `write` on `/users/u1` or `/admin_settings/config` by any signed-in user.
