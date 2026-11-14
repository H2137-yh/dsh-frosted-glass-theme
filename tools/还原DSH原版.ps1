# 还原 DSH Desktop 原版 main.js（撤回「真·透桌面」亚克力补丁）
#
# 用法：右键 → 使用 PowerShell 运行；或在终端：
#   powershell -ExecutionPolicy Bypass -File .\还原DSH原版.ps1
#
# 原理：插件打补丁前会把原文件备份成 main.js.dsh-frosted-glass-backup，
# 本脚本把备份复制回 main.js。没有备份就什么都不做。
# 还原后需要重启 DSH Desktop 才生效。

$ErrorActionPreference = 'Stop'

$candidates = @(
  "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\app\lib\main.js",
  'F:\04_软件\DeepSeek Harness\resources\app\lib\main.js',
  'C:\Program Files\DeepSeek Harness\resources\app\lib\main.js'
)

$done = $false
foreach ($main in $candidates) {
  $backup = "$main.dsh-frosted-glass-backup"
  if ((Test-Path $main) -and (Test-Path $backup)) {
    Copy-Item $backup $main -Force
    Write-Host "已还原：$main" -ForegroundColor Green
    Write-Host "备份文件保留在：$backup" -ForegroundColor DarkGray
    $done = $true
    break
  }
}

if (-not $done) {
  Write-Host '没找到可还原的备份（可能本来就没打补丁，或备份已被删除）。' -ForegroundColor Yellow
  Write-Host '检查过的路径：'
  foreach ($main in $candidates) { Write-Host "  $main" }
}

Write-Host ''
Write-Host '请重启 DeepSeek Harness Desktop 让改动生效。' -ForegroundColor Cyan
Read-Host '按回车退出'
