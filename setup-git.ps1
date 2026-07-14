# setup-git.ps1
# One-time: turns this folder into a git repo with the full initial history,
# WITHOUT overwriting any of your working files.
#
# HOW TO RUN (native Windows — do NOT run this from Cowork's sandbox):
#   1. Open PowerShell
#   2. cd "C:\Users\AdhamHElSayed\Desktop\Claude Test Project 1"
#   3. .\setup-git.ps1
#
# Requires Git for Windows: https://git-scm.com/download/win

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$bundle = Join-Path $PSScriptRoot "command-center.bundle"
if (-not (Test-Path $bundle)) {
    Write-Error "command-center.bundle not found next to this script."
    exit 1
}

if (Test-Path (Join-Path $PSScriptRoot ".git")) {
    Write-Host "A .git repo already exists here. Aborting so nothing is clobbered." -ForegroundColor Yellow
    exit 0
}

Write-Host "Initializing repository on branch 'main'..." -ForegroundColor Cyan
git init -b main | Out-Null
git config user.name  "Adham"
git config user.email "adham.h.2@talabat.com"

Write-Host "Importing history from the bundle..." -ForegroundColor Cyan
git fetch "$bundle" "refs/heads/master:refs/heads/_import" | Out-Null

# Attach the imported commit as HEAD. --mixed leaves every working file exactly
# as-is; only the index/HEAD are set, so your files are never overwritten.
git reset --mixed _import | Out-Null
git branch -D _import 2>$null | Out-Null

Write-Host "`nDone. Repo state:" -ForegroundColor Green
git log --oneline -1
Write-Host ""
git status --short --branch

Write-Host "`nWorking tree should show clean (files already match the commit)." -ForegroundColor Green
Write-Host "You can delete command-center.bundle now if you like." -ForegroundColor DarkGray
