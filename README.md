# RocketStats

RocketStats is a local Rocket League statistics companion for Elgato Stream Deck
and Windows desktop. It tracks account-specific rank/MMR, streaks and records
from Rocket League's local Stats API and game log.

> RocketStats is an independent community project. It is not affiliated with or
> endorsed by Psyonix, Epic Games or Elgato.

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Support](#support)
- [License](#license)

## Features

- Separate statistics for multiple game accounts on one PC.
- The verified account logged into Rocket League takes precedence over a typed name.
- Persistent win/loss streaks, longest-streak records, rank and available MMR history.
- Stream Deck actions and a standalone Windows desktop dashboard.
- Local-first data handling: game and account data stays on your PC. Update checks
  contact GitHub but do not send game or account data.

## Getting started

- **Desktop:** download the Windows installer from
  [GitHub Releases](https://github.com/Bonus83/RocketStats/releases) and follow
  the [installation guide](docs/INSTALLATION.md).
- **Stream Deck:** see the [Stream Deck setup and development guide](docs/DEVELOPMENT.md).

Rocket League's local Stats API must be enabled for live match data. RocketStats
can configure it after confirmation; Rocket League must be closed during setup.

## Documentation

See the [documentation index](docs/README.md):

- [Installation and account setup](docs/INSTALLATION.md)
- [Desktop app](docs/DESKTOP.md)
- [MMR, rank estimates and data sources](docs/MMR-AND-RANKS.md)
- [Development and testing](docs/DEVELOPMENT.md)
- [Desktop release and updater notes](DESKTOP-RELEASES.md)
- [Desktop safety plan and limitations](STANDALONE-PLAN.md)

## Support

Issues are welcome via [GitHub Issues](https://github.com/Bonus83/RocketStats/issues).
Pull requests are not accepted; see [Contributing](CONTRIBUTING.md). GitHub does
not provide a reliable way to prevent PR submissions to a public repository, so
unrequested PRs may be closed without review.

## License

The source is publicly visible but is **not open-source software**. Source code
and project assets are covered by the [source-viewing license](LICENSE); official
release binaries may be downloaded and used under the
[End User License Agreement](EULA.md).

Public GitHub repositories may be viewed and forked under
[GitHub's Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#d-4-license-grant-to-other-users).
The project license cannot disable those platform permissions or technically
prevent copying.
