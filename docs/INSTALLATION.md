# Installation and account setup

## Windows desktop app

1. Download the latest `RocketStats-Desktop-*-Setup-x64.exe` from
   [GitHub Releases](https://github.com/Bonus83/RocketStats/releases).
2. Run the per-user installer. Administrator privileges and Node.js are not
   required.
3. Open RocketStats and use the configuration dialog to choose a language,
   local API port, and (if needed) configure Rocket League's local Stats API.
4. Close Rocket League before enabling or changing the game's Stats API
   configuration, then restart the game.

The installer is unsigned, so Windows SmartScreen may show a warning. Read the
[desktop release notes](../DESKTOP-RELEASES.md) for updater and signing details.

## Stream Deck

RocketStats provides Stream Deck actions and generated profiles. Development
installation steps are in [Development](DEVELOPMENT.md); restart Stream Deck
completely after installing or updating a development build.

## Local Stats API

RocketStats reads the game's local feed on `127.0.0.1`. The desktop configuration
dialog can set up the documented port and packet-rate settings after explicit
confirmation. The game must be closed. Existing configuration is backed up
before changes; RocketStats does not silently edit game files.

For manual development setup on Windows:

```powershell
npm run configure:stats-api
```

After starting Rocket League, verify the local feed with:

```powershell
npm run diagnose:stats
```

The diagnostic reports event names and counts only; it does not print player
names or IDs.

## Accounts and local data

- The verified account logged into Rocket League overrides a typed in-game
  name.
- Multiple platform accounts can be managed on one PC. Their MMR, rank,
  streaks, ban state, and records are kept separately.
- Selecting an account restores its saved statistics without re-entry.
- Account and match data stays on the PC. Desktop data is stored separately
  from the Stream Deck plugin's state.

Default state file locations:

- Windows: `%APPDATA%\RocketStatsElgato\state.json`
- macOS: `~/Library/Application Support/RocketStatsElgato/state.json`
- Linux: `${XDG_STATE_HOME:-~/.local/state}/RocketStatsElgato/state.json`

The desktop app and Stream Deck plugin do not synchronize account selections or
state files.
