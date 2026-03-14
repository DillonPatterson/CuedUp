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


REQUIRED_ADAPTER_ORDER = ["codex", "anthropic", "openai", "gemini"]
MODEL_PREFIX_RULES = {
    "codex": ("codex",),
    "anthropic": ("claude-",),
    "openai": ("gpt-", "o"),
    "gemini": ("gemini-",),
}
REQUIRED_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
}


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

    def supports_live_execution(self) -> bool:
        return True

    def build_skipped_result(self, reason: str) -> AdapterResult:
        return AdapterResult(
            name=self.name,
            provider=self.provider,
            model=self.model,
            status="skipped",
            text_output=reason,
            raw_response={"status": "skipped", "reason": reason},
            summary_markdown=_build_summary(
                self.name,
                self.provider,
                self.model,
                "skipped",
                reason,
            ),
        )


class CodexAdapter(BaseAdapter):
    def supports_live_execution(self) -> bool:
        return False

    def call(self, prompt: str, prompt_path: Path, dry_run: bool) -> AdapterResult:
        cli_command = self.config.get("cli_command", "codex")
        reason = (
            "Codex live integration is not wired in v1. "
            f"Suggested next step: connect `{cli_command}` or a non-interactive Codex automation path."
        )
        return self.build_skipped_result(reason)


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


def validate_adapter_configs(config: dict, dry_run: bool) -> list[str]:
    adapters = config.get("adapters")
    if not isinstance(adapters, list) or not adapters:
        raise ValueError("Pipeline config must include a non-empty adapters list.")

    provider_order = [adapter.get("provider") for adapter in adapters]
    if provider_order != REQUIRED_ADAPTER_ORDER:
        raise ValueError(
            "Pipeline adapters must be ordered as: "
            + " -> ".join(REQUIRED_ADAPTER_ORDER)
        )

    warnings: list[str] = []
    for adapter in adapters:
        name = (adapter.get("name") or "").strip()
        provider = (adapter.get("provider") or "").strip()
        model = (adapter.get("model") or "").strip()

        if not name:
            raise ValueError(f"Adapter config is missing a name: {adapter}")
        if provider not in MODEL_PREFIX_RULES:
            raise ValueError(f"Unsupported provider: {provider}")
        if not model:
            raise ValueError(f"Adapter `{name}` is missing a model name.")

        if not any(model.startswith(prefix) for prefix in MODEL_PREFIX_RULES[provider]):
            raise ValueError(
                f"Adapter `{name}` has a suspicious model name `{model}` for provider `{provider}`."
            )

        required_env_var = REQUIRED_ENV_VARS.get(provider)
        if not dry_run and required_env_var and not os.environ.get(required_env_var):
            raise ValueError(
                f"Adapter `{name}` requires `{required_env_var}` for live runs."
            )

        if provider == "codex":
            warnings.append(
                "Codex is configured but will be skipped until live integration exists."
            )

    return warnings
