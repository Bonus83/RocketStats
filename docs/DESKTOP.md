# Standalone desktop app

The Windows desktop companion reuses RocketStats' live runtime and account
logic. It is a dashboard, not an in-game overlay.

## Dashboard

The dashboard shows account selection, rank, MMR, win/loss counts, streaks,
records, ban state, and MMR history. The history is stored separately for each
account and playlist, with up to 500 points per playlist. Select a mode in the
chart menu; hover or keyboard-focus a point for its MMR, change, and date.

Language, local API port, and Stats API setup are in the configuration dialog.
Statistics scope, period, session, and reset controls remain on the dashboard.
The desktop app stores account state separately from the Stream Deck plugin to
prevent concurrent writes.

## Updates

Installed builds check GitHub Releases at startup and every six hours unless
automatic checks are disabled. The menu also provides a manual check.
Downloading and installing each require confirmation; updates are not installed
automatically. RocketStats saves local state before restarting for an update.
If a match is active or its status is unknown, the confirmation warns that
events or the result might be missed during restart.

Update checks contact GitHub but do not transmit game or account data.
Development builds do not check for updates. Publisher-signature verification
is not configured; HTTPS and release checksums do not protect against a
compromised release repository.

## Safety and limitations

The desktop app does not read or write game memory, inject code, install
drivers, hook graphics or input, or automate gameplay. It reads the local
Stats API feed and the game log in read-only mode. This reduces risk but does
not guarantee that an anti-cheat system will never flag a third-party
application. RocketStats has no Epic or Psyonix approval.

See the [standalone safety plan](../STANDALONE-PLAN.md) and
[release notes](../DESKTOP-RELEASES.md) for additional limitations, signing,
and release checks.
