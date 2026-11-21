# Art Saver

A single page app to save art and image links for later. Paste a link, get a preview that is never cropped, and keep everything in a private library you can group into categories, comment on, and sort.

## Stack

- Full-stack TypeScript with npm workspaces.
- `client/` - Vite + React single page app, uses Tailwind CSS.
- `server/` - Express JSON API backed by SQLite.
- `shared/` - schemas and types shared by both sides.

## Running

For developing:

```bash
npm install
npm run dev
```

It opens on http://localhost:5173. Vite proxies `/api` to the backend on :4000.

For production:

```bash
npm run build
npm start
```

The server serves the built client and the API together on http://localhost:4000.

For checking:

```bash
npm test
npm run typecheck
```

## Configuration

- `PORT` (defaults to: `4000`): API port
- `ART_DB` (defaults to `server/data/art.db`): SQLite file, use `:memory:` for a throwaway run
- `ART_PREVIEW_DIR` (defaults to `server/data/previews`): where cached preview images are written

## Notes

- There are no accounts. The first time you open the app it creates a private library and stores a device token in localStorage. Clearing site data starts a new, empty library.
- Previews are fetched server-side and cached. Images are rendered with `object-contain` inside a fixed box, so they are scaled to fit and never cropped.
