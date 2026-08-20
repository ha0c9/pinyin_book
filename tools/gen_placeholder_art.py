#!/usr/bin/env python3
"""
为范本故事生成扁平风格的 SVG 场景插画（占位配图，可日后用 AI 文生图同名替换）。

用法：python3 tools/gen_placeholder_art.py
"""
from pathlib import Path

W, H = 800, 600


# ---------- 基础元素 ----------

def sky(c1, c2):
    return f'''<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/>
    </linearGradient></defs>
    <rect width="{W}" height="{H}" fill="url(#sky)"/>'''


def sun(x=680, y=90, r=46, color="#ffd54f"):
    rays = "".join(
        f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y}" transform="rotate({a} {x} {y}) translate(0 -{r + 22})" '
        f'stroke="{color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="14 100"/>'
        for a in range(0, 360, 45))
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>{rays}'


def cloud(x, y, s=1.0, color="#ffffff", op=0.95):
    return f'''<g transform="translate({x} {y}) scale({s})" fill="{color}" opacity="{op}">
      <ellipse cx="0" cy="0" rx="52" ry="26"/>
      <ellipse cx="-38" cy="8" rx="34" ry="20"/>
      <ellipse cx="40" cy="8" rx="36" ry="20"/>
      <ellipse cx="4" cy="-16" rx="30" ry="20"/>
    </g>'''


def hill(y, color, bulge=120):
    return f'<path d="M0 {y + bulge} Q {W / 2} {y - bulge} {W} {y + bulge} L {W} {H} L 0 {H} Z" fill="{color}"/>'


def ground(color="#a5d6a7", y=430):
    return f'<rect x="0" y="{y}" width="{W}" height="{H - y}" fill="{color}"/>'


def tree(x, y, s=1.0, leaf="#66bb6a"):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <rect x="-9" y="-10" width="18" height="52" rx="8" fill="#8d6e63"/>
      <circle cx="0" cy="-46" r="42" fill="{leaf}"/>
      <circle cx="-32" cy="-24" r="28" fill="{leaf}"/>
      <circle cx="32" cy="-24" r="28" fill="{leaf}"/>
    </g>'''


def flower_dot(x, y, color="#f48fb1"):
    petals = "".join(f'<circle cx="0" cy="-8" r="6" fill="{color}" transform="rotate({a} {0} {0}) translate(0 0)"/>'
                     for a in range(0, 360, 72))
    return f'<g transform="translate({x} {y})">{petals}<circle r="5" fill="#ffd54f"/></g>'


def snow(n=40, seed=7):
    dots, v = [], seed
    for i in range(n):
        v = (v * 48271) % 2147483647
        x = v % W
        v = (v * 48271) % 2147483647
        y = v % (H - 150)
        v = (v * 48271) % 2147483647
        r = 3 + v % 4
        dots.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" opacity="0.9"/>')
    return "".join(dots)


def rain(n=34, seed=3):
    drops, v = [], seed
    for i in range(n):
        v = (v * 48271) % 2147483647
        x = v % W
        v = (v * 48271) % 2147483647
        y = v % (H - 200)
        drops.append(f'<line x1="{x}" y1="{y}" x2="{x - 6}" y2="{y + 22}" '
                     f'stroke="#90caf9" stroke-width="4" stroke-linecap="round" opacity="0.8"/>')
    return "".join(drops)


def smoke(x, y, s=1.0, color="#b0bec5"):
    return f'''<g transform="translate({x} {y}) scale({s})" fill="none" stroke="{color}"
      stroke-width="7" stroke-linecap="round" opacity="0.85">
      <path d="M0 0 q -14 -22 0 -42 q 14 -20 0 -40"/>
      <path d="M26 6 q -12 -18 0 -36 q 12 -18 0 -34"/>
    </g>'''


def flame(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <path d="M0 0 C -26 -18 -20 -52 0 -70 C 20 -52 26 -18 0 0 Z" fill="#ff7043"/>
      <path d="M0 -6 C -14 -18 -11 -38 0 -50 C 11 -38 14 -18 0 -6 Z" fill="#ffca28"/>
    </g>'''


def campfire(x, y, s=1.0, lit=True):
    logs = f'''<g stroke="#8d6e63" stroke-width="14" stroke-linecap="round">
      <line x1="-40" y1="20" x2="40" y2="44"/>
      <line x1="40" y1="20" x2="-40" y2="44"/>
      <line x1="-48" y1="36" x2="48" y2="36"/>
    </g>'''
    fire = flame(0, 16, 1.25) if lit else smoke(0, 8, 0.7)
    return f'<g transform="translate({x} {y}) scale({s})">{logs}{fire}</g>'


def eye(x, y, r=7, closed=False):
    if closed:
        return f'<path d="M{x - r} {y} q {r} {r * 0.9} {2 * r} 0" stroke="#4a3b2a" stroke-width="4" fill="none" stroke-linecap="round"/>'
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#4a3b2a"/><circle cx="{x + 2}" cy="{y - 2}" r="{r * 0.35}" fill="#fff"/>'


def mouth_smile(x, y, w=22):
    return f'<path d="M{x - w} {y} q {w} {w * 0.8} {2 * w} 0" stroke="#4a3b2a" stroke-width="5" fill="none" stroke-linecap="round"/>'


def mouth_o(x, y, r=10):
    return f'<ellipse cx="{x}" cy="{y}" rx="{r * 0.8}" ry="{r}" fill="#4a3b2a"/>'


# ---------- 角色 ----------

def dragon(x, y, s=1.0, mood="happy", sneeze=False, flip=False):
    """小火龙嘟嘟：橘红色圆身体、米黄肚皮、小翅膀、头顶小角。"""
    face = ""
    if mood == "happy":
        face = eye(-22, -26) + eye(22, -26) + mouth_smile(0, 2)
    elif mood == "sad":
        face = eye(-22, -26, closed=True) + eye(22, -26, closed=True) + \
            f'<path d="M-16 8 q 16 -12 32 0" stroke="#4a3b2a" stroke-width="5" fill="none" stroke-linecap="round"/>' + \
            f'<circle cx="34" cy="-14" r="5" fill="#81d4fa"/>'
    elif mood == "sneeze":
        face = eye(-22, -26, closed=True) + eye(22, -26, closed=True) + mouth_o(0, 6, 12)
    elif mood == "surprised":
        face = eye(-22, -26, 9) + eye(22, -26, 9) + mouth_o(0, 6, 9)
    fl = flame(66, -8, 0.7) if sneeze else ""
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="0" cy="96" rx="58" ry="14" fill="rgba(0,0,0,0.08)"/>
      <path d="M-58 40 q -34 6 -44 -16 q 22 4 30 -6" fill="#ef6c00"/>
      <ellipse cx="0" cy="40" rx="62" ry="58" fill="#f57c00"/>
      <ellipse cx="0" cy="52" rx="38" ry="40" fill="#ffe0b2"/>
      <ellipse cx="-30" cy="92" rx="16" ry="12" fill="#ef6c00"/>
      <ellipse cx="30" cy="92" rx="16" ry="12" fill="#ef6c00"/>
      <path d="M-60 18 q -26 -4 -30 -26 q 20 0 32 10 Z" fill="#ffb74d"/>
      <circle cx="0" cy="-16" r="52" fill="#f57c00"/>
      <path d="M-20 -62 q -4 -22 12 -30 q 6 16 -2 28 Z" fill="#ffd54f"/>
      <path d="M14 -64 q 2 -20 18 -24 q 2 14 -8 24 Z" fill="#ffd54f"/>
      <ellipse cx="44" cy="-2" rx="18" ry="13" fill="#ffb74d"/>
      <circle cx="50" cy="-6" r="3.4" fill="#4a3b2a"/>
      {face}{fl}
    </g>'''


def snail(x, y, s=1.0, cap=True, shell_extra="", mood="happy", flip=False):
    """小蜗牛慢慢：棕色螺旋壳、蓝色快递帽。shell_extra 在壳顶加种子/芽/花。"""
    face = eye(64, -34, 5) + eye(84, -34, 5) + mouth_smile(74, -18, 9) if mood == "happy" else \
        eye(64, -34, 5) + eye(84, -34, 5) + mouth_o(74, -14, 6)
    cap_svg = '''<g>
      <path d="M52 -52 a 24 24 0 0 1 46 0 Z" fill="#5b8def"/>
      <rect x="46" y="-54" width="58" height="9" rx="4.5" fill="#3f6cd6"/>
    </g>''' if cap else ""
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="10" cy="34" rx="86" ry="12" fill="rgba(0,0,0,0.08)"/>
      <path d="M-70 28 Q -70 -6 -30 -6 L 66 -6 Q 96 -6 96 12 Q 96 30 70 30 Z" fill="#aed581"/>
      <path d="M62 -2 q 6 -34 12 -44" stroke="#aed581" stroke-width="14" fill="none" stroke-linecap="round"/>
      <circle cx="74" cy="-30" r="26" fill="#aed581"/>
      <line x1="62" y1="-52" x2="56" y2="-68" stroke="#aed581" stroke-width="5" stroke-linecap="round"/>
      <line x1="86" y1="-52" x2="92" y2="-68" stroke="#aed581" stroke-width="5" stroke-linecap="round"/>
      <circle cx="56" cy="-70" r="5" fill="#aed581"/><circle cx="92" cy="-70" r="5" fill="#aed581"/>
      <circle cx="-14" cy="-26" r="52" fill="#bf8f5f"/>
      <path d="M-14 -26 m 34 0 a 34 34 0 1 1 -34 -34 a 24 24 0 1 1 -24 24 a 14 14 0 1 0 14 -14"
        fill="none" stroke="#8d6242" stroke-width="9" stroke-linecap="round"/>
      {shell_extra}{cap_svg}{face}
    </g>'''


def bunny(x, y, s=1.0, mood="happy", scarf=None, flip=False):
    face = eye(-11, -6, 5) + eye(11, -6, 5) + (mouth_smile(0, 8, 8) if mood != "sad" else mouth_o(0, 10, 5))
    sc = f'<rect x="-24" y="20" width="48" height="12" rx="6" fill="{scarf}"/>' if scarf else ""
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="0" cy="66" rx="34" ry="8" fill="rgba(0,0,0,0.08)"/>
      <ellipse cx="-13" cy="-46" rx="10" ry="26" fill="#fafafa"/>
      <ellipse cx="13" cy="-46" rx="10" ry="26" fill="#fafafa"/>
      <ellipse cx="-13" cy="-46" rx="5" ry="17" fill="#f8bbd0"/>
      <ellipse cx="13" cy="-46" rx="5" ry="17" fill="#f8bbd0"/>
      <ellipse cx="0" cy="36" rx="26" ry="30" fill="#fafafa"/>
      <circle cx="0" cy="-2" r="26" fill="#fafafa"/>
      <circle cx="0" cy="2" r="4" fill="#f48fb1"/>
      {face}{sc}
    </g>'''


def bear(x, y, s=1.0, mood="happy", scarf=None, shawl=False, flip=False):
    face = eye(-12, -8, 5) + eye(12, -8, 5) + mouth_smile(0, 10, 9)
    sc = f'<rect x="-30" y="26" width="60" height="13" rx="6" fill="{scarf}"/>' if scarf else ""
    sh = '<path d="M-34 14 L 0 52 L 34 14 Q 0 30 -34 14 Z" fill="#ce93d8"/>' if shawl else ""
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="0" cy="78" rx="40" ry="9" fill="rgba(0,0,0,0.08)"/>
      <circle cx="-22" cy="-28" r="12" fill="#a1887f"/>
      <circle cx="22" cy="-28" r="12" fill="#a1887f"/>
      <ellipse cx="0" cy="42" rx="34" ry="36" fill="#a1887f"/>
      <ellipse cx="0" cy="50" rx="20" ry="24" fill="#d7ccc8"/>
      <circle cx="0" cy="-4" r="30" fill="#a1887f"/>
      <ellipse cx="0" cy="4" rx="12" ry="9" fill="#d7ccc8"/>
      <circle cx="0" cy="0" r="4.5" fill="#4a3b2a"/>
      {face}{sh}{sc}
    </g>'''


def squirrel(x, y, s=1.0, flip=False):
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="0" cy="56" rx="28" ry="7" fill="rgba(0,0,0,0.08)"/>
      <path d="M20 30 q 42 6 34 -44 q -4 -26 -30 -22 q 18 10 12 34 q -4 20 -16 24 Z" fill="#d17f4d"/>
      <ellipse cx="0" cy="30" rx="20" ry="24" fill="#e29b6c"/>
      <circle cx="0" cy="-4" r="20" fill="#e29b6c"/>
      <path d="M-14 -18 l -4 -12 l 10 6 Z" fill="#d17f4d"/>
      <path d="M14 -18 l 4 -12 l -10 6 Z" fill="#d17f4d"/>
      {eye(-8, -6, 4)}{eye(8, -6, 4)}{mouth_smile(0, 4, 6)}
    </g>'''


def monkey(x, y, s=1.0, running=False, flip=False):
    lines = '''<g stroke="#b0bec5" stroke-width="5" stroke-linecap="round" opacity="0.8">
      <line x1="-66" y1="-10" x2="-96" y2="-10"/><line x1="-62" y1="8" x2="-88" y2="8"/>
      <line x1="-66" y1="26" x2="-96" y2="26"/></g>''' if running else ""
    flip_t = "scale(-1 1)" if flip else ""
    return f'''<g transform="translate({x} {y}) scale({s}) {flip_t}">
      <ellipse cx="0" cy="62" rx="32" ry="8" fill="rgba(0,0,0,0.08)"/>
      <path d="M28 30 q 34 4 30 -30" stroke="#8d6e63" stroke-width="9" fill="none" stroke-linecap="round"/>
      <ellipse cx="0" cy="32" rx="24" ry="28" fill="#8d6e63"/>
      <ellipse cx="0" cy="38" rx="14" ry="18" fill="#ffe0b2"/>
      <circle cx="-24" cy="-12" r="11" fill="#8d6e63"/>
      <circle cx="24" cy="-12" r="11" fill="#8d6e63"/>
      <circle cx="0" cy="-6" r="22" fill="#8d6e63"/>
      <ellipse cx="0" cy="0" rx="15" ry="12" fill="#ffe0b2"/>
      {eye(-8, -10, 4)}{eye(8, -10, 4)}{mouth_smile(0, 2, 7)}
      {lines}
    </g>'''


# ---------- 道具 ----------

def seed(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <ellipse cx="0" cy="0" rx="12" ry="16" fill="#8d6242"/>
      <path d="M0 -14 q 6 -10 0 -18" stroke="#66bb6a" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>'''


def sprout(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <path d="M0 0 L 0 -34" stroke="#66bb6a" stroke-width="7" stroke-linecap="round"/>
      <path d="M0 -22 q -24 -6 -26 -28 q 24 2 26 28 Z" fill="#81c784"/>
      <path d="M0 -30 q 24 -4 28 -26 q -24 0 -28 26 Z" fill="#66bb6a"/>
    </g>'''


def big_flower(x, y, s=1.0):
    petals = "".join(f'<ellipse cx="0" cy="-30" rx="14" ry="22" fill="#ffca28" transform="rotate({a})"/>'
                     for a in range(0, 360, 45))
    return f'''<g transform="translate({x} {y}) scale({s})">
      <path d="M0 40 L 0 -6" stroke="#66bb6a" stroke-width="8" stroke-linecap="round"/>
      <path d="M0 24 q -20 -4 -24 -22 q 20 2 24 22 Z" fill="#81c784"/>
      <g>{petals}<circle r="15" fill="#ef6c00"/></g>
    </g>'''


def book_with_hole(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <rect x="-52" y="-34" width="104" height="68" rx="7" fill="#fffde7" stroke="#e0cda9" stroke-width="4"/>
      <line x1="0" y1="-30" x2="0" y2="30" stroke="#e0cda9" stroke-width="4"/>
      <g stroke="#d7ccc8" stroke-width="4" stroke-linecap="round">
        <line x1="-40" y1="-16" x2="-14" y2="-16"/><line x1="-40" y1="0" x2="-14" y2="0"/>
        <line x1="14" y1="-16" x2="40" y2="-16"/>
      </g>
      <path d="M12 2 q 12 -10 26 -2 q 10 8 2 18 q -10 10 -22 4 q -12 -6 -6 -20 Z" fill="#4a3b2a"/>
      {smoke(28, -2, 0.5)}
    </g>'''


def dandelion(x, y, s=1.0):
    fluff = "".join(f'<line x1="0" y1="0" x2="0" y2="-16" stroke="#eceff1" stroke-width="2.5" '
                    f'transform="rotate({a})" stroke-linecap="round"/>' for a in range(0, 360, 30))
    return f'''<g transform="translate({x} {y}) scale({s})">
      {fluff}<circle r="6" fill="#cfd8dc"/>
    </g>'''


def pot(x, y, s=1.0, popping=True):
    pops = "".join(f'<circle cx="{dx}" cy="{dy}" r="{r}" fill="#fffde7" stroke="#ffe082" stroke-width="2"/>'
                   for dx, dy, r in [(-40, -70, 9), (-12, -96, 11), (20, -78, 9), (46, -100, 10),
                                     (0, -64, 8), (-58, -96, 8), (60, -70, 8)]) if popping else ""
    return f'''<g transform="translate({x} {y}) scale({s})">
      <path d="M-56 -20 L 56 -20 L 46 34 Q 0 44 -46 34 Z" fill="#546e7a"/>
      <rect x="-66" y="-26" width="132" height="12" rx="6" fill="#455a64"/>
      {pops}
    </g>'''


def house(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <rect x="-90" y="-40" width="180" height="120" rx="8" fill="#ffe0b2"/>
      <path d="M-104 -36 L 0 -110 L 104 -36 Z" fill="#ef6c00"/>
      <rect x="-24" y="10" width="48" height="70" rx="6" fill="#8d6e63"/>
      <circle cx="12" cy="46" r="4" fill="#ffd54f"/>
      <rect x="-74" y="0" width="34" height="30" rx="5" fill="#b3e5fc" stroke="#fff" stroke-width="4"/>
      <rect x="40" y="0" width="34" height="30" rx="5" fill="#b3e5fc" stroke="#fff" stroke-width="4"/>
      <rect x="-46" y="-84" width="92" height="26" rx="13" fill="#5b8def"/>
      <circle cx="-32" cy="-71" r="6" fill="#fff"/><circle cx="-12" cy="-71" r="6" fill="#fff"/>
      <circle cx="8" cy="-71" r="6" fill="#fff"/><circle cx="28" cy="-71" r="6" fill="#fff"/>
    </g>'''


def package(x, y, s=1.0):
    return f'''<g transform="translate({x} {y}) scale({s})">
      <rect x="-22" y="-18" width="44" height="36" rx="5" fill="#d7a86e"/>
      <line x1="0" y1="-18" x2="0" y2="18" stroke="#8d6242" stroke-width="5"/>
      <line x1="-22" y1="0" x2="22" y2="0" stroke="#8d6242" stroke-width="5"/>
    </g>'''


def grass_tuft(x, y, s=1.0):
    blades = "".join(f'<path d="M{dx} 0 q {q} -28 {q * 2} -44" stroke="#7cb342" stroke-width="7" '
                     f'fill="none" stroke-linecap="round"/>' for dx, q in [(-30, -6), (-12, -2), (6, 3), (24, 7)])
    return f'<g transform="translate({x} {y}) scale({s})">{blades}</g>'


def heart(x, y, s=1.0, color="#f48fb1"):
    return f'''<path transform="translate({x} {y}) scale({s})" fill="{color}"
      d="M0 6 C -10 -6 -22 2 -16 12 C -12 19 0 26 0 26 C 0 26 12 19 16 12 C 22 2 10 -6 0 6 Z"/>'''


def confetti(seed=11, n=26):
    colors = ["#f48fb1", "#ffd54f", "#81d4fa", "#aed581", "#ce93d8"]
    out, v = [], seed
    for i in range(n):
        v = (v * 48271) % 2147483647; x = v % W
        v = (v * 48271) % 2147483647; y = v % 320
        v = (v * 48271) % 2147483647; c = colors[v % len(colors)]
        v = (v * 48271) % 2147483647; r = 5 + v % 5
        out.append(f'<rect x="{x}" y="{y}" width="{r}" height="{r * 1.6}" rx="2" fill="{c}" '
                   f'transform="rotate({(v % 90) - 45} {x} {y})"/>')
    return "".join(out)


def svg(*parts):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'font-family="sans-serif">' + "".join(parts) + "</svg>")


# ---------- 故事一：爱打喷嚏的小火龙 ----------

def book1(out: Path):
    pages = {}
    # p1 草地上打喷嚏喷出火苗
    pages["p1"] = svg(
        sky("#bde3ff", "#eaf7ff"), sun(), cloud(150, 100), cloud(560, 160, 0.8),
        ground(), hill(430, "#8fce91"),
        tree(90, 470, 1.0), tree(720, 490, 0.8, "#81c784"),
        flower_dot(200, 540), flower_dot(620, 560, "#ce93d8"), flower_dot(420, 575, "#ffd54f"),
        dragon(400, 400, 1.35, mood="sneeze", sneeze=True))
    # p2 教室里烧了作业本
    pages["p2"] = svg(
        '<rect width="800" height="600" fill="#fff3e0"/>',
        '<rect x="0" y="430" width="800" height="170" fill="#d7a86e"/>',
        '<rect x="60" y="80" width="300" height="180" rx="10" fill="#4a6b52"/>',
        '<rect x="60" y="80" width="300" height="180" rx="10" fill="none" stroke="#8d6242" stroke-width="10"/>',
        '<rect x="120" y="340" width="380" height="24" rx="10" fill="#a9743f"/>',
        '<rect x="150" y="364" width="22" height="90" fill="#8d6242"/><rect x="450" y="364" width="22" height="90" fill="#8d6242"/>',
        book_with_hole(310, 310, 1.0),
        dragon(120, 400, 0.95, mood="sad"),
        bunny(430, 400, 1.0, mood="sad"),
        bear(640, 400, 0.85), squirrel(740, 430, 0.85),
        )
    # p3 山顶练习憋喷嚏
    pages["p3"] = svg(
        sky("#a8d8f5", "#e3f4ff"), cloud(180, 110, 1.2), cloud(600, 90, 1.0), cloud(430, 200, 0.7),
        hill(400, "#9e9d8f", 220), hill(500, "#7aa87c", 160),
        dragon(400, 380, 1.25, mood="sneeze"),
        dandelion(510, 300, 1.2),
        )
    # p4 雪地里点不着火柴
    pages["p4"] = svg(
        sky("#90a4c8", "#cfd8e6"), snow(),
        ground("#eef3f8", 440), hill(460, "#e2eaf2", 90),
        tree(90, 480, 0.9, "#b7cdbf"), tree(710, 500, 0.75, "#b7cdbf"),
        campfire(400, 470, 1.1, lit=False),
        bunny(240, 430, 1.0, scarf="#ef5350"),
        bear(560, 420, 0.95, scarf="#5b8def"),
        squirrel(320, 500, 0.9, flip=True),
        )
    # p5 喷嚏点燃篝火
    pages["p5"] = svg(
        sky("#6f7fb0", "#b4c2dd"), snow(24, 19),
        ground("#eef3f8", 440), hill(460, "#e2eaf2", 90),
        campfire(500, 460, 1.3, lit=True),
        f'<circle cx="500" cy="470" r="150" fill="#ffca28" opacity="0.15"/>',
        dragon(210, 410, 1.15, mood="sneeze", sneeze=True),
        )
    # p6 爆米花派对
    pages["p6"] = svg(
        sky("#7986cb", "#c5cae9"),
        ground("#eef3f8", 440), hill(460, "#e2eaf2", 90),
        f'<circle cx="240" cy="490" r="100" fill="#ffe082" opacity="0.3"/>',
        campfire(240, 480, 0.9, lit=True),
        pot(480, 470, 1.1, popping=True),
        dragon(120, 420, 0.95, mood="happy"),
        bunny(650, 430, 0.95, scarf="#ef5350"),
        bear(740, 420, 0.8, scarf="#5b8def"),
        squirrel(590, 500, 0.85),
        )
    # p7 大团圆
    pages["p7"] = svg(
        sky("#bde3ff", "#eaf7ff"), sun(120, 90), cloud(600, 110, 0.9),
        ground(), hill(430, "#8fce91"),
        flower_dot(120, 560), flower_dot(700, 550, "#ce93d8"), flower_dot(300, 580, "#ffd54f"),
        dragon(320, 400, 1.15, mood="happy"),
        bunny(520, 420, 1.0), bear(650, 410, 0.9), squirrel(740, 460, 0.9),
        heart(430, 200, 1.6), heart(520, 150, 1.1, "#ef9a9a"), heart(360, 130, 1.0, "#ce93d8"),
        )
    write_pages(out, pages, cover_of="p1")


# ---------- 故事二：蜗牛快递员 ----------

def book2(out: Path):
    pages = {}
    path_road = ('<path d="M-20 600 Q 300 480 460 520 Q 640 560 820 480" stroke="#e8d5ae" '
                 'stroke-width="70" fill="none" stroke-linecap="round"/>')
    # p1 快递店门口报到
    pages["p1"] = svg(
        sky("#bde3ff", "#eaf7ff"), sun(), cloud(180, 110),
        ground(), hill(430, "#8fce91"),
        house(560, 330, 1.15),
        tree(80, 470, 1.0),
        snail(230, 500, 1.1),
        flower_dot(390, 570), flower_dot(120, 580, "#ffd54f"),
        )
    # p2 猴子快 蜗牛慢
    pages["p2"] = svg(
        sky("#bde3ff", "#eaf7ff"), cloud(360, 90, 1.0), sun(700, 80, 40),
        ground(), path_road,
        monkey(560, 420, 1.05, running=True),
        f'<g transform="translate(596 340) rotate(12)"><rect x="-16" y="-11" width="32" height="22" rx="3" fill="#fffde7" stroke="#e0cda9" stroke-width="3"/></g>',
        snail(160, 520, 0.95),
        bunny(730, 470, 0.9, flip=True), squirrel(660, 520, 0.85, flip=True),
        tree(70, 460, 0.95),
        )
    # p3 熊奶奶寄种子
    pages["p3"] = svg(
        sky("#bde3ff", "#eaf7ff"), cloud(560, 110, 1.0),
        hill(360, "#b5c9b7", 80),
        ground(), hill(430, "#8fce91"),
        house(140, 350, 0.9),
        bear(560, 400, 1.25, shawl=True),
        package(470, 470, 1.0), seed(470, 452, 0.8),
        snail(260, 510, 1.0),
        )
    # p4 种子掉进草丛
    pages["p4"] = svg(
        sky("#bde3ff", "#eaf7ff"), cloud(200, 100, 0.9), cloud(620, 140, 0.7),
        ground(), path_road,
        monkey(280, 420, 1.15, running=True),
        seed(430, 490, 1.0),
        f'''<g stroke="#8d6242" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7">
          <path d="M370 430 q 30 20 52 46" stroke-dasharray="2 14"/></g>''',
        grass_tuft(480, 545, 1.3), grass_tuft(560, 560, 1.0), grass_tuft(410, 570, 0.9),
        tree(720, 470, 0.9),
        )
    # p5 蜗牛背种子出发
    pages["p5"] = svg(
        sky("#bde3ff", "#eaf7ff"), sun(110, 90, 40), cloud(520, 100, 1.0),
        ground(), hill(430, "#8fce91"), path_road,
        snail(340, 500, 1.25, shell_extra=seed(-14, -86, 0.9)),
        flower_dot(660, 560), flower_dot(120, 575, "#ce93d8"),
        tree(730, 470, 0.85),
        )
    # p6 雨中发芽
    pages["p6"] = svg(
        sky("#8fa6c4", "#cdd9e6"), rain(),
        cloud(200, 80, 1.2, "#b0bec5"), cloud(560, 110, 1.0, "#b0bec5"),
        ground("#93bb8f", 440),
        f'<path d="M60 470 q 60 -40 130 -6" stroke="#7fa5c9" stroke-width="10" fill="none" stroke-linecap="round"/>',
        snail(400, 510, 1.25, shell_extra=sprout(-14, -80, 1.0)),
        grass_tuft(680, 560, 1.0),
        )
    # p7 开出金黄小花
    pages["p7"] = svg(
        sky("#bde3ff", "#eaf7ff"), sun(660, 90, 50),
        f'<path d="M40 180 a 220 220 0 0 1 240 -60" stroke="#f48fb1" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.5"/>',
        f'<path d="M60 210 a 200 200 0 0 1 210 -55" stroke="#ffd54f" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.5"/>',
        ground(), hill(430, "#8fce91"),
        snail(380, 500, 1.35, shell_extra=big_flower(-14, -78, 1.05)),
        flower_dot(120, 560), flower_dot(690, 570, "#ce93d8"),
        )
    # p8 生日派对
    pages["p8"] = svg(
        sky("#ffe9c9", "#fff7e8"), confetti(),
        ground("#a5d6a7", 430),
        house(660, 340, 0.85),
        snail(300, 500, 1.15, shell_extra=big_flower(-14, -78, 0.95)),
        bunny(520, 430, 1.05),
        f'<path d="M498 366 L 520 322 L 542 366 Z" fill="#5b8def"/><circle cx="520" cy="322" r="7" fill="#ffd54f"/>',
        bear(120, 410, 0.95, shawl=True), squirrel(620, 500, 0.9, flip=True), monkey(70, 510, 0.8),
        heart(420, 250, 1.4), heart(240, 210, 1.0, "#ce93d8"),
        )
    write_pages(out, pages, cover_of="p7")


def write_pages(out: Path, pages: dict, cover_of: str):
    out.mkdir(parents=True, exist_ok=True)
    for name, content in pages.items():
        (out / f"{name}.svg").write_text(content, encoding="utf-8")
    (out / "cover.svg").write_text(pages[cover_of], encoding="utf-8")
    print(f"{out}: 已生成 {len(pages)} 页插画 + 封面")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    book1(root / "books" / "xiao-huo-long" / "images")
    book2(root / "books" / "wo-niu-kuai-di" / "images")
