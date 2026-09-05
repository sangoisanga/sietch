# Baseline

The rules this project is held to. Both sections are enforced on every change.

## Definition of done

A change is done when all of these are true. Not "mostly", not "the important ones".

1. `npm run typecheck` — clean (`tsc` and `svelte-check`)
2. `npm run lint` — clean
3. `npm test` — green
4. `npm run build` — succeeds
5. Non-trivial logic leaves **one runnable check** behind: a branch, a loop, a parser, a date calculation, anything touching stored user data. Trivial one-liners do not need a test.
6. Anything user-visible is verified in a real browser, and the **build hash in Settings is confirmed** before trusting what you see.

Rule 6 exists because this project has no component or end-to-end tests by choice. Hand verification is the only thing standing between a UI regression and production, and a service worker will happily show you a build from twenty minutes ago. Check the hash.

If a step is skipped, say so out loud in the change description. A silently skipped step is worse than a failing one.

## Module layout and dependency rules

| Layer | May import | Must never |
|---|---|---|
| `core/` | `core/` only | touch DOM, storage, or network |
| `content/` | `core/` | touch DOM or storage |
| `data/` | `core/`, `content/` | touch DOM |
| `providers/` | `core/` | touch `data/` or `ui/` |
| `state/` | `core/`, `content/`, `data/`, `providers/` | touch DOM |
| `ui/` | anything | hold business logic |

What each layer is for:

- **`core/`** — pure functions. Phoneme audit, accent inventories, ISO period keys, prompt building, text splitting. Testable with no environment at all. This is the part of the codebase that has survived two rewrites unchanged; keep it that way.
- **`content/`** — content shapes and the rules about them. Pool and pack types, the pool file format, validation, rotation. Knows what a drill *is*, never where it is stored.
- **`data/`** — persistence. IndexedDB schema, repositories, migrations. The only layer that knows a database exists.
- **`providers/`** — swappable outside services behind an interface. TTS and LLM today. Each is selected at runtime and must be replaceable by writing one new file.
- **`state/`** — the reactive application state and the derived values on top of it. Orchestrates the layers below; renders nothing.
- **`ui/`** — Svelte components. Reads state, calls actions, draws pixels. If a component contains a rule you could write a unit test for, that rule is in the wrong layer.

### Dependencies

A new dependency needs a one-line reason recorded below. "It is popular" is not a reason. Prefer the platform, then a few lines of our own code, then a dependency.

| Dependency | Reason |
|---|---|
| `svelte` | Fine-grained reactivity for derived state; compiles away, no runtime VDOM |
| `idb` | Promise wrapper over IndexedDB's callback API; ~1 kB, avoids hand-rolling transaction plumbing |
| `fake-indexeddb` | IndexedDB in the test environment, so `data/` is testable without a browser |
| `vite-plugin-pwa` | Service worker generation and the update-prompt hook; hand-rolling cache invalidation is where PWAs go wrong |

## Schema changes

Not a chosen rule, but the migration path is real and someone will need it:

- Persisted shapes carry a version: `DB_VERSION` in `src/data/db.ts`, `schema` in a pool file.
- Bumping `DB_VERSION` adds one `if (oldVersion < n)` block to `upgrade`, never an edit to an existing block — someone's browser is still on that version. (A `switch` cannot be used here: version steps need fall-through, which `noFallthroughCasesInSwitch` forbids.)
- Every bump gets a test that builds a database at the previous version, opens it at the new one, and asserts the old data survived.
- An unknown pool `schema` fails with the version in the error message, so an old app tells the user what is wrong instead of reporting a shape error.
