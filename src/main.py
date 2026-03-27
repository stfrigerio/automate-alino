import argparse
import shutil
from pathlib import Path

from dotenv import load_dotenv

from .config import load_rules
from .reader import read_file
from .classifier import classify


def get_folder(category: str, rules: dict) -> str:
    for cat in rules["categories"]:
        if cat["name"].lower() == category.lower():
            return cat.get("folder", cat["name"].lower().replace(" ", "_"))
    return "unclassified"


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Classify files based on rules")
    parser.add_argument("--config", default="config/rules.yaml", help="Path to rules YAML")
    parser.add_argument("--input", default="input", help="Input directory")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="Preview without moving files")
    args = parser.parse_args()

    rules = load_rules(args.config)
    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"Input directory '{input_dir}' does not exist.")
        return

    files = sorted(f for f in input_dir.iterdir() if f.is_file() and f.name != ".gitkeep")
    if not files:
        print("No files found in input directory.")
        return

    print(f"Found {len(files)} file(s) to classify.\n")

    results = {"classified": 0, "unclassified": 0, "skipped": 0}

    for file_path in files:
        print(f"  {file_path.name}")
        content = read_file(file_path)

        if content is None:
            print(f"    -> skipped (unreadable)\n")
            results["skipped"] += 1
            continue

        category = classify(content, rules, file_path.name)
        folder = get_folder(category, rules)

        if category == "unclassified":
            results["unclassified"] += 1
        else:
            results["classified"] += 1

        if args.dry_run:
            print(f"    -> {category} (would move to {output_dir / folder}/)\n")
        else:
            dest_dir = output_dir / folder
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / file_path.name
            shutil.move(str(file_path), str(dest))
            print(f"    -> {category} (moved to {dest})\n")

    print(
        f"Done: {results['classified']} classified, "
        f"{results['unclassified']} unclassified, "
        f"{results['skipped']} skipped."
    )


if __name__ == "__main__":
    main()
