# 点读绘本屋（pinyin_book）

给小朋友读的汉字绘本网站：有故事、有配图，**不认识的字点一下，上方出现拼音**，
过一会儿自动消失（时长可设置）。

## 怎么用

把整个文件夹拷贝到任何电脑，用浏览器（Chrome / Edge / Safari）**双击打开 `index.html`** 即可，
无需联网、无需安装任何软件。

- 书架页点封面开始阅读；
- 阅读页点不认识的字，字的上方弹出拼音气泡，自动消失；
- 左右按钮 / 键盘方向键 / 触屏滑动翻页；
- 右上角 ⚙️ 设置：拼音停留时间（3/5/10/30 秒或不消失）、字号、整页拼音辅助模式；
- 自动记住每本书上次读到的页码。

## 内置范本故事

| 故事 | 页数 | 简介 |
|---|---|---|
| 爱打喷嚏的小火龙 | 7 页 | 打喷嚏会喷火的小火龙，从闯祸到帮大家点燃篝火、爆爆米花 |
| 蜗牛快递员 | 8 页 | 最慢的快递员，送出了一份"路上开了花"的最棒快递 |

配图为程序生成的扁平插画（`tools/gen_placeholder_art.py`），可随时用 AI 文生图同名替换。

## 添加新故事

三步上架，不用改代码：

1. 新建 `books/<故事id>/` 文件夹，放入 `story.json`（文字）和 `images/`（配图）；
2. 运行 `python3 tools/make_book.py books/<故事id>/story.json` 生成带逐字拼音的 `book.js`（并人工核对多音字）；
3. 在 `books/index.js` 里追加一行该书的路径。

故事文字、拼音、配图都可以用 AI 生成，提示词模板见 [`tools/prompt-template.md`](tools/prompt-template.md)。
整体设计说明见 [`docs/实施概要.md`](docs/实施概要.md)。

## 目录结构

```
index.html            入口（书架 + 阅读器，单页应用）
css/style.css         样式
js/app.js             书架与数据加载
js/reader.js          阅读器、点字出拼音
js/settings.js        设置面板（localStorage 持久化）
books/index.js        书架清单
books/<故事id>/       每本书：story.json（源文件）、book.js（生成）、images/
tools/make_book.py    story.json → book.js（自动逐字注音 + 一/不变调）
tools/gen_placeholder_art.py  范本书插画生成器
tools/prompt-template.md      AI 内容生成提示词模板
```

> 技术说明：数据文件采用 `.js` 而非 `.json`，是因为浏览器在 `file://` 协议下
> 禁止 `fetch` 读取本地文件；用 `<script>` 标签加载数据才能做到"双击即用"。
