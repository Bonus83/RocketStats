# Desktop updates with GitHub Releases

## What users see

Configured, installed Windows builds check once at startup and every six hours
while open. Users can turn automatic checking off or check manually.
Downloads and installation each require a user action. A downloaded update is
**not** installed just because the user closes the app.

The updater accepts stable, newer versions only. It delegates SHA-512 integrity
and Windows publisher-signature verification to `electron-updater`. Installation
requires Rocket League to be closed. Before invoking the installer, the desktop
service stops its readers, drains pending log work and persists its local state.
The installer restarts RocketStats; account data stays in the user-data directory.

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
2. Obtain a Windows Authenticode signing certificate and configure signing in
   the secure build environment using electron-builder's signing options.
   Never commit a certificate, private key, password, or token.
3. Fill in [desktop/update-config.json](./desktop/update-config.json):

   ```json
   {
     "owner": "<your GitHub owner>",
     "repo": "<your public release repository>",
     "publisherNames": ["<exact certificate publisher name>"]
   }
   ```

   These placeholders are documentation only. Replace them with real values.
   The publisher name must match the signing certificate exactly. Certificate
   rotation must be planned with a release signed by an already trusted
   publisher; do not disable verification to work around a mismatch.
4. Build and manually install this configured, signed version once. Earlier
   versions without the updater, or with an empty source, cannot discover it.

The release repository is configured, but the signing publisher is intentionally
empty until a real code-signing certificate is selected. In this state the
dashboard reports that automatic updates are unavailable, makes no update
requests, and refuses release builds. Local unsigned builds remain available.

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

2. The release build requires the source and signing publishers above, forces
   code signing, enables publisher-signature verification and generates GitHub
   update metadata. Missing signing credentials must fail the build, not create
   an unsigned update. Signing credentials remain in the builder environment.
3. Create a GitHub Release tagged `v<package version>`, such as `v0.1.1`. Upload
   the generated artifacts from `release` together:
   - the `RocketStats-Desktop-<version>-Setup-x64.exe` installer;
   - its `.exe.blockmap`;
   - `latest.yml`.
4. Publish as a normal release, **not a draft or prerelease**. All three assets
   must belong to the same build and version. Do not edit the generated checksum
   or replace assets with files from another build.
5. Test upgrading the previous signed version on a Windows test machine before
   recommending the release to friends.

Both build commands use `publish: never`: neither uploads code nor creates or
publishes releases. Uploads are a separate deliberate maintainer operation.
`desktop:dist` can still build an unsigned local installer when the configuration
is entirely empty, but that installer has no update source. Once a source is
configured, this command also requires signing. The Stream Deck SDK is excluded
from the desktop package; the updater and its runtime dependencies are included.

## Trust and privacy

HTTPS plus a checksum detects corruption, but a checksum next to a compromised
installer is not proof of its publisher. The configured signing publisher is an
additional trust boundary; protect the signing key and GitHub release permissions.
Signing does **not** constitute an Epic/Psyonix or anti-cheat approval.

Automatic checking introduces outbound requests to GitHub and its release/CDN
infrastructure. GitHub receives normal request metadata, such as the client's
IP address. No Rocket League log, account ID, player name, MMR or match statistics
are attached to update requests. The renderer still has no direct network access.

## Required live-release checks

Unit tests cover configuration validation, no-source/development gating,
available/current/offline states, consent and progress, simulated signature/
checksum failure, persistence gating and seven-language UI controls. They do
not replace a real signed-release upgrade test.

Before distribution, verify on a clean Windows profile:

- install version A manually, then update to higher signed version B;
- publisher and checksum mismatches refuse installation;
- an offline check is visible and retryable;
- no download or installation occurs without consent;
- closing the app alone never installs a downloaded update;
- a running game blocks installation and a closed game allows retry;
- account statistics, scope and settings survive the update.

A real GitHub source, certificate and live upgrade test remain outstanding until
the maintainer supplies them. The generated installer executable is also subject
to this environment's organization content-exclusion policy; do not bypass that
restriction to inspect or execute it.
