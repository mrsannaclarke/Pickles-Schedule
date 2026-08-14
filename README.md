# Pickles Schedule 2.0

Anatomy Tattoo's React + Vite staff app for Pickles, Bangers, and Cherry Bombs games.

The completed 2026 season sheet is intentionally configured as writable test data. The app requests `include_past=1` from the Apps Script API so old-season games remain available for testing. Other API consumers keep the default future-only response.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` when overriding the Google client ID, Apps Script endpoint, or schedule sheet URL. Keep secrets out of committed environment files.

## Verification

```bash
npm run build
npm run lint
npm audit --omit=dev
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- SPA routing: `public/_redirects` sends unmatched routes to `index.html`
- Add the final `https://<project>.pages.dev` origin to the existing Google OAuth web client before testing Google sign-in.

Next season, update `VITE_SCHEDULE_ENDPOINT` and `VITE_SCHEDULE_SHEET_URL` if the backend or workbook changes. The app itself should not require another framework migration.
