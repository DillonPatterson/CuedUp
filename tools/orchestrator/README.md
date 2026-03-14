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

## Default models

- Anthropic: `claude-sonnet-4-20250514`
- OpenAI: `gpt-4o`
- Gemini: `gemini-2.5-pro`

You can override these in [tools/orchestrator/config/pipeline.json](C:\Users\dillo\Desktop\CuedUp\tools\orchestrator\config\pipeline.json) if your account or provider setup requires different valid model IDs.

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
- keeps repo evidence partial, filtered, and inspectable
- assembles prompts from config and templates
- runs adapters in this order: Codex, Claude, OpenAI GPT, Gemini
- saves prompts, raw responses, summaries, and a final report into a timestamped run folder

## Current limitations

- Codex is a documented stub in v1, not a real automated integration
- no retries, queues, or background execution
- no UI
- no code editing or auto-commit behavior
- no persistence beyond run artifacts on disk

## Codex in v1

The Codex adapter does not execute Codex directly yet. It is recorded as skipped and is not treated as a completed reviewing model in the final report.
