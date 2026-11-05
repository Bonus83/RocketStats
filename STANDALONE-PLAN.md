# RocketStats Desktop: implementation plan

## Goal and safety boundary

Provide a Windows desktop companion for people who do not own a Stream Deck.
The first release is a separate dashboard window, not an in-game overlay.
It reads the Rocket League Stats API only from loopback and reads the game log
in read-only mode for the existing verified-account/MMR behavior. It does not
read or write game memory, inject code, install drivers, hook graphics or input,
automate gameplay, or send commands to Rocket League.

No third-party application can promise that an anti-cheat will never flag it.
This plan reduces risk by keeping access local and read-only; it is not an Epic
or Psyonix approval or a guarantee against false positives or future changes.
Do not distribute a build as approved unless the relevant publisher confirms
the exact integration and build.

## Architecture

- **Electron + TypeScript:** reuse the current TypeScript state, identity,
  streak, rank-estimation, live-feed, and log-watcher modules.
- **Electron main process:** own the loopback TCP connection, read-only log
  watcher, persistence, and a narrow IPC interface.
- **Isolated renderer:** render only the dashboard. Context isolation,
  sandboxing, disabled Node integration, a restrictive CSP, and fixed IPC
  methods prevent the web UI from receiving general Node or filesystem access.
- **Shared domain logic, separate persistence:** keep the existing plugin
  behavior and schema, but use Electron's `userData` directory for the desktop
  state file so running both applications does not make them concurrently write
  the same JSON file.
- **Windows per-user installer:** bundle Electron and dependencies so recipients
  do not need Node.js, Stream Deck, or administrator rights.

## Delivery phases

### Phase 1 — Standalone MVP (implemented)

- Create the Electron shell and dashboard using the existing render models.
- Show live match, rank/MMR, streak/record, and player-stat cards.
- Provide win/loss scope and reset controls, locale selection, a configurable
  local Stats API port, and an explicit, game-closed Stats API setup action.
- Reuse automatic account identity and per-account stats, with the verified
  logged-in account taking precedence over a typed name.
- Keep all application state on the user's PC.
- Omit the Stream Deck HUD-control action and all game-control bridges.

### Phase 2 — Build and distribution (installer build verified)

- Build the TypeScript service and package a per-user Windows x64 NSIS installer.
- Include the local rank tables and rank artwork in the installer.
- Keep source and build prerequisites out of the recipient's install process.
- Verify the ASAR contents, shared service, and Windows x64 per-user installer
  build. Clean-profile first launch, settings persistence, and uninstall testing
  remain required before sharing a release.
- Decide on code signing before public distribution. Signing may help establish
  publisher identity; it is not an anti-cheat approval.
- GitHub release updater implemented with explicit download/install controls,
  optional periodic checking, error/progress UI and signed stable updates only.
  Update-source and publisher configuration, certificate setup and a live upgrade
  test are still outstanding. See [DESKTOP-RELEASES.md](./DESKTOP-RELEASES.md).

### Phase 3 — Pre-release validation (required before distributing broadly)

- Confirm current Rocket League/Epic rules for the exact Stats API and log access.
- Request written guidance from Epic/Psyonix if an anti-cheat compatibility
  assurance is required. Treat the absence of a reply as no guarantee.
- Test against supported game versions with Easy Anti-Cheat enabled; never disable
  or bypass it as a test strategy.
- Review privacy, retention, recovery, updater, signing, and uninstall behavior.
- Publish limitations, a clear version number, checksums, and a support channel.

### Phase 4 — Later features (not part of this first implementation)

- Improve display preferences and accessible dashboard layouts.
- Activate the implemented updater after configuring a signed GitHub release
  process and completing the live-release checks.
- Do not add an in-game overlay or any process/memory hooks without a separate
  safety and compatibility review.

## Current limitations

- The Stats API feed must be available on the configured loopback port. Setup is
  an explicit opt-in, Windows-only action that requires the game to be closed;
  it only updates the existing documented port/packet-rate settings and backs
  up the previous file.
- MMR remains based on the existing local log parser and its documented
  limitations; casual MMR, multi-playlist party attribution, and some queue
  details are not guaranteed by the source data.
- Rank divisions remain estimates derived from the bundled community table.
- Account data is stored separately from the Stream Deck plugin's state file.
- The project has not received an official anti-cheat compatibility approval.
- No GitHub release repository or signing publisher has been supplied, so update
  requests remain disabled in the default build. A local unsigned installer can
  still be built; configured update/release builds require code signing.

## Verification checklist

- `npm test` builds the shared TypeScript code and runs regression tests.
- `npm run desktop:dev` opens the desktop app from the development workspace.
- `npm run desktop:dist` produces the Windows x64 per-user installer.
- On a clean Windows profile, verify installation without admin privileges,
  startup without Node.js/Stream Deck installed, local feed disconnection and
  reconnection, all seven locales, scope/reset behavior, persistence, and
  uninstall. Verify the app does not change game files or launch with control
  bridges enabled.
