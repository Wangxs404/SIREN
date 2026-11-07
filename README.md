# SIREN 立管响应 GUI 原型

SIREN 是一个本机运行的立管响应分析 GUI 原型，前端使用 React、TypeScript、Three.js 和 ECharts，后端使用 FastAPI 与独立 Python 求解进程。

本项目采用 [GNU GPL v3.0](LICENSE)。

详细的安装、启动、工况编辑、计算、动画回放和结果归档说明见 [使用说明.md](使用说明.md)。

## Windows 安装版

Windows 用户可运行 `SIREN-Setup-0.1.0-x64.exe` 安装。安装后从开始菜单或桌面快捷方式启动 **SIREN**。安装包包含界面、本地服务及 Python 运行环境，不要求另行安装 Python 或 Node.js。

计算项目与结果保存在 `%LOCALAPPDATA%\SIREN\projects`，卸载软件时该目录会保留。

## 开发模式快速启动

首次运行，在项目目录执行：

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd frontend && npm install && cd ..
./run-dev.sh
```

打开 <http://127.0.0.1:5173/>。开发模式仍需本机 Python 和 Node.js。

Windows 安装包构建步骤见 [packaging/windows/README.md](packaging/windows/README.md)。

## 公开仓库构建范围

仓库包含 GUI、Python 本地服务、求解器、锁定依赖和 Windows 自动构建流程；拉取后可在 Windows 上生成安装程序。原始 MATLAB 资料目录 `analysis_source/` 与压缩包 `预报软件算例(1).rar` 不纳入公开仓库，Python 工况预设已保留在 `solver/source_cases.py`。原始资料的公开再分发权限尚未确认。

仓库发布前还需确定源代码许可证；未确定前不要将代码标注为 MIT、GPL 等许可证。

## 当前版本边界

求解内核为简化研究原型，重点在参数编辑、任务流、动态响应展示和本地结果归档；尚未完成与原 MATLAB 算例的逐点回归验证，不应用于工程设计或安全校核。
