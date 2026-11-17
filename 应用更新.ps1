$ErrorActionPreference='Stop'
$projectPath='D:\校招信息聚合与智能推荐平台项目'
$entries=Get-Content -LiteralPath (Join-Path $PSScriptRoot '校验清单.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$allApplied=$true
foreach($entry in $entries){
  $sourcePath=Join-Path $PSScriptRoot $entry.path
  $targetPath=Join-Path $projectPath $entry.path
  if(-not(Test-Path -LiteralPath $sourcePath -PathType Leaf)){throw ('更新文件缺失：'+$entry.path)}
  if(-not(Test-Path -LiteralPath $targetPath -PathType Leaf)){throw ('原项目文件不存在：'+$targetPath)}
  if((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $entry.newHash){throw ('更新文件校验失败：'+$entry.path)}
  $currentHash=(Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
  if($currentHash -ne $entry.newHash){$allApplied=$false}
  if($currentHash -ne $entry.oldHash -and $currentHash -ne $entry.newHash){throw ('原文件已发生其他修改，停止覆盖：'+$entry.path)}
}
if($allApplied){Write-Host '本次更新已经应用。请在浏览器按 Ctrl+F5 刷新。';exit 0}
$backupPath=Join-Path $PSScriptRoot ('修改前备份-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
foreach($entry in $entries){
  $backupFile=Join-Path $backupPath $entry.path
  New-Item -ItemType Directory -Path (Split-Path -Parent $backupFile) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectPath $entry.path) -Destination $backupFile -Force
}
try{
  foreach($entry in $entries){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.path) -Destination (Join-Path $projectPath $entry.path) -Force}
  foreach($entry in $entries){if((Get-FileHash -LiteralPath (Join-Path $projectPath $entry.path) -Algorithm SHA256).Hash -ne $entry.newHash){throw ('写入结果校验失败：'+$entry.path)}}
}catch{
  $updateError=$_.Exception.Message
  foreach($entry in $entries){Copy-Item -LiteralPath (Join-Path $backupPath $entry.path) -Destination (Join-Path $projectPath $entry.path) -Force}
  throw ('更新未完成，已恢复修改前文件。原因：'+$updateError)
}
Write-Host '更新完成：技能卡片渐变玻璃悬浮、当前画像岗位卡片悬浮。'
Write-Host ('修改前备份：'+$backupPath)
Write-Host '请回到浏览器按 Ctrl+F5 强制刷新。'
