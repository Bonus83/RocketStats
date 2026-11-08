# Development

## Requirements and checks

Use Node.js 24 or newer. From the repository root:

```powershell
npm ci
npm run assets
npm run build
npm test
```

For focused work:

```powershell
npm run dev:affected
npm run dev:verify
npm run dev:check
node scripts/dev.mjs test ui update
```

Test groups include `ui`, `update`, `service`, `core`, and `all`.

## Project layout

- `src/core/` — account state, streaks, records, rank estimates.
- `src/connector/` — local Stats API and log watchers.
- `src/runtime/` — live runtime and rendering context.
- `src/render/` — Stream Deck action renderers.
- `src/streamdeck/` — Stream Deck SDK action and settings wiring.
- `src/desktop/` and `desktop/` — desktop service, Electron shell, and UI.
- `com.rocketstats.livestats.sdPlugin/` — plugin manifest, profiles, and data.
- `test/` — regression tests.

`npm run assets` regenerates button images and device profile bundles from the
asset catalogs. Compiled TypeScript output goes to
`com.rocketstats.livestats.sdPlugin/bin`.

## Local Stream Deck development

Build the plugin and create a junction in the Stream Deck plugin folder if it
does not already exist:

```powershell
npm run build
New-Item -ItemType Junction `
  -Path "$env:APPDATA\Elgato\StreamDeck\Plugins\com.rocketstats.livestats.sdPlugin" `
  -Target (Join-Path (Get-Location) "com.rocketstats.livestats.sdPlugin")
```

Restart Stream Deck completely, including its notification-area process. The
development link depends on this repository and its installed dependencies
remaining in place.

## Desktop development and packaging

```powershell
npm run desktop:dev
npm run desktop:dist
```

The per-user Windows installer is written to `release\`. It bundles Electron;
recipients do not need Node.js or administrator privileges. See
[desktop release notes](../DESKTOP-RELEASES.md) before publishing.

## Runtime configuration

Optional environment variables must be present when the Stream Deck
application launches the plugin:

| Variable | Values | Default |
| --- | --- | --- |
| `ROCKETSTATS_LOCALE` | `de`, `en`, `pl`, `fr`, `es`, `pt`, `ru` | `en` |
| `ROCKETSTATS_MMR_PLAYLIST` | `auto` or playlist key | `auto` |
| `ROCKETSTATS_EVENT_STATS` | Three comma-separated event stats | `goals,assists,saves` |
| `ROCKETSTATS_ANIMATE_EVENTS` | `true` or `false` | `true` |
| `RL_LOG_PATH` | Path to Rocket League `Launch.log` | Platform default where available |

Per-action display preferences are stored by the Stream Deck Property
Inspector. Local API and control ports are plugin-wide settings restricted to
loopback.
