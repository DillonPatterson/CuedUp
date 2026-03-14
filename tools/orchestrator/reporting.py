import json
from pathlib import Path

from adapters import AdapterResult


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_final_report(
    task_description: str,
    repo_context_markdown: str,
    results: list[AdapterResult],
) -> str:
    sections = [
        "# Orchestrator Run",
        "",
        "## Task",
        "",
        task_description,
        "",
        "## Repo Context",
        "",
        repo_context_markdown.strip(),
        "",
        "## Model Summaries",
        "",
    ]

    for result in results:
        sections.extend(
            [
                f"### {result.name}",
                "",
                result.summary_markdown.strip(),
                "",
            ]
        )

    return "\n".join(sections).rstrip() + "\n"
