Business Intelligence & Management Operations

## Reusable core script

`bimo-core.js` is a dependency-free, drop-in script that powers BIMO's platform
features and can be reused in any web project. Include it before your app code:

```html
<script src="bimo-core.js"></script>
```

It exposes a global `Bimo` object with:

- `Bimo.accounts` — create/find/save/remove local accounts (email or phone as identity)
- `Bimo.auth` — `login(identifier, password)` with brute-force lockout, `changePassword`, `resetPassword`
- `Bimo.session` — 7-day sessions with automatic expiry
- `Bimo.audit` — append-only, hash-chained activity log with `log`, `list`, `verify`
- `Bimo.ledger` — tamper-evident signatures for business data (`sign`, `verify`)
- `Bimo.validate` — email/phone/URL/password/amount/text validation helpers
- `Bimo.install` — PWA install prompt handling with availability callbacks
- `Bimo.ai` — bring-your-own-key AI client for any OpenAI-compatible provider
- `Bimo.backup` — portable JSON export/import of user data

All data is stored client-side; passwords are stored as salted SHA-256 hashes and
legacy plaintext entries are upgraded automatically on the next successful login.
