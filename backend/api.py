import os
import shutil
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .models import FileResult, ConfirmRequest
from .config import load_rules
from .reader import read_file
from .classifier import classify

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = os.getenv("CONFIG_PATH", "config/rules.yaml")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "output"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Pending files awaiting confirmation: id -> (temp_path, original_filename)
pending: dict[str, tuple[Path, str]] = {}


@app.get("/api/categories")
def get_categories():
    rules = load_rules(CONFIG_PATH)
    return rules["categories"]


@app.post("/api/upload", response_model=list[FileResult])
async def upload_files(files: list[UploadFile] = File(...)):
    rules = load_rules(CONFIG_PATH)
    results: list[FileResult] = []

    for file in files:
        file_id = str(uuid.uuid4())
        safe_name = file.filename or "unknown"
        file_path = UPLOAD_DIR / f"{file_id}_{safe_name}"

        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        content_blocks = read_file(file_path)
        category = classify(content_blocks, rules, safe_name) if content_blocks else "unclassified"

        pending[file_id] = (file_path, safe_name)
        results.append(FileResult(id=file_id, filename=safe_name, category=category))

    return results


@app.post("/api/confirm")
def confirm_results(request: ConfirmRequest):
    rules = load_rules(CONFIG_PATH)
    moved: list[str] = []

    for result in request.results:
        entry = pending.get(result.id)
        if not entry:
            continue
        file_path, original_name = entry
        if not file_path.exists():
            continue

        folder = "unclassified"
        for cat in rules["categories"]:
            if cat["name"].lower() == result.category.lower():
                folder = cat.get("folder", cat["name"].lower().replace(" ", "_"))
                break

        dest_dir = OUTPUT_DIR / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(file_path), str(dest_dir / original_name))

        del pending[result.id]
        moved.append(original_name)

    return {"moved": moved, "count": len(moved)}
