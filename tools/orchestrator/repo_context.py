import subprocess
from pathlib import Path


EXCLUDED_PARTS = {
    ".git",
    ".next",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "runs",
    "__pycache__",
}
TEXT_EXTENSIONS = {
    ".css",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
NON_EVIDENCE_FILES = {"AGENTS.md"}
FALLBACK_FILES = [
    "lib/state/conversation-engine.ts",
    "lib/live/presence-guard.ts",
    "lib/state/interview-session-timeline.ts",
    "components/live/interview-replay.tsx",
    "lib/mock/fixtures/thread-revisit-later.json",
    "lib/mock/interview-session.ts",
]


def run_git_command(repo_root: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout.rstrip()


def _is_included_path(path: Path) -> bool:
    return not any(part in EXCLUDED_PARTS for part in path.parts)


def _is_text_file(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTENSIONS and path.stat().st_size <= 40_000


def _is_evidence_file(path: Path) -> bool:
    return path.name not in NON_EVIDENCE_FILES


def _truncate_text(content: str, max_lines: int = 80, max_chars: int = 4_000) -> str:
    lines = content.splitlines()
    truncated = "\n".join(lines[:max_lines])
    if len(truncated) > max_chars:
        return truncated[:max_chars].rstrip() + "\n...[truncated]"
    if len(lines) > max_lines:
        return truncated.rstrip() + "\n...[truncated]"
    return truncated


def _parse_changed_files(status_output: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for raw_line in status_output.splitlines():
        if not raw_line.strip():
            continue
        status = raw_line[:2].strip() or "?"
        path_text = raw_line[3:].strip()
        if " -> " in path_text:
            path_text = path_text.split(" -> ", 1)[1]
        entries.append({"status": status, "path": path_text})
    return entries


def _build_compact_tree(
    repo_root: Path, max_depth: int = 2, max_entries: int = 60
) -> list[str]:
    lines: list[str] = []
    entries_seen = 0

    def visit(directory: Path, depth: int) -> None:
        nonlocal entries_seen
        if depth > max_depth or entries_seen >= max_entries:
            return

        children = sorted(
            directory.iterdir(),
            key=lambda child: (child.is_file(), child.name.lower()),
        )
        for child in children:
            if entries_seen >= max_entries:
                return
            relative_path = child.relative_to(repo_root)
            if not _is_included_path(relative_path):
                continue

            indent = "  " * depth
            suffix = "/" if child.is_dir() else ""
            lines.append(f"{indent}- {relative_path.as_posix()}{suffix}")
            entries_seen += 1

            if child.is_dir():
                visit(child, depth + 1)

    visit(repo_root, 0)
    return lines


def _collect_selected_files(
    repo_root: Path, changed_files: list[dict[str, str]]
) -> list[dict[str, str]]:
    selected_paths: list[Path] = []
    for entry in changed_files:
        candidate = repo_root / entry["path"]
        if candidate.exists() and candidate.is_file():
            if (
                _is_included_path(candidate.relative_to(repo_root))
                and _is_text_file(candidate)
                and _is_evidence_file(candidate)
            ):
                selected_paths.append(candidate)
        if len(selected_paths) >= 4:
            break

    if not selected_paths:
        for relative_path in FALLBACK_FILES:
            candidate = repo_root / relative_path
            if (
                candidate.exists()
                and candidate.is_file()
                and _is_text_file(candidate)
                and _is_evidence_file(candidate)
            ):
                selected_paths.append(candidate)
        selected_paths = selected_paths[:4]

    excerpts: list[dict[str, str]] = []
    for path in selected_paths:
        excerpts.append(
            {
                "path": path.relative_to(repo_root).as_posix(),
                "content": _truncate_text(
                    path.read_text(encoding="utf-8", errors="replace")
                ),
            }
        )
    return excerpts


def _collect_diff_snippets(
    repo_root: Path, changed_files: list[dict[str, str]]
) -> list[dict[str, str]]:
    snippets: list[dict[str, str]] = []
    for entry in changed_files:
        if entry["status"] == "??":
            continue

        relative_path = entry["path"]
        if Path(relative_path).name in NON_EVIDENCE_FILES:
            continue
        diff_text = run_git_command(repo_root, "diff", "--unified=3", "--", relative_path)
        if not diff_text:
            diff_text = run_git_command(
                repo_root, "diff", "--cached", "--unified=3", "--", relative_path
            )
        if not diff_text:
            continue

        snippets.append(
            {
                "path": relative_path,
                "diff": _truncate_text(diff_text, max_lines=120, max_chars=5_000),
            }
        )
        if len(snippets) >= 3:
            break
    return snippets


def gather_repo_context(repo_root: Path) -> dict:
    branch = run_git_command(repo_root, "branch", "--show-current")
    latest_commit = run_git_command(repo_root, "log", "-1", "--pretty=format:%H%n%s%n%ci")
    changed_files = _parse_changed_files(
        run_git_command(repo_root, "status", "--short", "--untracked-files=all")
    )

    return {
        "branch": branch,
        "latest_commit": latest_commit,
        "changed_files": changed_files,
        "compact_tree": _build_compact_tree(repo_root),
        "selected_file_contents": _collect_selected_files(repo_root, changed_files),
        "diff_snippets": _collect_diff_snippets(repo_root, changed_files),
    }


def render_repo_context(context: dict) -> str:
    sections = [
        "# Repository Snapshot",
        "",
        f"- Branch: `{context['branch']}`",
        "- Context scope: partial and bounded",
        f"- Selected evidence files: {len(context['selected_file_contents'])}",
        f"- Diff snippets included: {len(context['diff_snippets'])}",
        "",
        "## Latest Commit",
        "",
        "```text",
        context["latest_commit"],
        "```",
        "",
        "## Changed Files",
        "",
    ]

    if context["changed_files"]:
        for entry in context["changed_files"]:
            sections.append(f"- `{entry['status']}` {entry['path']}")
    else:
        sections.append("- clean")

    sections.extend(
        [
            "",
            "## Compact Tree",
            "",
            "```text",
            "\n".join(context["compact_tree"]) or "(no entries captured)",
            "```",
        ]
    )

    if context["selected_file_contents"]:
        sections.extend(
            [
                "",
                "## Selected File Excerpts",
                "",
                "Only the files listed below are included as direct evidence. Treat repo understanding as partial outside this set.",
                "",
            ]
        )
        for file_info in context["selected_file_contents"]:
            sections.extend(
                [
                    f"### {file_info['path']}",
                    "",
                    "```text",
                    file_info["content"],
                    "```",
                    "",
                ]
            )

    if context["diff_snippets"]:
        sections.extend(
            [
                "## Recent Diff Snippets",
                "",
                "Diff evidence is partial and limited to a small number of recent changed files.",
                "",
            ]
        )
        for diff_info in context["diff_snippets"]:
            sections.extend(
                [
                    f"### {diff_info['path']}",
                    "",
                    "```diff",
                    diff_info["diff"],
                    "```",
                    "",
                ]
            )

    return "\n".join(sections).rstrip() + "\n"
