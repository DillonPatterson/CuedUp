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
    validation_warnings: list[str],
) -> str:
    error_results = [result for result in results if result.status == "error"]
    skipped_results = [result for result in results if result.status == "skipped"]
    successful_results = [result for result in results if result.status == "ok"]
    dry_run_results = [result for result in results if result.status == "dry-run"]

    if error_results:
        run_status = "incomplete / partially invalid"
        status_detail = (
            "One or more adapters failed. Do not treat this as a complete multi-model review."
        )
    elif dry_run_results and not successful_results:
        run_status = "dry-run only"
        status_detail = "No live provider calls were made."
    elif skipped_results:
        run_status = "partial"
        status_detail = (
            "At least one adapter was skipped. This report does not represent a full multi-model run."
        )
    else:
        run_status = "complete"
        status_detail = "All configured live adapters completed without recorded errors."

    sections = [
        "# Orchestrator Run",
        "",
        "## Run Status",
        "",
        f"- Status: **{run_status}**",
        f"- Detail: {status_detail}",
        f"- Successful adapters: {len(successful_results)}",
        f"- Skipped adapters: {len(skipped_results)}",
        f"- Failed adapters: {len(error_results)}",
        "",
    ]

    if validation_warnings:
        sections.extend(
            [
                "## Startup Warnings",
                "",
                *[f"- {warning}" for warning in validation_warnings],
                "",
            ]
        )

    if error_results:
        sections.extend(["## Adapter Failures", ""])
        for result in error_results:
            sections.append(f"- `{result.name}` failed: {result.text_output}")
        sections.append("")

    if skipped_results:
        sections.extend(["## Skipped Adapters", ""])
        for result in skipped_results:
            sections.append(f"- `{result.name}` skipped: {result.text_output}")
        sections.append("")

    sections.extend(
        [
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
    )

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
