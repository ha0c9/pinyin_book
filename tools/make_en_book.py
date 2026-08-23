#!/usr/bin/env python3
"""
根据英文故事 story.json 生成 book.js（逐词中文释义）。

用法：
    python3 tools/make_en_book.py books/<故事id>/story.json

story.json 格式：
{
  "id": "where-is-kitty",
  "title": "Where Is Kitty?",
  "lang": "en",
  "grade": 2,
  "cover": "images/cover.webp",
  "glossary": { "little": "小的", "cat": "猫" },
  "pages": [
    { "image": "images/p1.webp", "text": "Lucy has a little cat." }
  ]
}

单词按 glossary 查中文（先精确，再忽略大小写）。
查不到的词会打印警告，仍会输出，但不给 zh（阅读页不可点）。
"""
import json
import re
import sys
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z\s]+|\s+")
WORD_RE = re.compile(r"^[A-Za-z]")


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text) if not t.isspace()]


def lookup(word: str, glossary: dict) -> str:
    if word in glossary:
        return glossary[word]
    lower = word.lower()
    if lower in glossary:
        return glossary[lower]
    # 句首大写：The / A
    title = word[:1].upper() + word[1:].lower()
    if title in glossary:
        return glossary[title]
    return ""


def build_book(story_path: Path) -> Path:
    story = json.loads(story_path.read_text(encoding="utf-8"))
    glossary = story.get("glossary") or {}
    missing = []
    out_pages = []

    for pi, page in enumerate(story["pages"]):
        text = page["text"]
        words = []
        print(f"--- 第 {pi + 1} 页 ---")
        parts = []
        for tok in tokenize(text):
            item = {"en": tok}
            if WORD_RE.match(tok):
                zh = lookup(tok, glossary)
                if zh:
                    item["zh"] = zh
                else:
                    missing.append((pi + 1, tok))
            words.append(item)
            if item.get("zh"):
                parts.append(f"{tok}[{item['zh']}]")
            else:
                parts.append(tok)
        print("  " + " ".join(parts))
        out_pages.append({
            "image": page.get("image", ""),
            "text": text,
            "words": words,
        })

    if missing:
        print("\n警告：下列单词没有中文释义（阅读页将不可点）：")
        for pg, w in missing:
            print(f"  第 {pg} 页  {w}")

    book = {
        "id": story["id"],
        "title": story["title"],
        "lang": "en",
        "grade": story.get("grade", 2),
        "cover": story.get("cover", ""),
        "pages": out_pages,
    }
    out_path = story_path.parent / "book.js"
    js = "window.registerBook(" + json.dumps(book, ensure_ascii=False, indent=2) + ");\n"
    out_path.write_text(js, encoding="utf-8")
    print(f"\n已生成 {out_path}")
    return out_path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    build_book(Path(sys.argv[1]))
