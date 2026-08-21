#!/usr/bin/env python3
"""把绘本插画压成适合手机加载的 webp。

用法：
    python3 tools/compress_images.py books/

默认：长边 ≤ 800px，webp quality=52。只覆盖压得更小的文件。
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

MAX_SIDE = 800
QUALITY = 52


def compress_one(path: Path, max_side: int, quality: int) -> tuple[int, int]:
    orig = path.stat().st_size
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    tmp = path.with_suffix(".webp.tmp")
    im.save(tmp, "WEBP", quality=quality, method=6)
    new = tmp.stat().st_size
    if new < orig:
        tmp.replace(path)
        return orig, new
    tmp.unlink(missing_ok=True)
    return orig, orig


def main() -> int:
    parser = argparse.ArgumentParser(description="压缩绘本 webp 插画")
    parser.add_argument("root", nargs="?", default="books", help="要扫描的目录")
    parser.add_argument("--max-side", type=int, default=MAX_SIDE)
    parser.add_argument("--quality", type=int, default=QUALITY)
    args = parser.parse_args()

    root = Path(args.root)
    files = sorted(root.rglob("*.webp"))
    if not files:
        print("没有找到 webp 文件", file=sys.stderr)
        return 1

    before = after = 0
    for path in files:
        o, n = compress_one(path, args.max_side, args.quality)
        before += o
        after += n
        if n < o:
            print(f"  {path}  {o/1024:.0f}KB → {n/1024:.0f}KB")
    print(f"合计 {len(files)} 张  {before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB  "
          f"(约 {100*(1-after/before):.0f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
