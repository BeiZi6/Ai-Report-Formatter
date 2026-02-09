from __future__ import annotations

import shutil
import stat
import subprocess
import sys
from pathlib import Path


def _binary_name() -> str:
    return "api-server.exe" if sys.platform.startswith("win") else "api-server"


def create_pyinstaller_command(
    *,
    repo_root: Path,
    entrypoint: Path,
    dist_dir: Path,
    work_dir: Path,
    spec_dir: Path,
) -> list[str]:
    return [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        "api-server",
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(spec_dir),
        "--paths",
        str(repo_root / "apps" / "formatter"),
        "--paths",
        str(repo_root),
        "--collect-submodules",
        "formatter",
        "--hidden-import",
        "formatter.app_logic",
        "--hidden-import",
        "formatter.docx_builder",
        "--hidden-import",
        "formatter.ui_config",
        str(entrypoint),
    ]


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    api_dir = repo_root / "apps" / "api"
    entrypoint = api_dir / "desktop_backend.py"
    pyinstaller_root = api_dir / ".pyinstaller"
    dist_dir = pyinstaller_root / "dist"
    work_dir = pyinstaller_root / "build"
    spec_dir = pyinstaller_root / "spec"
    web_backend_dir = repo_root / "apps" / "web" / "electron" / "backend"

    command = create_pyinstaller_command(
        repo_root=repo_root,
        entrypoint=entrypoint,
        dist_dir=dist_dir,
        work_dir=work_dir,
        spec_dir=spec_dir,
    )

    result = subprocess.run(command, cwd=api_dir)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    binary_path = dist_dir / _binary_name()
    if not binary_path.exists():
        raise SystemExit(f"Expected backend binary not found at: {binary_path}")

    web_backend_dir.mkdir(parents=True, exist_ok=True)
    target = web_backend_dir / binary_path.name
    _ = shutil.copy2(binary_path, target)

    if not sys.platform.startswith("win"):
        target.chmod(target.stat().st_mode | stat.S_IEXEC)

    print(f"Bundled backend copied to: {target}")


if __name__ == "__main__":
    main()
