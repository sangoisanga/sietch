# Sietch

A local-first English pronunciation drill. Pick a world you like — The Beatles, Rumi, Sherlock
Holmes — and it writes an original passage that contains every sound in English, checks its own
phoneme coverage, reads it aloud, and schedules it to come back.

Everything lives in your browser: profiles, progress, generated audio and the review schedule are
all in IndexedDB. It installs as a PWA and works offline. Bring your own Gemini or OpenRouter key
for speech and passage generation; without one, the bundled passages still play through the
browser voice.

The idea came from [drill_forge](https://www.lampt.org/tools/drill_forge.html); the code here is
a rewrite, not a fork.

## Running it

```
npm install
npm run dev
```

| Script | |
|---|---|
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | `tsc` and `svelte-check` |
| `npm run lint` | ESLint |
| `npm run build` | production bundle + service worker |
| `npm run build:pool` | rebuild the bundled starter pool |
| `npm run build:icons` | rebuild the app icons |

## How it fits together

| | |
|---|---|
| `src/core/` | pure logic — phoneme audit, accents, SM-2, prompts. No DOM, storage or network |
| `src/content/` | what a drill *is*: pool format, validation, rotation |
| `src/data/` | IndexedDB schema and repositories |
| `src/providers/` | swappable TTS and LLM backends behind one interface |
| `src/state/` | reactive app state and the actions on top of it |
| `src/ui/` | Svelte components |

`docs/baseline.md` has the rules this is held to, including the layering above and how schema
changes are migrated. `docs/deploy.md` covers Cloudflare Pages.

## Sharing content

Drill packs travel as `.sietch.json` files — a checksummed pool of passages, optionally carrying
its generated audio so the other device doesn't pay for text-to-speech again. Import and export
live on the Library page.
