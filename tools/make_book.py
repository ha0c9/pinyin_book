#!/usr/bin/env python3
"""
根据故事描述文件生成 book.js（含逐字拼音）。

用法：
    pip install pypinyin
    python3 tools/make_book.py books/<故事id>/story.json

story.json 格式：
{
  "id": "gu-shi-id",
  "title": "故事标题",
  "grade": 2,
  "cover": "images/cover.webp",
  "pages": [
    { "image": "images/p1.webp", "text": "第一页的文字。" },
    { "image": "images/p2.webp", "text": "第二页的文字。",
      "fix": { "3": "zháo" } }        // 可选：按字符下标修正多音字读音
  ]
}

生成 books/<故事id>/book.js 后，请人工核对打印出来的注音，
多音字如有错误，在 story.json 对应页加 "fix" 修正后重新运行。
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

from pypinyin import pinyin, Style

HANZI_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")

TONE_MARKS_4 = "àèìòùǜǹ"  # 四声韵母（判断 一/不 变调用）


def tone_of(py: str) -> int:
    """返回音节声调 1-4，轻声返回 0。"""
    for ch in py:
        d = unicodedata.decomposition(ch)
        if "0300" in d: return 4
        if "0301" in d: return 2
        if "0304" in d: return 1
        if "030C" in d: return 3
    return 0


def char_pinyins(text: str) -> list:
    """逐字拼音；非汉字（标点、空格、数字）为空串。"""
    chars = list(text)
    result = [""] * len(chars)
    # pypinyin 整句转换以获得上下文消歧能力
    pys = pinyin(text, style=Style.TONE, errors=lambda x: [""] * len(x))
    # pypinyin 对连续非汉字可能合并，稳妥起见逐字对齐
    flat = []
    for item in pys:
        flat.append(item[0])
    if len(flat) != len(chars):
        # 回退：逐字转换
        flat = [pinyin(c, style=Style.TONE)[0][0] if HANZI_RE.match(c) else "" for c in chars]
    for i, c in enumerate(chars):
        result[i] = flat[i] if HANZI_RE.match(c) else ""
    return result


def apply_sandhi(chars: list, pys: list) -> None:
    """儿童读物惯例：一/不 按变调标注。"""
    for i, c in enumerate(chars):
        # 找下一个汉字的声调
        nxt = None
        for j in range(i + 1, len(chars)):
            if pys[j]:
                nxt = tone_of(pys[j])
                break
        if c == "一" and pys[i]:
            prev_is_digit = i > 0 and chars[i - 1] in "一二三四五六七八九十第"
            next_is_digit = nxt is not None and chars[min(i + 1, len(chars) - 1)] in "一二三四五六七八九十月日"
            if prev_is_digit or next_is_digit or nxt is None:
                pys[i] = "yī"       # 序数、数字串、句尾保持原调
            elif nxt == 4:
                pys[i] = "yí"
            elif nxt in (1, 2, 3):
                pys[i] = "yì"
        if c == "不" and pys[i] and nxt == 4:
            pys[i] = "bú"


def build_book(story_path: Path) -> Path:
    story = json.loads(story_path.read_text(encoding="utf-8"))
    out_pages = []

    for pi, page in enumerate(story["pages"]):
        text = page["text"]
        chars = list(text)
        pys = char_pinyins(text)
        apply_sandhi(chars, pys)
        for idx_str, fixed in (page.get("fix") or {}).items():
            pys[int(idx_str)] = fixed

        assert len(pys) == len(chars)
        out_pages.append({"image": page.get("image", ""), "text": text, "pinyin": pys})

        # 打印供人工核对
        print(f"--- 第 {pi + 1} 页 ---")
        print("  " + " ".join(f"{c}[{p}]" if p else c for c, p in zip(chars, pys)))

    book = {
        "id": story["id"],
        "title": story["title"],
        "grade": story.get("grade", 2),
        "cover": story.get("cover", ""),
        "pages": out_pages,
    }
    out_path = story_path.parent / "book.js"
    js = "window.registerBook(" + json.dumps(book, ensure_ascii=False, indent=2) + ");\n"
    out_path.write_text(js, encoding="utf-8")
    print(f"\n已生成 {out_path}（请核对上方注音，多音字有误时在 story.json 加 fix 后重跑）")
    return out_path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    build_book(Path(sys.argv[1]))
