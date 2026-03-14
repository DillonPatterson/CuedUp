import argparse
import json
from datetime import datetime
from pathlib import Path

from adapters import AdapterResult, build_adapters
from config_loader import load_env_file, load_pipeline_config
from prompting import build_prompt
from repo_context import gather_repo_context, render_repo_context
from reporting import build_final_report, write_json, write_text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local multi-LLM orchestrator.")
    parser.add_argument("--dry-run", action="store_true", help="Skip live API calls.")
    parser.add_argument(
        "--task",
        default=None,
        help="Override the default task description from config.",
    )
    return parser.parse_args()


def make_run_dir(base_dir: Path) -> Path:
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = base_dir / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]
    base_dir = Path(__file__).resolve().parent

    load_env_file(base_dir / ".env")
    load_env_file(repo_root / ".env")

    config = load_pipeline_config(base_dir)
    task_description = args.task or config["default_task_description"]
    repo_context = gather_repo_context(repo_root)
    repo_context_markdown = render_repo_context(repo_context)
    run_dir = make_run_dir(base_dir)
    write_json(
        run_dir / "run-metadata.json",
        {
            "dry_run": args.dry_run,
            "task_description": task_description,
            "repo_context": repo_context,
            "generated_at": datetime.now().isoformat(),
        },
    )
    write_text(run_dir / "repo-context.md", repo_context_markdown)

    prior_summaries = "None yet."
    results: list[AdapterResult] = []
    adapters = build_adapters(config)

    for index, adapter in enumerate(adapters, start=1):
        prompt = build_prompt(
            base_dir,
            config["prompts"]["system_template"],
            config["prompts"]["task_template"],
            {
                "repo_name": repo_root.name,
                "run_timestamp": datetime.now().isoformat(),
                "task_description": task_description,
                "repo_context": repo_context_markdown,
                "agents_guidance": repo_context["agents_guidance"] or "None",
                "prior_summaries": prior_summaries,
                "model_name": adapter.name,
            },
        )
        file_prefix = f"{index:02d}-{adapter.name}"
        prompt_path = run_dir / f"{file_prefix}.prompt.md"
        write_text(prompt_path, prompt)

        try:
            result = adapter.call(prompt, prompt_path, args.dry_run)
        except Exception as error:  # noqa: BLE001
            result = AdapterResult(
                name=adapter.name,
                provider=adapter.provider,
                model=adapter.model,
                status="error",
                text_output=str(error),
                raw_response={"error": str(error)},
                summary_markdown=(
                    f"# {adapter.name}\n\n"
                    f"- Provider: `{adapter.provider}`\n"
                    f"- Model: `{adapter.model}`\n"
                    f"- Status: `error`\n\n"
                    f"{error}\n"
                ),
            )

        write_json(run_dir / f"{file_prefix}.raw.json", result.raw_response)
        write_text(run_dir / f"{file_prefix}.summary.md", result.summary_markdown)

        results.append(result)
        prior_summaries = "\n\n".join(
            result.summary_markdown.strip() for result in results
        )

    final_report = build_final_report(task_description, repo_context_markdown, results)
    write_text(run_dir / "final-report.md", final_report)

    print(json.dumps({"run_dir": str(run_dir), "dry_run": args.dry_run}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
