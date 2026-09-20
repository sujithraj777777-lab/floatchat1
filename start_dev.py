import json
import shutil
import socket
import subprocess
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"
VITE = FRONTEND / "node_modules" / "vite" / "bin" / "vite.js"

processes = []
# Local checks should not go through a system HTTP proxy.
http = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def check_processes():
    for name, process in processes:
        code = process.poll()
        if code is not None:
            raise RuntimeError(
                f"{name} stopped with exit code {code}. "
                "Read its error above."
            )


def require_free_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(1)
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            raise RuntimeError(
                f"Port {port} is already occupied. "
                "Stop the existing server in its terminal with Ctrl+C, "
                "then run this launcher again."
            )


def start(name, command, directory):
    print(f"\nStarting {name}...", flush=True)
    process = subprocess.Popen(command, cwd=str(directory))
    processes.append((name, process))


def wait_for_health(url, label):
    deadline = time.monotonic() + 60
    last_error = "No response yet."

    while time.monotonic() < deadline:
        check_processes()
        try:
            with http.open(url, timeout=3) as response:
                data = json.load(response)

            if (
                data.get("status") == "ok"
                and data.get("service") == "FloatChat API"
            ):
                print(f"{label}: OK", flush=True)
                return

            last_error = "The response was not FloatChat's health response."
        except Exception as error:
            last_error = str(error)

        time.sleep(1)

    raise RuntimeError(
        f"{label} did not become ready within 60 seconds.\n"
        f"URL: {url}\n"
        f"Last error: {last_error}"
    )


def main():
    node = shutil.which("node")

    if not PYTHON.is_file():
        raise RuntimeError(f"Backend Python was not found: {PYTHON}")
    if not node:
        raise RuntimeError("Node.js was not found in PATH.")
    if not VITE.is_file():
        raise RuntimeError("Vite is missing. Run npm install in frontend.")

    require_free_port(8001)
    require_free_port(5173)

    start(
        "Backend",
        [
            str(PYTHON),
            "-u",
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8001",
        ],
        BACKEND,
    )

    wait_for_health(
        "http://127.0.0.1:8001/health",
        "Backend connection",
    )

    start(
        "Frontend",
        [
            node,
            str(VITE),
            "--host",
            "127.0.0.1",
            "--port",
            "5173",
            "--strictPort",
        ],
        FRONTEND,
    )

    wait_for_health(
        "http://127.0.0.1:5173/api/health",
        "Frontend-to-backend connection",
    )

    print(
        "\nFloatChat is ready: http://127.0.0.1:5173\n"
        "Keep this terminal open. Press Ctrl+C to stop both servers.\n",
        flush=True,
    )
    webbrowser.open("http://127.0.0.1:5173")

    while True:
        check_processes()
        time.sleep(1)


if __name__ == "__main__":
    exit_code = 0
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping FloatChat...", flush=True)
    except Exception as error:
        exit_code = 1
        print(f"\nSTARTUP ERROR: {error}", flush=True)
    finally:
        for name, process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

    raise SystemExit(exit_code)