# Windows 작업 스케줄러용: 매일 08:00에 이 스크립트를 실행하도록 등록하세요.
# 예) Program: powershell  Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\...\fashion-dashboard\scripts\run-daily-fetch.ps1"
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
npm run fetch:live
