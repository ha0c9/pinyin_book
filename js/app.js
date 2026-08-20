/* 书架与路由：加载 books/index.js 清单，动态注入各 book.js */
(function () {
  var books = [];
  var domReady = false;
  var pendingScripts = 0;

  /* 每本书的 book.js 调用此函数完成注册。
     利用 document.currentScript 推断该书所在目录，用于解析图片相对路径。 */
  window.registerBook = function (data) {
    var src = document.currentScript ? document.currentScript.getAttribute("src") : "";
    data.basePath = src.slice(0, src.lastIndexOf("/") + 1);

    var err = validateBook(data);
    if (err) {
      console.error("[点读绘本屋] 故事《" + (data.title || data.id) + "》数据有误：" + err);
    }
    books.push(data);
  };

  function validateBook(data) {
    if (!data.id || !data.title) return "缺少 id 或 title";
    if (!Array.isArray(data.pages) || data.pages.length === 0) return "缺少 pages";
    for (var i = 0; i < data.pages.length; i++) {
      var p = data.pages[i];
      var chars = Array.from(p.text || "");
      if (!Array.isArray(p.pinyin) || p.pinyin.length !== chars.length) {
        return "第 " + (i + 1) + " 页 pinyin 数组长度(" +
          (p.pinyin ? p.pinyin.length : 0) + ")与文字字数(" + chars.length + ")不一致";
      }
    }
    return null;
  }

  /* books/index.js 调用此函数，传入所有 book.js 路径 */
  window.loadBooks = function (paths) {
    pendingScripts = paths.length;
    if (pendingScripts === 0) { tryRenderShelf(); return; }
    paths.forEach(function (path) {
      var s = document.createElement("script");
      s.src = path;
      s.onload = s.onerror = function () {
        pendingScripts--;
        tryRenderShelf();
      };
      document.body.appendChild(s);
    });
  };

  function tryRenderShelf() {
    if (domReady && pendingScripts === 0) renderShelf();
  }

  /* ---- 视图切换 ---- */
  function showShelf() {
    document.getElementById("reader-view").classList.add("hidden");
    document.getElementById("shelf-view").classList.remove("hidden");
    window.Reader.close();
  }

  function openBook(book) {
    document.getElementById("shelf-view").classList.add("hidden");
    document.getElementById("reader-view").classList.remove("hidden");
    window.Reader.open(book);
  }

  /* ---- 书架渲染 ---- */
  function renderShelf() {
    var grid = document.getElementById("shelf-grid");
    grid.innerHTML = "";

    if (books.length === 0) {
      grid.innerHTML = '<p style="color:#9c8a72">书架还是空的，请按 README 的说明添加故事。</p>';
      return;
    }

    books.forEach(function (book) {
      var card = document.createElement("button");
      card.className = "book-card";

      var img = document.createElement("img");
      img.alt = book.title;
      img.src = book.basePath + (book.cover || "");
      img.onerror = function () { img.style.visibility = "hidden"; };
      card.appendChild(img);

      var title = document.createElement("div");
      title.className = "card-title";
      title.textContent = book.title;
      card.appendChild(title);

      var meta = document.createElement("div");
      meta.className = "card-meta";
      meta.textContent = book.pages.length + " 页" + (book.grade ? " · 适合" + book.grade + "年级" : "");
      card.appendChild(meta);

      card.addEventListener("click", function () { openBook(book); });
      grid.appendChild(card);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    domReady = true;
    document.getElementById("back-btn").addEventListener("click", showShelf);
    tryRenderShelf();
  });
})();
