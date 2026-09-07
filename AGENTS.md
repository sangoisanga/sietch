# Sietch

A local-first English pronunciation drill. Svelte 5 (runes), TypeScript, Vite, IndexedDB, PWA.
Everything runs in the browser; there is no backend.

## Definition of done

All four pass, every change, no exceptions:

```
npm run typecheck    # tsc + svelte-check
npm run lint         # eslint
npm test             # vitest
npm run build        # bundle + service worker
```

There are no component or end-to-end tests, by choice. Hand verification in a real browser is the
only thing standing between a UI regression and production, so **anything user-visible is checked
in a browser before it is called done**, and the build hash in Settings is confirmed first — a
service worker will happily show you a build from twenty minutes ago.

If a step is skipped, say so out loud in the change description.

## Layering

Each layer may import only from the layers below it. `docs/baseline.md` has the full table and the
reason for each rule.

```
ui/         Svelte components. Holds no business logic
state/      Reactive state and the actions on it. Renders nothing
providers/  Swappable TTS and LLM backends. Must never touch data/ or ui/
data/       IndexedDB schema and repositories. The only layer that knows a database exists
content/    What a drill is: pool format, validation, rotation. Never touches storage
core/       Pure functions: phoneme audit, accents, SM-2, prompts. No DOM, storage or network
```

The seam that keeps `providers/` clean: it declares an interface (`ClipStore`) and `state/` injects
the `data/` implementation. A provider never imports a repository.

## Two traps this codebase has already fallen into

**Svelte 5 `$state` values are Proxies.** Neither `structuredClone` nor IndexedDB can clone one, and
the failure is a silent rejected promise. Every write through `data/` goes through `toPlain()` first.

**Schema changes are forever.** Bumping `DB_VERSION` adds one new `if (oldVersion < n)` block; it
never edits an existing one, because someone's browser is still on that version. Every bump gets a
test that builds a database at the previous version, opens it at the new one, and asserts the old
data survived.

## Conventions

- Provider audio is content-addressed: the cache key is `provider|text|model|voice|accent`. Persisting
  it is what makes a repeated sentence free across drills.
- User-facing copy lives in `src/ui/strings.ts`, never inline in a component.
- Components own their styles. `src/base.css` holds only `:root` tokens and bare-element rules,
  because custom properties must inherit from the root and element selectors cannot be scoped.
- A new dependency needs a one-line reason recorded in `docs/baseline.md`. Prefer the platform, then
  a few lines of our own code, then a dependency.

## Not in the repo

`thoughts/`, `.claude/` and `reference/` are gitignored working notes. Do not assume a teammate has
them.
