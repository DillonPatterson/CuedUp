import json
import os
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def load_pipeline_config(base_dir: Path) -> dict:
    config_path = base_dir / "config" / "pipeline.json"
    return json.loads(config_path.read_text(encoding="utf-8"))
