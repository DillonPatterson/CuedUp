import subprocess
from pathlib import Path


def run_git_command(repo_root: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout.strip()


def gather_repo_context(repo_root: Path) -> dict:
    branch = run_git_command(repo_root, "branch", "--show-current")
    latest_commit = run_git_command(repo_root, "log", "-1", "--pretty=format:%H%n%s%n%ci")
    changed_files = run_git_command(repo_root, "status", "--short") or "clean"
    agents_path = repo_root / "AGENTS.md"
    agents_guidance = agents_path.read_text(encoding="utf-8") if agents_path.exists() else ""

    return {
      "branch": branch,
      "latest_commit": latest_commit,
      "changed_files": changed_files,
      "agents_guidance": agents_guidance.strip(),
    }


def render_repo_context(context: dict) -> str:
    return (
        f"Branch: {context['branch']}\n\n"
        f"Latest commit:\n{context['latest_commit']}\n\n"
        f"Changed files:\n{context['changed_files']}\n"
    )
