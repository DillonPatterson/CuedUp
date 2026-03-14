# Orchestrator

Local file-based multi-LLM orchestration for the CuedUp repo. This tool stays outside the app runtime and writes every run to a timestamped folder under `tools/orchestrator/runs/`.

## Setup

1. Ensure Python 3.11+ is available.
2. Copy `tools/orchestrator/.env.example` to `tools/orchestrator/.env` or set the same environment variables in your shell.
3. Run from the repo root.

## Required env vars

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `CODEX_CLI_COMMAND` optional, used only for the Codex stub suggestion

## Dry-run

```bash
python tools/orchestrator/run.py --dry-run
```

## Live run

```bash
python tools/orchestrator/run.py
```

You can override the default task prompt:

```bash
python tools/orchestrator/run.py --task "Review the current replay/debug toolchain and recommend the next implementation step."
```

## What it does

- gathers basic repo context
- assembles prompts from config and templates
- runs adapters in this order: Codex, Claude, GPT 5.4, Gemini 3 Pro
- saves prompts, raw responses, summaries, and a final report into a timestamped run folder

## Current limitations

- Codex is a documented stub in v1, not a real automated integration
- no retries, queues, or background execution
- no UI
- no code editing or auto-commit behavior
- no persistence beyond run artifacts on disk

## Codex in v1

The Codex adapter does not execute Codex directly yet. In dry-run it records a stub result. In live mode it still records a stub result plus a suggested CLI command and TODO note so the next integration step is explicit.
