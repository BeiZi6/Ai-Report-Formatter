from pathlib import Path

from apps.api.scripts.build_desktop_backend import create_pyinstaller_command


def test_create_pyinstaller_command_collects_formatter_submodules():
    repo_root = Path("/tmp/repo")
    entrypoint = repo_root / "apps" / "api" / "desktop_backend.py"
    dist_dir = repo_root / "apps" / "api" / ".pyinstaller" / "dist"
    work_dir = repo_root / "apps" / "api" / ".pyinstaller" / "build"
    spec_dir = repo_root / "apps" / "api" / ".pyinstaller" / "spec"

    command = create_pyinstaller_command(
        repo_root=repo_root,
        entrypoint=entrypoint,
        dist_dir=dist_dir,
        work_dir=work_dir,
        spec_dir=spec_dir,
    )

    assert "--collect-submodules" in command
    index = command.index("--collect-submodules")
    assert command[index + 1] == "formatter"

    path_positions = [
        i for i, value in enumerate(command) if value == "--paths"
    ]
    assert command[path_positions[0] + 1] == str(repo_root / "apps" / "formatter")
    assert command[path_positions[1] + 1] == str(repo_root)
