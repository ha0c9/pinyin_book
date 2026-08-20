# AI 故事生成提示词模板

把下面的提示词发给任意大模型（ChatGPT、文心一言、豆包等），即可得到一份可直接导入的故事文件。

---

## 一、生成故事文字（story.json）

```
请为小学二年级的孩子写一个原创童话绘本故事，要求：

1. 故事有趣、有起伏：主角有一个小缺点或小烦恼，经历失败，最后用意想不到的方式解决问题，结尾温暖。
2. 全文 300~500 字，分成 7~8 页，每页 20~50 字，一到两句话。
3. 用词限于小学二年级识字量，可以出现少量生字（孩子可以点读拼音）。
4. 拟声词、对话可以多一些，读起来生动。
5. 严格按下面的 JSON 格式输出，不要输出其他内容：

{
  "id": "故事拼音id（小写字母和连字符，如 xiao-huo-long）",
  "title": "故事标题",
  "grade": 2,
  "cover": "images/cover.webp",
  "pages": [
    { "image": "images/p1.webp", "text": "第一页的文字。" },
    { "image": "images/p2.webp", "text": "第二页的文字。" }
  ]
}
```

> 配图默认使用 AI 文生图的 `.webp`；若用 SVG 占位，把扩展名改成 `.svg` 即可。

## 二、生成逐字拼音（book.js）

拿到 story.json 后，在电脑上运行（需要 Python）：

```bash
pip install pypinyin
python3 tools/make_book.py books/<故事id>/story.json
```

脚本会自动生成 `book.js` 并打印逐字注音供核对。**务必人工核对多音字**（重点检查：着、了、得、地、长、行、还、觉、发、背、种），
发现读错的字，在 story.json 对应页加 `"fix": { "字符下标": "正确拼音" }` 后重跑。

没有 Python 环境时，也可以把下面的提示词和 story.json 一起发给大模型，让它直接生成 book.js：

```
请把这份 story.json 转换成 book.js，格式为 window.registerBook({...})。
在每页中增加 "pinyin" 数组：与 text 逐字符一一对应（含标点，标点和非汉字对应空字符串 ""），
使用带声调符号的拼音（如 xiǎo）。多音字必须按上下文选择读音；
轻声字（了、的、着、得、地、们、子 等）标注轻声（无声调符号）；
"一"和"不"按变调标注（如 yí gè、yì tiān、bú shì）。
输出前自己检查每页 pinyin 数组长度是否等于 text 的字符数。
```

## 三、生成配图

每页配一张图，推荐用 AI 文生图（webp/png/jpg），提示词模板：

```
儿童绘本插画，温暖柔和的水彩风格，明亮色彩，圆润可爱的角色，画面中不要出现任何文字。
场景：<该页文字描述的画面>。
主角外形保持一致：<主角的固定外形描述，如"圆滚滚的橘红色小火龙，米黄色肚皮，小翅膀">。
```

图片保存到 `books/<故事id>/images/`，文件名与 story.json 中一致（p1、p2……，封面 cover）。
建议压缩为 webp、长边 ≤ 1280px。现有范本书已使用 AI 水彩图；若暂时无法文生图，可用 `tools/gen_placeholder_art.py` 生成扁平 SVG 占位。

## 四、上架

在 `books/index.js` 中追加一行：

```js
window.loadBooks([
  "books/xiao-huo-long/book.js",
  "books/wo-niu-kuai-di/book.js",
  "books/<新故事id>/book.js"
]);
```

刷新浏览器，新故事就出现在书架上了。
