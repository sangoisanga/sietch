# Deploying

## Cloudflare Pages

Connect the repo, then set:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | from `.nvmrc` (22) |
| Production branch | `v2` until it replaces `main` |

`npm run build` regenerates the starter pool and the icons before compiling, so the
shipped pool always matches `content/packs/`.

Nothing else needs configuring. `base: './'` in `vite.config.ts` already produces
relative asset URLs, and `public/_headers` tells Cloudflare not to cache `sw.js`,
`index.html` or the manifest — without that, an installed app can never see an update.

The build hash shown in Settings comes from `CF_PAGES_COMMIT_SHA` in CI and from
`git rev-parse` locally.

## Verifying a deploy

The definition of done requires confirming the build hash. In practice:

1. Open the app, then Settings, and read the `Build …` line at the bottom.
2. If it does not match the commit you just deployed, you are looking at a cached
   build. Wait for the "New version ready" bar and reload.

## Local production check

```
npm run build
npm run preview
```

To confirm offline behaviour, load `http://localhost:4173`, stop the preview server,
and reload. The app should boot, show today's drill, and play through the browser voice.
