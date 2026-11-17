param([switch]$PrepareOnly,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$projectPath=$PSScriptRoot
$environmentPath=Join-Path $projectPath 'backend\.venv'
$pythonPath=Join-Path $environmentPath 'Scripts\python.exe'
$temporaryPath=Join-Path $projectPath '.cache\tmp'
New-Item -ItemType Directory -Path $temporaryPath -Force | Out-Null
$env:TEMP=$temporaryPath
$env:TMP=$temporaryPath
$env:PYTHONUTF8='1'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    $candidates=@()
    if($env:CAMPUS_PYTHON){$candidates+=$env:CAMPUS_PYTHON}
    $command=Get-Command python.exe -ErrorAction SilentlyContinue
    if($command -and $command.Source -notlike '*WindowsApps*'){$candidates+=$command.Source}
    $candidates+=(Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
    $basePython=$null
    foreach($candidate in $candidates){
        if(Test-Path -LiteralPath $candidate){
            & $candidate -c 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)' 2>$null
            if($LASTEXITCODE -eq 0){$basePython=$candidate;break}
        }
    }
    if(-not $basePython){throw '未找到 Python 3.11 或更新版本。请先安装 Python 并加入 PATH，再运行启动脚本。'}
    Write-Host '正在创建项目专用的 Python 环境…'
    & $basePython -m venv $environmentPath
    if($LASTEXITCODE -ne 0){throw 'Python 环境创建失败，请检查目录权限。'}
}
& $pythonPath -c "import importlib.util,sys; sys.exit(0 if all(importlib.util.find_spec(x) for x in ['fastapi','uvicorn','sqlalchemy','pymysql','dotenv','cryptography']) else 1)"
if($LASTEXITCODE -ne 0){
    Write-Host '首次启动正在安装后端依赖，需要连接网络…'
    & $pythonPath -m pip install --disable-pip-version-check -r (Join-Path $projectPath 'backend\requirements.txt')
    if($LASTEXITCODE -ne 0){throw '依赖安装失败，请检查网络后重新运行。'}
}
& $pythonPath (Join-Path $projectPath 'scripts\build_frontend.py')
if($LASTEXITCODE -ne 0){throw '前端构建失败，请查看上方提示。'}
if($PrepareOnly){Write-Host '环境准备完成。';exit 0}
$configurationPath=Join-Path $projectPath 'backend\.env'
if(-not $env:CAMPUS_PORT -and (Test-Path -LiteralPath $configurationPath)){
    foreach($line in (Get-Content -LiteralPath $configurationPath -Encoding UTF8)){
        if($line -match '^\s*CAMPUS_PORT\s*=\s*([0-9]+)\s*$'){$env:CAMPUS_PORT=$Matches[1];break}
    }
}
$port=if($env:CAMPUS_PORT){$env:CAMPUS_PORT}else{'8791'}
$url='http://127.0.0.1:'+$port
try {
    $health=Invoke-RestMethod -Uri ($url+'/api/health') -TimeoutSec 2
    if($health.service -eq 'campus-compass'){
        Write-Host ('平台已在运行：'+$url)
        if(-not $NoBrowser){Start-Process $url}
        exit 0
    }
}catch{}
$env:CAMPUS_OPEN_BROWSER=if($NoBrowser){'0'}else{'1'}
Write-Host ('请保留此窗口，关闭窗口或按 Ctrl+C 将停止平台。访问地址：'+$url)
& $pythonPath (Join-Path $projectPath 'backend\run.py')
if($LASTEXITCODE -ne 0){throw '服务启动失败，请查看端口是否被其他程序占用。'}
