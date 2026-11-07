Business Intelligence & Management Operations

# BIMO

BIMO is a local-first business workspace for online sellers and small businesses. It aims to bring the existing BIMO app shell together with seller operations such as products and stock, customer summaries, finances, backups, message intake, and an offline helper.

## Privacy and data model

BIMO is designed to store business records in browser storage on the device. It does not provide a BIMO-operated business-data database or automatic cloud sync. Hosting delivers the app and updates; it is not intended to store seller records. Browser data can be cleared or lost, so users should export backups regularly.

Some optional integrations contact third parties. In particular, configured provider-based AI sends the prompt and the business context included by the app to the provider selected by the user. See [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md).

## Existing app features

- BIMO account and session screens stored client-side
- Dashboard and order ledger
- Order CSV export and order backup/restore
- Light/dark theme and installable PWA support
- Optional bring-your-own-provider AI integration
- Audit and order-ledger integrity helpers

## Seller workspace files

The repository also contains `seller-workspace.js` and `seller-low-stock.js`. **These are not yet integrated into `index.html` in the current app.** Do not assume their seller pages are available in the deployed app until the intended module has been wired into the app shell and tested.

The two seller modules use separate business-data storage approaches. Do not load both together until their product data and backup/import behavior have been unified. Seller Hub data is in a different format from the BIMO app's existing order data; migration needs an explicit, tested import flow. Back up existing records before experimenting.

## Intended seller features

The planned seller workspace includes:

- Products, stock updates, and adjustable low-stock alerts (default threshold: 5)
- Customer summaries and sales-source tracking
- Revenue, expenses, and profit views
- Pasted/shared WhatsApp and social-message order intake, reviewed before saving
- WhatsApp follow-up and invoice generation
- Local offline business helper and informational order-risk warnings
- Seller-controlled complete backup and restore
- Bengali and English support

Feature availability depends on integration and testing; this list describes goals, not a guarantee that every item is currently connected.

## Run locally

Serve the static app from the repository root (service workers generally require localhost or HTTPS):

```bash
python -m http.server 8000
```

Open <http://localhost:8000>.

## Project files

- `index.html` — existing app UI and inline application code
- `bimo-core.js` — client-side account/session, audit, AI, and order-backup helpers
- `seller-workspace.js` — seller workspace prototype module (not yet loaded by `index.html`)
- `seller-low-stock.js` — separate low-stock module (not yet loaded by `index.html`)
- `sw.js` — service worker and offline app cache
- `ux.js` — optional UX helper
- `manifest.webmanifest` and `icon.*` — PWA metadata and icons
- `PRIVACY.md`, `TERMS.md`, `CREDITS.md` — project policy drafts and attribution
- `LICENSE` — MIT license

## Security limitations

This static client-side app is not a server-backed authentication, encrypted cloud storage, or multi-device synchronization service. Local browser storage is not a secure vault and may be accessible to someone with access to the device/browser profile. Do not use it as a substitute for production authentication or store bank credentials and other highly sensitive secrets.

Optional AI requests go to the provider configured by the user. Review that provider's data and retention terms before sending customer or financial details. The local offline helper is separate and is intended to work without an AI-provider request.

## Before enabling the seller modules

1. Back up any existing BIMO and Seller Hub data.
2. Choose one seller module and integrate it into `index.html`; don't load both concurrently yet.
3. Connect its product/order storage to the intended business data model and backup/restore flow.
4. Test product thresholds, stock effects for order create/cancel/return, customer/money reports, pasted-message review, and restore using disposable data.
5. Update the service-worker asset list and cache version, then test offline app loading.
6. Verify the legal drafts reflect the actual deployment and review them for applicable laws.

## Creator, contributors, and license

BIMO was created and is maintained by Rajib (`rh0raju`): <https://github.com/rh0raju>. Contributor attribution checked for this repository includes `rh0raju` and `netlify-bot`; see [CREDITS.md](CREDITS.md).

This repository is licensed under the MIT License; see [LICENSE](LICENSE). Third-party services, names, and assets remain subject to their own terms and licenses.
