[CmdletBinding()]
param(
  [switch]$StartDev,
  [switch]$NoEditor,
  [switch]$NoLauncher,
  [switch]$PrintOnly
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $repoRoot "cuedup-launcher.html"

function Invoke-Step {
  param(
    [string]$Description,
    [scriptblock]$Action
  )

  Write-Host $Description

  if (-not $PrintOnly) {
    & $Action
  }
}

if (-not $NoEditor) {
  $codeCommand = Get-Command code -ErrorAction SilentlyContinue

  if ($codeCommand) {
    Invoke-Step "Opening CuedUp in VS Code..." {
      Start-Process $codeCommand.Source -ArgumentList $repoRoot
    }
  } else {
    Invoke-Step "VS Code CLI not found. Opening the repo folder in Explorer..." {
      Start-Process explorer.exe $repoRoot
    }
  }
}

if (-not $NoLauncher -and (Test-Path $launcherPath)) {
  Invoke-Step "Opening the local CuedUp launchpad..." {
    Start-Process $launcherPath
  }
}

if ($StartDev) {
  Invoke-Step "Starting npm run dev in a new PowerShell window..." {
    Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$repoRoot'; npm run dev"
    )
  }
}

Write-Host "Repo root: $repoRoot"
if ($PrintOnly) {
  Write-Host "Print-only mode: no windows were opened."
}
