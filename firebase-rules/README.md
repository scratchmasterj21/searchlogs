# Firebase Realtime Database security rules

These are the security rules for the two RTDB instances this project uses. They are kept
here for reference and review. **They are not auto-deployed** - apply them manually in the
Firebase console (Realtime Database -> Rules -> paste -> Publish) or via the Firebase CLI.

## Files

- `englishconversationbot.rules.json` - the **logs** database (`searchLogs`, `aiChatLogs`,
  `flaggedSearches`, `deviceRegistry`, `users`). Read by the dashboard; written by the
  kid-facing search app.
- `gfa-typing.rules.json` - the **config/cache** database (`config/searchSettings`,
  `config/admins`, `searchCache`, `workerActivityLogs`). Read/written by the dashboard,
  the worker, and the kid app.

## Design constraints (why the rules look the way they do)

1. **Students are not authenticated.** The kid search app writes logs and registers devices
   anonymously, so write access on those paths stays open, with `.validate` on the shape of
   new log entries.
2. **The dashboard authenticates against `gfa-typing`, not `englishconversationbot`.** Google
   sign-in in the dashboard runs on the `gfa-typing` Firebase app (see `firebaseConfig.tsx`),
   while the logs live in the `englishconversationbot` app, which the dashboard reads with **no
   auth session** (RTDB auth is per-project and tokens are not portable across projects).
   Therefore `englishconversationbot` read rules **cannot** require `auth != null` - doing so
   returns `Permission denied` for the dashboard (and breaks bulk-delete). Reads there are left
   open; the meaningful lockdown lives on the `gfa-typing` side, where the dashboard *is*
   authenticated.
3. **The worker uses unauthenticated REST.** It reads `config/searchSettings/*` and
   reads/writes `searchCache/*` on `gfa-typing`, so those stay world-readable/writable.
4. **`gfa-typing` is locked down:** `config/admins` and `workerActivityLogs` reads/writes and
   `config/searchSettings` writes require a verified `@felice.ed.jp` account, which the
   dashboard has.

## Known limitation / follow-up (important)

To actually lock down **reads of student PII** in `englishconversationbot` (search/AI logs,
`deviceRegistry`, `users`), the dashboard must hold a Firebase Auth session **on that project**.
The recommended fix is one of:

- Move the dashboard's logs reads behind a server (the worker), which reads via the Admin SDK /
  REST with a privileged key, and have the dashboard call the worker instead of RTDB directly; or
- Add a second Google sign-in / cross-project credential on the `englishconversationbot` app so
  `auth.token.email` is available there, then re-introduce the verified-domain read rules; or
- Add **Firebase App Check** to both apps to stop forged anonymous writes.

Until one of those lands, `englishconversationbot` reads remain open by necessity.

## `config/admins`

Privileged dashboard actions (log deletion, worker toggles) check an admin allowlist. The
live list lives at `config/admins` in `gfa-typing` as an array of lowercase emails, e.g.

```json
{ "config": { "admins": ["john.limpiada@felice.ed.jp"] } }
```

Keep this in sync with the worker's `ADMIN_EMAILS` env var.
