# SIREN Windows 安装包构建

## 用户安装

交付文件为 `release/SIREN-Setup-0.1.0-x64.exe`。运行安装程序后，从开始菜单或桌面快捷方式启动 SIREN。Python 服务和求解器在本机运行，项目数据保存在 `%LOCALAPPDATA%\SIREN\projects`，卸载时保留。

## 构建环境

在 64 位 Windows 10/11 上构建，安装 Python 3.11 或更新版本、Node.js 18 或更新版本，以及 Inno Setup 6，并将 `ISCC.exe` 加入 `PATH`。Python 依赖固定在 `requirements-lock.txt`，前端依赖固定在 `frontend/package-lock.json`。构建脚本会从 Microsoft 下载 WebView2 Evergreen Bootstrapper 并放入安装包；若用户电脑没有 WebView2，安装时会联网安装该运行时。

## 构建步骤

在 PowerShell 中进入项目根目录并运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\packaging\windows\build-windows.ps1
```

脚本安装 Windows 打包依赖，构建前端，使用 PyInstaller 生成带有 SIREN 图标的桌面程序，再通过 Inno Setup 生成安装向导。中间程序位于 `dist\SIREN`，最终安装程序位于 `release\SIREN-Setup-0.1.0-x64.exe`。

更新 `pyproject.toml` 中的 Python 依赖后，在项目根目录运行 `uv lock`，再运行 `uv export --locked --extra windows --no-dev --no-emit-project --format requirements-txt -o packaging/windows/requirements-lock.txt`，并将 `uv.lock` 与导出的锁文件一并提交。

## Logo 与名称

`packaging/windows/siren.ico` 由 `frontend/public/siren-icon-192.png` 生成，用于主程序与安装向导图标；应用窗口标题为 **SIREN**，界面内品牌图继续使用 `frontend/public/siren-logo.jpg`。

更新品牌图标时，替换 `frontend/public/siren-icon-192.png`，重新生成 `siren.ico`，再完整构建安装包。

## 交付限制

- 当前构建脚本针对 Windows x64；最终 `.exe` 需在 Windows 主机上构建并实际启动确认。
- 首次安装若目标电脑缺少 WebView2 运行时，需要联网完成安装；Windows 11 通常已包含该运行时。
- 安装包目前未签名；正式对外分发时可增加代码签名证书。
- 计算核心仍是研究原型，结果不用于工程设计或安全校核。
