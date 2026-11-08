# RocketStats Elgato Plugin (Foundation)

This repository now contains the first implementation slice for a Rocket League Stream Deck plugin:

- Stream Deck plugin manifest scaffold
- Core state architecture for multi-account separation
- Identity precedence logic (live account beats manual name)
- Local platform-ID discovery, multiple managed accounts, and match-by-match
  candidate statistics while the local account is unknown
- Optional exact-name player fallback for feeds without a local-player marker
- Streak engine with early-leave provisional losses and ranked reconnect correction
- Win/loss scope key: streak and records (longest win/loss run) show either all
  matches or only the current (last loaded) mode; the choice is saved
- Win/loss reset key: hold for 2 seconds to reset streak and records of the active
  account for the current scope (MMR is kept). Both keys use generated artwork
  until logos are appended to the logo sheet
- Statistics period (desktop app): W/L counts, streak and records can show the
  current session, everything since the last reset, or all time (including reset
  matches). On start, the app asks whether to continue the previous session or start
  a new one (only if it contains matches); "New session" starts one at any time.
  Period and session start are saved; the Stream Deck plugin uses the saved period
- Rank key: shows the icon, colour-matched rank name, tier and estimated division of the current mode
  (estimated from the stored MMR; icons are cut from `assets/ranks/rank-sheet.png` per
  `assets/ranks/catalog.json`). Ambiguous or missing division data shows `DIV ?`.
  Unknown MMR and modes without a table show the unranked icon with `---`
- MMR + Win/Loss key: one card with mode, MMR and the wins/losses of the current
  scope (respects the scope toggle and resets). Compact device profiles use it instead
  of the plain MMR key
- Last Goal key: continuously shows the latest goal scorer and shot speed in a
  dedicated card, separate from the animated event banner
- Serialized atomic persistence for overlapping live updates
- Stream Deck Property Inspector for per-action display options and plugin-wide local ports
- Automated tests for the core critical rules
- TCP live connector for local Rocket League payload streaming
- Action renderers for score, timer, boost, event banner, and dedicated last-goal card
- Stream Deck SDK action wiring with live title updates per visible action
- Per-action Property Inspector settings for language, MMR playlist, selected event stats, and banner animation
- Matchmaking and account enrichment (queue status, ban countdown, MMR summary hooks)
- Localized live-stat, event, and status labels in DE/EN/PL/FR/ES/PT/RU
- Optional local control bridge for the HUD toggle action
- Generated PNG action icons and auto-install profiles for Stream Deck, Mini, XL, +, Neo, and Studio

## Current structure

- `com.rocketstats.livestats.sdPlugin/manifest.json` plugin metadata and actions.
- `src/core/` domain logic modules.
- `src/connector/` live local API connector.
- `src/render/` action render formatting.
- `src/runtime/` runtime loop and sink abstraction.
- `src/streamdeck/` action classes and render bus for real Stream Deck contexts.
- `src/desktop/` shared runtime entry for the standalone dashboard.
- `desktop/` isolated Electron shell and local dashboard UI.
- `scripts/generate-assets.mjs` regenerates action icons and device profile archives.
- `scripts/configure-rl-stats-api.mjs` configures the game's local Stats API on explicit request.
- `scripts/diagnose-stats-api.mjs` checks the local feed without logging player data.
- `src/index.ts` plugin bootstrap entry.
- `test/` regression tests for core logic, assets, and profile references.

## Local development

```powershell
npm install
npm run assets
npm run build
npm test
```

For small changes, use the targeted helpers instead of the full build and suite:

```powershell
npm run dev:affected   # changed files and the tests that cover them
npm run dev:verify     # type-check (only if src\ changed) + affected tests
npm run dev:check      # type-check the desktop graph and Stream Deck account bridge
node scripts/dev.mjs test ui update   # groups: ui, update, service, core, all
```

| Area | Files | Test group |
| --- | --- | --- |
| Desktop main process, IPC, process checks | `desktop/main.cjs` | `ui` |
| Connection status and warning filter | `desktop/connection-state.cjs` | `ui` |
| Desktop UI and texts in 7 languages | `desktop/renderer.js` | `ui`, `update` |
| Stream Deck settings and account picker | `com.rocketstats.livestats.sdPlugin/ui`, `src/streamdeck/platform-settings.ts` | `ui`, `core` |
| Update flow | `desktop/updater.cjs` | `update` |
| Desktop service | `src/desktop/desktop-service.ts` | `service` |
| Live feed, stats and accounts | `src/runtime`, `src/connector`, `src/core` | `core`, `service` |

`npm run assets` crops the append-only logo sheet in `assets\logos` into the
button images referenced by the plugin manifest, and creates the `.streamDeckProfile`
bundles. New cards are detected from the transparent gutters and assigned in
row-major order; append the matching action entry to `catalog.json`. Compiled output goes to
`com.rocketstats.livestats.sdPlugin/bin`.

Per-account data stays on this PC. The state file is stored in
`%APPDATA%\RocketStatsElgato\state.json` on Windows,
`~/Library/Application Support/RocketStatsElgato/state.json` on macOS, and
`${XDG_STATE_HOME:-~/.local/state}/RocketStatsElgato/state.json` on Linux.

## Platform accounts and candidate matches

The desktop account panel and the Stream Deck Property Inspector list observed
`PrimaryId` values, player names, and the number of distinct observed matches.
Add an ID in the form `Steam|ID|0` or `Epic|ID|0`, select an observed ID as your
account, or keep several IDs in the account list. Removing an ID from the list
does not delete its match history. A verified primary login or local-player
marker always overrides an unverified selection or typed name. A selected ID is
used for a live match only when that ID occurs exactly once in its player list.

While the local account is uncertain, the application retains each observed
player's ID, name, team, individual match stats, mode and result locally. This
includes teammates and opponents; no player data is sent to an online tracker.
On selection, unresolved matches containing that ID are assigned to it, and
its W/L, streak, personal records and available solo MMR history are restored.
Matches already assigned to another account are not silently copied. Candidate
observations remain locally available after selection so that an automatic
attribution can be corrected; removing a managed ID does not erase them.

Candidate suggestions intersect the players seen across different matches.
Automatic selection happens only when at least two completed matches with
stable match GUIDs and at least two distinct valid player IDs share exactly one
candidate. Repeated snapshots of one match are not additional matches. A single
solo match is not conclusive because its opponents are present too, and even a
repeated candidate can be a teammate or opponent. Automatic selection is shown
as **unverified**; use **Correct automatic attribution** if it is wrong.
Correction only reassigns automatically attributed matches where the chosen ID
was actually observed; other matches remain unresolved. Existing W/L reset
markers are preserved when a match is reassigned.

If a match does not expose a GUID, a locally generated ID preserves its
observations but cannot establish automatic identity. Without a stable GUID,
the same ongoing match cannot be reliably deduplicated across application
restarts. Existing match history from before RocketStats was recording is not
reconstructed.

To configure the game's local Stats API, close Rocket League and run:

```powershell
npm run configure:stats-api
```

The script updates only the `[TAGame.MatchStatsExporter_TA]` port and packet
rate values in the Rocket League `TAStatsAPI.ini` under the Windows Documents
folder, including when that folder is redirected to OneDrive.
It creates a timestamped backup before changing an existing file, refuses to
edit while `RocketLeague.exe` is running, and never runs automatically with the
plugin. To select a non-default configuration location, run the script directly:
`node scripts/configure-rl-stats-api.mjs --config "C:\path\TAStatsAPI.ini"`.

After starting Rocket League, verify that the feed is emitting events:

```powershell
npm run diagnose:stats
```

The diagnostic prints event names and counts only; it does not print player
names or IDs. `--port` and `--duration-ms` can be used to override its defaults.
For example:

```powershell
node scripts/diagnose-stats-api.mjs --port 49123 --duration-ms 1000
```

For local testing on Windows, build the plugin and link it into the Stream Deck
plugin directory (create the junction only if it does not already exist):

```powershell
npm run build
New-Item -ItemType Junction `
  -Path "$env:APPDATA\Elgato\StreamDeck\Plugins\com.rocketstats.livestats.sdPlugin" `
  -Target (Join-Path (Get-Location) "com.rocketstats.livestats.sdPlugin")
```

Restart the Stream Deck application completely, including its notification-area
process. Stream Deck launches the plugin automatically; add actions from the
Rocket League category to a device. This development link relies on the project
directory and its installed dependencies remaining in place.

Optional runtime environment variables must be present in the Stream Deck
application's environment when it launches the plugin:

- `ROCKETSTATS_LOCALE` = `de|en|pl|fr|es|pt|ru` (default: `en`)
- `ROCKETSTATS_MMR_PLAYLIST` = `auto` (default), or a fixed playlist key for MMR actions
- `ROCKETSTATS_EVENT_STATS` = comma-separated 3 stats for event banner (default: `goals,assists,saves`)
- `ROCKETSTATS_ANIMATE_EVENTS` = `true|false` event banner animation prefix
- `RL_LOG_PATH` = optional path to Rocket League's `Launch.log` (Windows uses the default Documents path)

The action Property Inspector stores these display choices on each Stream Deck
action instance. MMR defaults to the last loaded mode for the active account;
selecting a specific playlist fixes that key on the chosen mode instead.
Older playlist settings without an explicit manual-selection marker are
migrated to automatic mode, including keys from earlier generated profiles.
Event-stat/animation preferences are also applied independently per key. Stats
and control ports are plugin-wide settings shared by all action instances, and
connections are restricted to `127.0.0.1`.

## Standalone Desktop app

The desktop companion reuses the TypeScript live runtime and account/statistics
logic, but does not require Stream Deck. It is a separate dashboard window with
an isolated renderer; it does not inject an in-game overlay, read or write game
memory, install drivers, automate inputs, or use the optional HUD-control bridge.
The desktop dashboard shows rank, MMR, win/loss, streaks, records and matchmaking
bans. Live match and player-stat cards (including boost, goals, timer, score,
queue, speed and possession) are not displayed. The local feed still supports
account statistics and record tracking; Stream Deck actions are unchanged.

Below the cards, an MMR history graph shows how the rating developed. History is
stored per account and per mode (`rankByPlaylist[].history` in `state.json`, up
to 500 changes per mode); pick the mode in the dropdown. Points are added only
when the MMR value changes.

For development:

```powershell
npm run desktop:dev
```

To create a per-user Windows x64 installer:

```powershell
npm run desktop:dist
```

The installer is written to `release\`. It bundles Electron, so recipients do
not need Node.js or administrator privileges. The desktop app stores its account
state separately from the Stream Deck plugin's state to avoid concurrent writes.
Account selections and candidate histories are therefore managed separately in
the desktop panel and in the plugin's Property Inspector; they are not synced
between the two stores.
It supports the same seven languages and lets users configure the local Stats
API port. The Stats API feed must be available on that port. An explicit setup
button can enable the local feed after confirmation, only while Rocket League is
closed; it changes only the Stats API port and packet-rate settings and backs up
an existing config file. The app does not silently edit Rocket League
configuration.
If Rocket League is not running on Windows, an expected connection refusal is
not shown as an error; the dashboard still shows that the feed is disconnected
and retries automatically. Connection errors remain visible when the game is
running or its process status cannot be checked. Once connected, the dashboard
clears the connection error without hiding unrelated setup or runtime errors.
Live MMR still depends on the existing local log parser and its documented
limitations.

The desktop updater uses stable GitHub Releases from `Bonus83/RocketStats`.
Installed builds check at startup and every six hours (can be disabled);
the result appears in an in-app balloon, and the menu provides a manual check,
status and the automatic-check setting. Downloading and installing each require
consent. Rocket League can stay open during installation. If a match is active,
or its status cannot be determined, the confirmation warns that match events or
the result may be missed during the RocketStats restart. Local state is persisted
before restarting. No update is installed merely by closing the app.
An API connection alone does not establish the match status: missing or
more-than-15-second-old match observations are treated as unknown while the
game is running, or if its process status cannot be checked.
Development builds do not check for updates.

A Windows signing certificate is optional. The current configuration does not
verify an update publisher's signature: HTTPS and the checksum in GitHub's
release metadata do not protect against a compromised release repository. The
app does not show a separate signature warning; Windows may display a SmartScreen
warning for an unsigned installer. See
[DESKTOP-RELEASES.md](./DESKTOP-RELEASES.md) for the trust limitations, optional
signing, versioning and required release assets. Existing builds with an
unconfigured updater need a manual install of the new version first. No GitHub
token belongs in the client. Update checks send normal HTTPS request metadata to
GitHub, but no game or account data.

The game-data integration is limited to a read-only loopback feed and read-only
log access, but cannot guarantee that an anti-cheat system will never flag a third-party
application. The project has no Epic/Psyonix approval. Review
[STANDALONE-PLAN.md](./STANDALONE-PLAN.md) before distributing builds; it lists
the safety boundaries and the pre-release compatibility checks still required.

When enabled, the event-banner title pulses its marker for about 1.5 seconds
once per new goal or recognized gameplay event. Disabling animation leaves the
banner static.

## Live-feed protocol status

The connector reads Rocket League Stats API events from `127.0.0.1:49123`.
The TCP stream contains consecutive JSON objects without line delimiters; the
connector frames objects across arbitrary TCP chunks and also accepts the
legacy newline-delimited snapshot format for local adapters. Event data may be
either a JSON object or a JSON-encoded string.

The adapter currently normalizes match state, team scores, clock/overtime,
goals, statfeed demos/saves, crossbar hits, pause state, and match results.
An active match destroyed without a preceding result is recorded as a
provisional early-leave loss; a result received later for the same match ID
replaces that provisional outcome and recalculates current/longest streaks from
the corrected match history. When `Game.PlaylistId` is present, the connector
uses it to identify the loaded playlist; availability in every Rocket League
version is not guaranteed. MMR, playlist matchmaking, and ban timers are not
exposed by these normalized Stats API events.

## Ranked MMR and playlist source

The Stats API itself does not publish MMR. On Windows, the plugin additionally
watches Rocket League's local
`TAGame\Logs\Launch.log` in the Windows Documents folder in read-only mode,
including when Documents is redirected. It tails new queue events instead of
replaying old MMR samples. Set `RL_LOG_PATH` if the game uses a different
location. On macOS, set this variable to the log path explicitly.

The primary logged-in account can be identified from the game's login event and
matched to `PrimaryId` in the Stats API. If the plugin starts while Rocket
League is already running on Windows, it recovers only the primary login event
from the current log after checking the game process start time and log
modification time; it does not replay old reservations. This startup recovery
is Windows-only. A verified local-player marker also identifies the player.
Neither the camera target nor the first player in the list is treated as the
logged-in account.

The MMR key shows the mode and its stored value for the active account.
Searching, returning to the menu, and ending a match do not change the selected
mode. A new selection is saved only once a recognized mode has loaded and its
account is confirmed. `Game.PlaylistId`, when present, takes precedence over the
reserved playlist; otherwise a matching log reservation is used after a new
match loads. Match GUIDs in both sources can also correlate delayed log events.
The log alone is also sufficient: once a solo reservation is followed by the
server map load and its `MatchGUID` for the same primary login, that mode and
its MMR are stored even if the Stats API has not confirmed the match.
Missing or unrecognized mode data leaves the last confirmed mode, MMR and rank
visible; match results for an unrecognized mode are still recorded as unknown.
A newly recognized mode without a saved MMR shows `---` instead of another
mode's rank. Older selections overwritten with `unknown` can be recovered
from the account's latest recorded match or MMR history, or from its only
stored MMR mode. If no unambiguous evidence exists, the mode remains unknown
until a recognized one is loaded.

For solo ranked queues, the game log contains the pre-match skill value and
the reserved playlist. The plugin recognizes 1v1, 2v2, 3v3, 4v4 Quads, Hoops, Rumble,
Dropshot, Snow Day, and Heatseeker playlist IDs, and converts the
observed skill value to MMR using the community-observed formula `skill × 20 +
100` (see [community log-format research](https://github.com/deddroid/local-rocket-stats)).
This conversion is not documented by Psyonix. Party queues and queues
searching multiple playlists are excluded from MMR updates because the log
does not reliably identify the local player's MMR in those cases. The queued
sample is held briefly and saved only for a matching loaded playlist and a
confirmed local account or an explicitly configured, unique manual-name match.
If the platform ID is still unknown, the solo sample is kept with the observed
match and attributed after an explicit selection or an unverified unique
multi-match inference; a correction can undo that tentative attribution.
Conflicting account or playlist signals do not update the MMR.

Rank and division estimates use the separately maintained Tracker Network tables
described below, including tables for the supported extra modes and tournaments.

The sampled value appears when the next match is loaded and reflects the
rating after the preceding match; the rating change from the final match of a
session is not available until the next queue. This local source does not
provide Casual MMR, matchmaking search duration, or ban countdowns. The full
game log is not copied, printed, or sent anywhere; extracted account IDs,
playlist selections, and MMR values are persisted locally.

The Property Inspector's account fallback can select a player only when exactly
one name matches the configured in-game name and no verified account is
available. This is explicitly a manual, unverified fallback: its `PrimaryId`
is not promoted to a live account ID. A verified game account takes precedence.

The HUD toggle action and its optional control port (`49124`) still require a
separate compatible local bridge; that command is not part of the read-only
Stats API.

## Rank and division tables

[The local table](com.rocketstats.livestats.sdPlugin/data/rank-distributions.json)
contains the inclusive MMR ranges listed by
[Tracker Network](https://rocketleague.tracker.network/rocket-league/distribution?playlist=11),
with capture time and a source URL for each playlist: 1v1 (10), 2v2 (11), 3v3 (13),
4v4 Quads (61), Hoops (27), Rumble (28), Dropshot (29), Snow Day (30),
Heatseeker (63), and tournaments (34).
No player profiles are queried, and no web connection is needed while playing.

These are community-listed ranges, not official promotion/demotion thresholds.
The plugin rounds MMR to the displayed integer and estimates the tier using the
lowest listed interval for each rank. If a playlist has no listed interval for a
tier, that tier cannot be estimated. The plugin uses the listed division when
exactly one ranked interval contains the rating and belongs to the estimated
tier. Where intervals overlap or have gaps, it can also estimate a division
using the first division whose upper bound is at least the rating, provided all
four ranges are present and their upper bounds strictly increase. Such a
fallback is marked with `~`, for example `DIV ~3`. It is only an approximation:
the Stats API does not expose the real division, and promotion/demotion buffers
can make the game's displayed division differ. When a fallback is needed but
the ranges are incomplete, unordered, or the rating is outside their extent,
the key shows `DIV ?`. Ratings above the highest tier with listed ranges are
left unestimated unless SSL itself has a listed range. The Unranked row is
retained as source data but excluded from estimates, and SSL has no division.

To update the data when ranges change:

1. Select each playlist on the website and verify the selected playlist name.
   The initial HTML currently ignores the `playlist` query parameter and shows
   1v1 even for a 2v2 URL; do not copy that same table into every playlist.
2. Replace the relevant `ranks` rows in the local JSON. Each row has four cells in
   Division I-IV order, each an inclusive `[minimum, maximum]` pair or `null` when
   the source lists no range. Keep listed overlaps and gaps unchanged.
3. Update `capturedAt` and retain the correct playlist ID and source URL.
4. Review the snapshot-specific regression expectations when deliberately changing
   captured values, run `npm test`, and restart Stream Deck completely. Editing the installed JSON
   requires no rebuild; stored MMR is re-evaluated with the new table rather than
   trusting previously saved rank estimates. Invalid tables fail explicitly.

## Implemented requirements

- Per-account persistence and local multi-match platform-ID candidates are established.
- Active logged-in game account has strict priority over typed fallback names.
- Streak logic:
  - tracks current run only (`win` or `loss`)
  - persists across restarts through local state storage
  - early leave counts as immediate provisional loss
  - ranked reconnect final result replaces provisional loss
  - live connector ingests official concatenated Stats API event objects over TCP
  - key models are rendered for score/timer/boost/event banner output
  - render bus updates real Stream Deck action titles for:
    - score, timer, boost, last-goal banner
    - streak, mmr
    - queue status, ban countdown
    - speed, ping, possession
    - goals, assists, saves, shots, demos, flip resets, touches, player score
    - hud toggle control action (sends local toggle command)

## User-provided button artwork

The original [logo sheet](assets/logos/button-logos.png) is preserved unchanged
outside the generated plugin assets. It contains 21 complete button cards on a
768 x 768 transparent PNG: dark navy backgrounds, diagonal accents, rounded
purple/cyan borders, and pale cyan/white symbols near the top.
The [logo catalog](assets/logos/catalog.json) records each visible motif, its
stable action ID, and its one-based row/column position. Action assignments follow
the previously agreed order, not labels embedded in the image.

The sheet is append-only: keep existing IDs, indices, artwork scale, and pixel
positions unchanged. Add logo 22 at row 5, column 2, fill that row, then append
rows below by extending the canvas. The current column widths are not uniform;
do not crop this sheet by dividing its width into five equal parts.
The original is archived only; cropping and integration into generated plugin
assets are separate work.

## Remaining implementation slices

1. Validate payload fields and match lifecycle against a real Rocket League
   session using `npm run diagnose:stats`; the diagnostic cannot verify player
   ownership from event names alone. The score key now has a split blue/orange
   background; verify the visual result on hardware. Score numbers remain title
   text, and the colors are fixed rather than read from the live team payload.
2. Verify profile installation and action rendering on physical Stream Deck
   devices; the generated bundles configure keypad actions only (no dial,
   touch-strip, or Neo Infobar layouts yet).
3. Configure and validate Stream Deck + touch-strip and Neo Infobar layouts on
   hardware.
4. Validate the local ranked MMR and playlist interpretation against a real
   Rocket League session; Casual MMR, matchmaking search details, and ban
   countdowns still need a separate supported source.
5. Add and verify profile switching and HUD control bridge integration.
