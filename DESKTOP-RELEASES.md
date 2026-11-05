# Desktop updates with GitHub Releases

## What users see

Configured, installed Windows builds check once at startup and every six hours
while open. Users can turn automatic checking off or check manually.
Downloads and installation each require a user action. A downloaded update is
**not** installed just because the user closes the app.

The updater accepts stable, newer versions only and checks the downloaded
installer against the SHA-512 checksum in the release metadata. With the current
configuration it does **not** verify the publisher's signature. The dashboard
and installation confirmation disclose this. Installation requires Rocket
League to be closed. Before invoking the installer, the desktop service stops
its readers, drains pending log work and persists its local state. The installer
restarts RocketStats; account data stays in the user-data directory.

Update errors and download progress appear in the dashboard in all seven
languages. No remote release HTML or JavaScript is loaded into the renderer.

## Project-only GitHub CLI account

This project uses its own GitHub account for the CLI, separate from the account
signed in to VS Code. Always call GitHub CLI through the wrapper:

```powershell
.\scripts\gh.ps1 auth status
.\scripts\gh.ps1 release list --repo OWNER/REPO
```

The wrapper sets `GH_CONFIG_DIR` to `%LOCALAPPDATA%\RocketStatsElgato\gh`; the
token itself stays in the Windows Credential Manager, never in this folder.
Do not run `gh auth setup-git` globally. In a checkout, configure the Git
credential helper locally; this does not change VS Code or global Git settings:

```powershell
git config --local credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper '!powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/gh.ps1 auth git-credential'
```

## Configure the source before the first distributable build

1. Use the configured **public GitHub release repository** at
   `Bonus83/RocketStats`. GitHub Releases serve the binary update metadata and
   assets; this repository may also contain the source code.
2. The checked-in [desktop/update-config.json](./desktop/update-config.json)
   selects this repository without requiring a signing certificate:

   ```json
   {
     "owner": "Bonus83",
     "repo": "RocketStats",
     "publisherNames": []
   }
   ```

3. Optionally, configure an Authenticode certificate in the secure build
   environment and add its exact publisher name to `publisherNames`. Nonempty
   publisher names force code signing and enable publisher-signature
   verification. Plan certificate rotation with a release signed by an already
   trusted publisher. Never commit a certificate, private key, password or token.
4. Build and manually install the configured version once. Earlier builds with
   an unconfigured updater cannot discover it.

The public updater needs **no GitHub login or client token**. Do not embed a PAT
in the application for a private repository. Use a public binary-release
repository or design a separately authenticated distribution service instead.

## Build and publish each version

1. Increment the desktop package version, for example:

   ```powershell
   npm version patch --no-git-tag-version
   npm test
   npm run desktop:release
   ```

2. The release build requires a configured public source but not a certificate.
   With an empty `publisherNames` list it builds without publisher-signature
   verification. If publisher names are configured, missing signing credentials
   must fail the build; keep signing credentials in the builder environment.
3. Create a GitHub Release tagged `v<package version>`, such as `v0.1.1`. Upload
   the generated artifacts from `release` together:
   - the `RocketStats-Desktop-<version>-Setup-x64.exe` installer;
   - its `.exe.blockmap`;
   - `latest.yml`.
4. Publish as a normal release, **not a draft or prerelease**. All three assets
   must belong to the same build and version. Do not edit the generated checksum
   or replace assets with files from another build.
5. Test upgrading the previous version on a Windows test machine before
   recommending the release to friends.

Both build commands use `publish: never`: neither uploads code nor creates or
publishes releases. Uploads are a separate deliberate maintainer operation.
`desktop:dist` can build an unsigned installer with the configured update
source. If the source is entirely empty, it builds a local installer without
updates; `desktop:release` requires a source. The Stream Deck SDK is excluded from
the desktop package; the updater and its runtime dependencies are included.

## Trust and privacy

HTTPS plus a checksum detects corruption, but a checksum next to a compromised
installer is not proof of its publisher. In the current configuration anyone
who can compromise the GitHub release repository can publish a malicious
update. Protect the GitHub account with two-factor authentication and limit
release permissions. No independent cryptographic update signature is
implemented. Optional Windows code signing adds publisher verification, but
does **not** constitute an Epic/Psyonix or anti-cheat approval.

Automatic checking introduces outbound requests to GitHub and its release/CDN
infrastructure. GitHub receives normal request metadata, such as the client's
IP address. No Rocket League log, account ID, player name, MMR or match statistics
are attached to update requests. The renderer still has no direct network access.

## Required live-release checks

Unit tests cover configuration validation, no-source/development gating,
available/current/offline states, consent and progress, simulated checksum
failure, persistence gating and seven-language UI controls. They do not replace
a real release upgrade test.

Before distribution, verify on a clean Windows profile:

- install version A manually, then update to a higher version B;
- a checksum mismatch refuses installation;
- if publisher verification is configured, a publisher mismatch refuses installation;
- an offline check is visible and retryable;
- no download or installation occurs without consent;
- closing the app alone never installs a downloaded update;
- a running game blocks installation and a closed game allows retry;
- account statistics, scope and settings survive the update.

A real GitHub release and live upgrade test remain outstanding. The generated
installer executable is also subject to this environment's organization
content-exclusion policy; do not bypass that restriction to inspect or execute it.
