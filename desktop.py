from __future__ import annotations

import multiprocessing
import os
import socket
import sys
import threading
import time
import traceback
from pathlib import Path

import uvicorn
import webview


def resource_path(*parts: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base.joinpath(*parts)


def start_server() -> tuple[uvicorn.Server, int, threading.Thread]:
    frontend = resource_path("frontend", "dist")
    if not (frontend / "index.html").is_file():
        raise FileNotFoundError(f"SIREN 界面文件不存在：{frontend}")

    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    data_dir = local_app_data / "SIREN" / "projects"
    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIREN_DATA_DIR"] = str(data_dir)
    os.environ["SIREN_FRONTEND_DIR"] = str(frontend)

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    port = listener.getsockname()[1]

    config = uvicorn.Config("backend.app.main:app", host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 30
    while not server.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.05)
    if not server.started:
        server.should_exit = True
        raise RuntimeError("SIREN 本地服务启动失败。请重启软件；若问题持续，请联系软件维护人员。")
    return server, port, thread


def main() -> None:
    multiprocessing.freeze_support()
    server, port, thread = start_server()
    webview.create_window(
        "SIREN",
        f"http://127.0.0.1:{port}/",
        width=1480,
        height=940,
        min_size=(1100, 720),
        background_color="#e9edf2",
    )
    try:
        webview.start()
    finally:
        server.should_exit = True
        thread.join(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        details = f"SIREN 启动失败：{error}"
        if os.name == "nt":
            import ctypes

            ctypes.windll.user32.MessageBoxW(None, details, "SIREN", 0x10)
        else:
            traceback.print_exc()
