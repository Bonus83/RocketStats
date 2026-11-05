# Runs GitHub CLI with a project-only configuration so this repository uses its own
# GitHub account, independent of any account signed in to VS Code or a global gh login.
$ErrorActionPreference = "Stop"
$env:GH_CONFIG_DIR = Join-Path $env:LOCALAPPDATA "RocketStatsElgato\gh"
New-Item -ItemType Directory -Force $env:GH_CONFIG_DIR | Out-Null

$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\gh.exe" }
if (-not (Test-Path $gh)) { throw "GitHub CLI not found. Install it with: winget install --id GitHub.cli -e --scope user" }

& $gh @args
exit $LASTEXITCODE
