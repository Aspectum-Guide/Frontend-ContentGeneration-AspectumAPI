<#
.SYNOPSIS
  Build the admin frontend and deploy it to the studio server over ssh.

.DESCRIPTION
  Runs the tests, builds with vite, uploads the bundle and swaps the web root
  atomically on the server (the previous release stays in <root>.prev for
  rollback). Needs only ssh/scp access to the host alias (default: studio).

.EXAMPLE
  .\scripts\deploy-studio.ps1                 # tests + build + deploy to new.studio
  .\scripts\deploy-studio.ps1 -SkipTests      # faster
  .\scripts\deploy-studio.ps1 -Rollback       # switch back to the previous release
  .\scripts\deploy-studio.ps1 -Scope studio   # build only the studio (generation) or catalog area

  .\scripts\deploy-studio.ps1 -RemoteDir /opt/aspectum/admin-content-generation -Url https://admin.studio.aspectum-guide.ru -Force
#>
[CmdletBinding()]
param(
    [string]$SshHost = 'studio',
    [string]$RemoteDir = '/opt/aspectum/admin-new',
    [string]$Url = 'https://new.studio.aspectum-guide.com',
    [ValidateSet('all', 'studio', 'catalog')][string]$Scope = 'all',
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$Rollback,
    [switch]$Force
)

# Native tools (npx, ssh, scp) write progress and warnings to stderr; under 'Stop' Windows PowerShell 5.1
# turns those into terminating errors. Decide by exit code instead (see Check).
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }

$defaultDir = '/opt/aspectum/admin-new'
if ($RemoteDir -ne $defaultDir -and -not $Force) {
    throw "RemoteDir is not $defaultDir. Pass -Force if you really mean to replace '$RemoteDir'."
}

$remoteScriptSrc = Join-Path $PSScriptRoot 'deploy-remote.sh'
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('aspectum-deploy-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -ErrorAction Stop | Out-Null
try {
    # The server runs bash: normalise line endings (git may have checked out CRLF).
    $remoteScript = Join-Path $tmp 'deploy-remote.sh'
    $text = [IO.File]::ReadAllText($remoteScriptSrc) -replace "`r`n", "`n"
    [IO.File]::WriteAllText($remoteScript, $text, (New-Object Text.UTF8Encoding($false)))
    $remoteScriptDest = '/tmp/aspectum-deploy-remote.sh'

    Step "Upload helper to $SshHost"
    scp $remoteScript "${SshHost}:${remoteScriptDest}"
    Check 'scp helper'

    if ($Rollback) {
        Step "Rollback $RemoteDir"
        ssh $SshHost "bash $remoteScriptDest rollback $RemoteDir; rm -f $remoteScriptDest"
        Check 'rollback'
        Write-Host "Done. Check $Url" -ForegroundColor Green
        return
    }

    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    $commit = (git rev-parse --short HEAD).Trim()
    $dirty = (git status --porcelain)
    Write-Host "Deploying $branch @ $commit (scope: $Scope) to ${SshHost}:$RemoteDir"
    if ($dirty) { Write-Warning 'Working tree has uncommitted changes; they are included in the build.' }

    if (-not $SkipTests) {
        Step 'Tests'
        npx vitest run
        Check 'tests'
    }
    if (-not $SkipBuild) {
        Step 'Build'
        # A VITE_API_URL baked into the bundle breaks every host but one; vite.config.js
        # already refuses to build with it, so just make sure it is not leaking from the shell.
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
        if ($Scope -eq 'all') { npx vite build } else { node scripts/build-scope.mjs $Scope }
        Check 'build'
    }
    if (-not (Test-Path 'dist/index.html')) { throw 'dist/index.html is missing; run without -SkipBuild.' }

    Step 'Pack and upload'
    $archive = Join-Path $tmp 'admin.tgz'
    tar -czf $archive -C dist .
    Check 'tar'
    $remoteArchive = '/tmp/aspectum-admin.tgz'
    scp $archive "${SshHost}:${remoteArchive}"
    Check 'scp archive'

    Step 'Swap on server'
    ssh $SshHost "bash $remoteScriptDest deploy $remoteArchive $RemoteDir; rm -f $remoteScriptDest"
    Check 'remote deploy'

    Step "Verify $Url"
    $index = Get-Content 'dist/index.html' -Raw
    $local = [regex]::Matches($index, 'assets/[^"''\s]+\.(js|css)') | ForEach-Object { $_.Value } | Sort-Object -Unique
    $live = (Invoke-WebRequest "$Url/generation/" -UseBasicParsing -ErrorAction Stop).Content
    $missing = $local | Where-Object { $live -notmatch [regex]::Escape($_) }
    if ($missing) {
        Write-Warning ("Live index.html does not reference: " + ($missing -join ', ') + ' (cache or wrong site?)')
    } else {
        Write-Host "Live site serves this build ($commit)." -ForegroundColor Green
    }
}
finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
