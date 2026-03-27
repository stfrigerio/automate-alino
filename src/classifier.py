import anthropic


def classify(content_blocks: list[dict], rules: dict, file_name: str) -> str:
    """Send file content + rules to Claude and return the matched category name."""
    client = anthropic.Anthropic()

    categories_text = "\n".join(
        f"- {cat['name']}: {', '.join(cat.get('hints', []))}"
        for cat in rules["categories"]
    )
    category_names = [cat["name"] for cat in rules["categories"]]

    prompt_block = {
        "type": "text",
        "text": (
            f"Classify this document into one of these categories:\n\n"
            f"{categories_text}\n\n"
            f"If the document doesn't clearly match any category, respond with \"unclassified\".\n\n"
            f"Document filename: {file_name}\n\n"
            f"Respond with ONLY the exact category name, nothing else."
        ),
    }

    response = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=256,
        messages=[{"role": "user", "content": content_blocks + [prompt_block]}],
    )

    result = response.content[0].text.strip()

    # Fuzzy match against known categories
    for name in category_names:
        if result.lower() == name.lower():
            return name
    return "unclassified"
