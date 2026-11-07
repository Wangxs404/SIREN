$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root

if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "未找到 Python 3.11+，请先安装 Python。" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "未找到 Node.js/npm，请先安装 Node.js。" }
if (-not (Get-Command ISCC -ErrorAction SilentlyContinue)) { throw "未找到 Inno Setup 编译器 ISCC.exe，请安装 Inno Setup 并加入 PATH。" }

python -c "import sys; assert sys.version_info >= (3, 11), 'Python 3.11 or newer is required'"
if ($LASTEXITCODE -ne 0) { throw "需要 Python 3.11 或更新版本。" }
$webViewBootstrapper = Join-Path $PSScriptRoot "MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $webViewBootstrapper)) {
    Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $webViewBootstrapper
}
if (-not (Test-Path ".venv\Scripts\python.exe")) { python -m venv .venv }
& ".venv\Scripts\python.exe" -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Python 构建工具安装失败。" }
& ".venv\Scripts\python.exe" -m pip install -r "packaging\windows\requirements-lock.txt"
if ($LASTEXITCODE -ne 0) { throw "Python 应用依赖安装失败。" }

Push-Location frontend
npm ci
if ($LASTEXITCODE -ne 0) { throw "前端依赖安装失败。" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "前端构建失败。" }
Pop-Location

& ".venv\Scripts\pyinstaller.exe" --clean --noconfirm "packaging\windows\SIREN.spec"
if ($LASTEXITCODE -ne 0) { throw "Windows 桌面程序打包失败。" }
ISCC "packaging\windows\SIREN-Setup.iss"
if ($LASTEXITCODE -ne 0) { throw "安装程序生成失败。" }
Write-Host "安装包已生成：$Root\release\SIREN-Setup-0.1.0-x64.exe"
