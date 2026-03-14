from pathlib import Path


def load_template(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def render_template(template: str, values: dict[str, str]) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", value)
    return rendered


def build_prompt(
    base_dir: Path,
    system_template: str,
    task_template: str,
    values: dict[str, str],
) -> str:
    system_text = load_template(base_dir / system_template)
    task_text = load_template(base_dir / task_template)
    rendered_task = render_template(task_text, values)
    return f"{system_text.rstrip()}\n\n---\n\n{rendered_task.rstrip()}\n"
