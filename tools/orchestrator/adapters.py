import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AdapterResult:
    name: str
    provider: str
    model: str
    status: str
    text_output: str
    raw_response: dict
    summary_markdown: str


def _http_post_json(url: str, headers: dict[str, str], payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{error.code} {error.reason}: {body}") from error


def _build_summary(name: str, provider: str, model: str, status: str, text_output: str) -> str:
    body = text_output.strip() or "_No text output returned._"
    return (
        f"# {name}\n\n"
        f"- Provider: `{provider}`\n"
        f"- Model: `{model}`\n"
        f"- Status: `{status}`\n\n"
        f"{body}\n"
    )


class BaseAdapter:
    def __init__(self, config: dict):
        self.config = config
        self.name = config["name"]
        self.provider = config["provider"]
        self.model = config["model"]

    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        raise NotImplementedError


class CodexAdapter(BaseAdapter):
    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        status = "dry-run" if dry_run else "stub"
        cli_command = self.config.get("cli_command", "codex")
        text_output = (
            "Codex adapter is stubbed in v1. "
            f"Prompt saved to `{prompt_path.name}`. "
            f"Next integration step: wire `{cli_command}` or Codex automation non-interactively."
        )
        raw_response = {
            "status": status,
            "provider": self.provider,
            "model": self.model,
            "prompt_path": str(prompt_path),
            "suggested_command": f"{cli_command} < {prompt_path.name}",
            "todo": "Implement direct Codex automation in a later step.",
        }
        return AdapterResult(
            name=self.name,
            provider=self.provider,
            model=self.model,
            status=status,
            text_output=text_output,
            raw_response=raw_response,
            summary_markdown=_build_summary(
                self.name, self.provider, self.model, status, text_output
            ),
        )


class OpenAIAdapter(BaseAdapter):
    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        if dry_run:
            return AdapterResult(
                name=self.name,
                provider=self.provider,
                model=self.model,
                status="dry-run",
                text_output="OpenAI request skipped in dry-run mode.",
                raw_response={"status": "dry-run", "prompt_path": str(prompt_path)},
                summary_markdown=_build_summary(
                    self.name,
                    self.provider,
                    self.model,
                    "dry-run",
                    "OpenAI request skipped in dry-run mode.",
                ),
            )

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set.")

        response = _http_post_json(
            "https://api.openai.com/v1/responses",
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            {
                "model": self.model,
                "input": prompt,
            },
        )

        text_output = response.get("output_text") or ""
        if not text_output:
            parts: list[str] = []
            for output_item in response.get("output", []):
                for content_item in output_item.get("content", []):
                    text = content_item.get("text")
                    if text:
                        parts.append(text)
            text_output = "\n".join(parts).strip()

        return AdapterResult(
            name=self.name,
            provider=self.provider,
            model=self.model,
            status="ok",
            text_output=text_output,
            raw_response=response,
            summary_markdown=_build_summary(
                self.name, self.provider, self.model, "ok", text_output
            ),
        )


class AnthropicAdapter(BaseAdapter):
    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        if dry_run:
            return AdapterResult(
                name=self.name,
                provider=self.provider,
                model=self.model,
                status="dry-run",
                text_output="Anthropic request skipped in dry-run mode.",
                raw_response={"status": "dry-run", "prompt_path": str(prompt_path)},
                summary_markdown=_build_summary(
                    self.name,
                    self.provider,
                    self.model,
                    "dry-run",
                    "Anthropic request skipped in dry-run mode.",
                ),
            )

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set.")

        response = _http_post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            {
                "model": self.model,
                "max_tokens": self.config.get("max_tokens", 2048),
                "messages": [{"role": "user", "content": prompt}],
            },
        )

        text_output = "\n".join(
            item.get("text", "") for item in response.get("content", []) if item.get("text")
        ).strip()

        return AdapterResult(
            name=self.name,
            provider=self.provider,
            model=self.model,
            status="ok",
            text_output=text_output,
            raw_response=response,
            summary_markdown=_build_summary(
                self.name, self.provider, self.model, "ok", text_output
            ),
        )


class GeminiAdapter(BaseAdapter):
    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        if dry_run:
            return AdapterResult(
                name=self.name,
                provider=self.provider,
                model=self.model,
                status="dry-run",
                text_output="Gemini request skipped in dry-run mode.",
                raw_response={"status": "dry-run", "prompt_path": str(prompt_path)},
                summary_markdown=_build_summary(
                    self.name,
                    self.provider,
                    self.model,
                    "dry-run",
                    "Gemini request skipped in dry-run mode.",
                ),
            )

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set.")

        response = _http_post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}",
            {
                "Content-Type": "application/json",
            },
            {
                "contents": [
                    {
                        "parts": [{"text": prompt}],
                    }
                ]
            },
        )

        parts: list[str] = []
        for candidate in response.get("candidates", []):
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                text = part.get("text")
                if text:
                    parts.append(text)
        text_output = "\n".join(parts).strip()

        return AdapterResult(
            name=self.name,
            provider=self.provider,
            model=self.model,
            status="ok",
            text_output=text_output,
            raw_response=response,
            summary_markdown=_build_summary(
                self.name, self.provider, self.model, "ok", text_output
            ),
        )


def build_adapters(config: dict) -> list[BaseAdapter]:
    adapters: list[BaseAdapter] = []
    for adapter_config in config["adapters"]:
        provider = adapter_config["provider"]
        if provider == "codex":
            adapters.append(CodexAdapter(adapter_config))
        elif provider == "openai":
            adapters.append(OpenAIAdapter(adapter_config))
        elif provider == "anthropic":
            adapters.append(AnthropicAdapter(adapter_config))
        elif provider == "gemini":
            adapters.append(GeminiAdapter(adapter_config))
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    return adapters
