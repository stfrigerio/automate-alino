import base64
import mimetypes
from pathlib import Path


def read_file(path: Path) -> list[dict] | None:
    """Read a file and return content blocks for the Claude API."""
    mime, _ = mimetypes.guess_type(str(path))

    if mime and mime.startswith("image"):
        data = base64.b64encode(path.read_bytes()).decode()
        return [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": mime, "data": data},
            }
        ]

    if mime == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            return None
        return [{"type": "text", "text": text}]

    try:
        text = path.read_text(errors="ignore")
        if not text.strip():
            return None
        return [{"type": "text", "text": text}]
    except Exception:
        return None
