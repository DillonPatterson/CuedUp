@echo off
powershell.exe -ExecutionPolicy Bypass -File "%~dp0open-cuedup.ps1" -StartDev -NoEditor -NoLauncher %*
