from pathlib import Path

import yaml


def load_rules(config_path: str) -> dict:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Config not found: {path}\n"
            f"Copy config/rules.example.yaml to config/rules.yaml and edit it."
        )
    with open(path) as f:
        rules = yaml.safe_load(f)
    if "categories" not in rules or not rules["categories"]:
        raise ValueError("Config must have at least one category.")
    return rules
