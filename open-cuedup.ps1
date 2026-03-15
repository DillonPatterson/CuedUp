[CmdletBinding()]
param(
  [switch]$StartDev,
  [switch]$NoEditor,
  [switch]$NoLauncher,
  [switch]$PrintOnly
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $repoRoot "cuedup-launcher.html"
$appUrl = "http://localhost:3000/interview/mock-session/replay#listening-sandbox"
$appHealthUrl = "http://localhost:3000/interview/mock-session/replay"

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

function Stop-CuedUpDevServer {
  $repoPathPattern = [Regex]::Escape($repoRoot)
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq "node.exe" -and
      $_.CommandLine -match $repoPathPattern -and
      $_.CommandLine -match "next"
    }

  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-ForCuedUp {
  param(
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $appHealthUrl -TimeoutSec 3
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 750
      continue
    }

    Start-Sleep -Milliseconds 750
  }

  return $false
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
  Invoke-Step "Stopping stale CuedUp dev processes..." {
    Stop-CuedUpDevServer
  }

  Invoke-Step "Starting npm run dev in a new PowerShell window..." {
    Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location '$repoRoot'; npm run dev"
    )
  }

  Write-Host "Waiting for CuedUp to respond on localhost:3000..."
  $appReady = $PrintOnly -or (Wait-ForCuedUp)

  if ($appReady) {
    Invoke-Step "Opening CuedUp in your browser..." {
      Start-Process $appUrl
    }
  } else {
    Write-Host "CuedUp did not respond before the timeout. Open the URL manually once the dev window shows Ready."
  }
}

Write-Host "Repo root: $repoRoot"
Write-Host "App URL: $appUrl"
if ($PrintOnly) {
  Write-Host "Print-only mode: no windows were opened."
}
