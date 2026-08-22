/* 书架清单：按分类上架。新故事加到对应分类的 books 数组即可。 */
window.loadBooks([
  {
    id: "ai",
    name: "AI 故事",
    hint: "新编的小童话，点不认识的字就能看到拼音。",
    books: [
      "books/xiao-huo-long/book.js",
      "books/wo-niu-kuai-di/book.js",
      "books/xing-xing-diao-xia-lai/book.js",
      "books/hai-xiu-bian-se-long/book.js"
    ]
  },
  {
    id: "original",
    name: "自编故事",
    hint: "用家里的玩偶和小动物当主人公，自己演的故事。",
    books: [
      "books/dong-wu-wang-guo-kai-da-hui/book.js",
      "books/wu-yi-he-shui-ta/book.js",
      "books/tai-feng-bai-hai-tun/book.js"
    ]
  },
  {
    id: "ink",
    name: "水墨中国故事",
    hint: "水墨风的中国经典故事。",
    books: [
      "books/shen-bi-ma-liang/book.js",
      "books/san-ge-he-shang/book.js",
      "books/kong-rong-rang-li/book.js",
      "books/tie-zhu-mo-cheng-zhen/book.js",
      "books/si-ma-guang-za-gang/book.js",
      "books/han-hao-niao/book.js"
    ]
  },
  {
    id: "classic",
    name: "经典童话",
    hint: "大家熟悉的寓言和课文故事。",
    books: [
      "books/gui-tu-sai-pao/book.js",
      "books/wu-ya-he-shui/book.js",
      "books/xiao-ma-guo-he/book.js",
      "books/nong-fu-he-jin-yu/book.js",
      "books/huang-di-de-xin-zhuang/book.js",
      "books/lang-lai-le/book.js"
    ]
  }
]);
