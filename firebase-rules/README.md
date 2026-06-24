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
   anonymously, so write access on those paths must stay open. We instead:
   - lock all **reads** of PII-bearing collections to verified `@felice.ed.jp` accounts,
   - allow anonymous **create** on individual log entries (`!data.exists()`),
   - allow `@felice.ed.jp` staff to overwrite/delete (needed for dashboard log deletion),
   - `.validate` the shape of new log entries.
2. **The worker uses unauthenticated REST.** It reads `config/searchSettings/*` and
   reads/writes `searchCache/*`, so those stay world-readable/writable.
3. **`deviceRegistry` / `users`** allow read at the specific `$deviceId`/`$uid` child (the kid
   app reads its own node by id) but block listing the whole collection unless you are a
   verified `@felice.ed.jp` admin (prevents enumeration of all students' PII).

## Known limitation / follow-up

Because anonymous writes are permitted, the log paths can still be **forged** by anyone who
knows the database URL. To close this, add **Firebase App Check** (and/or Anonymous Auth) to
the kid app and tighten `.write` to require `auth != null`. Tracked as a follow-up.

## `config/admins`

Privileged dashboard actions (log deletion, worker toggles) check an admin allowlist. The
live list lives at `config/admins` in `gfa-typing` as an array of lowercase emails, e.g.

```json
{ "config": { "admins": ["john.limpiada@felice.ed.jp"] } }
```

Keep this in sync with the worker's `ADMIN_EMAILS` env var.
