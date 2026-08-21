/* 书架与路由：按分类加载 book.js，封面只在当前分类渲染 */
(function () {
  var booksByPath = {};
  var categories = [];
  var currentCategoryId = null;
  var loadedPaths = {};
  var domReady = false;
  var catalogReady = false;

  var CATEGORY_KEY = "pinyinBook.shelfCategory";

  /* 每本书的 book.js 调用此函数完成注册。
     利用 document.currentScript 推断该书所在目录，用于解析图片相对路径。 */
  window.registerBook = function (data) {
    var src = document.currentScript ? document.currentScript.getAttribute("src") : "";
    data.basePath = src.slice(0, src.lastIndexOf("/") + 1);
    data.scriptPath = src;

    var err = validateBook(data);
    if (err) {
      console.error("[点读绘本屋] 故事《" + (data.title || data.id) + "》数据有误：" + err);
    }
    booksByPath[src] = data;
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

  function normalizeCatalog(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) return [];
    if (typeof catalog[0] === "string") {
      return [{ id: "all", name: "全部故事", hint: "点一本书开始阅读吧！", books: catalog }];
    }
    return catalog.map(function (c, i) {
      return {
        id: c.id || ("cat-" + i),
        name: c.name || "未分组",
        hint: c.hint || "",
        books: c.books || []
      };
    });
  }

  /* books/index.js 调用：分类清单 */
  window.loadBooks = function (catalog) {
    categories = normalizeCatalog(catalog);
    catalogReady = true;
    if (domReady) initShelf();
  };

  function getCategory(id) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === id) return categories[i];
    }
    return categories[0] || null;
  }

  function loadCategoryScripts(cat, done) {
    if (!cat) { done(); return; }
    var pending = 0;
    var finished = false;

    function check() {
      if (finished) return;
      if (pending === 0) {
        finished = true;
        done();
      }
    }

    cat.books.forEach(function (path) {
      if (loadedPaths[path]) return;
      loadedPaths[path] = true;
      pending++;
      var s = document.createElement("script");
      s.src = path;
      s.onload = s.onerror = function () {
        pending--;
        check();
      };
      document.body.appendChild(s);
    });
    check();
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

  /* ---- 分类栏 ---- */
  function renderCategoryBar() {
    var bar = document.getElementById("category-bar");
    bar.innerHTML = "";
    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip";
      btn.dataset.id = cat.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", cat.id === currentCategoryId ? "true" : "false");
      btn.textContent = cat.name;
      btn.addEventListener("click", function () {
        if (cat.id === currentCategoryId) return;
        selectCategory(cat.id);
      });
      bar.appendChild(btn);
    });
  }

  function updateChipState() {
    var chips = document.querySelectorAll(".category-chip");
    chips.forEach(function (chip) {
      var on = chip.dataset.id === currentCategoryId;
      chip.classList.toggle("selected", on);
      chip.setAttribute("aria-selected", on ? "true" : "false");
      chip.tabIndex = on ? 0 : -1;
    });
  }

  function updateHint(cat) {
    var hint = document.getElementById("shelf-hint");
    if (!hint) return;
    hint.textContent = (cat && cat.hint) || "点一本书开始阅读吧！不认识的字，点一下就有拼音哦。";
  }

  function clearCoverLoads(grid) {
    var imgs = grid.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].onload = null;
      imgs[i].onerror = null;
      imgs[i].removeAttribute("src");
    }
    grid.innerHTML = "";
  }

  function renderSkeleton(grid, count) {
    grid.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var sk = document.createElement("div");
      sk.className = "book-card-skeleton";
      sk.setAttribute("aria-hidden", "true");
      grid.appendChild(sk);
    }
  }

  function renderShelf(cat) {
    var grid = document.getElementById("shelf-grid");
    clearCoverLoads(grid);

    if (!cat || cat.books.length === 0) {
      grid.innerHTML = '<p class="shelf-empty">这一架还是空的，请按 README 的说明添加故事。</p>';
      return;
    }

    var shown = 0;
    cat.books.forEach(function (path) {
      var book = booksByPath[path];
      if (!book) return;
      shown++;

      var card = document.createElement("button");
      card.type = "button";
      card.className = "book-card";

      var coverWrap = document.createElement("div");
      coverWrap.className = "card-cover";

      if (book.cover) {
        var img = document.createElement("img");
        img.alt = book.title;
        img.decoding = "async";
        img.draggable = false;
        img.className = "is-loading";
        img.onload = function () { img.classList.remove("is-loading"); };
        img.onerror = function () {
          img.removeAttribute("src");
          coverWrap.classList.add("no-cover");
        };
        img.src = book.basePath + book.cover;
        coverWrap.appendChild(img);
      } else {
        coverWrap.classList.add("no-cover");
      }
      card.appendChild(coverWrap);

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

    if (shown === 0) {
      grid.innerHTML = '<p class="shelf-empty">这一架的故事还在路上，请稍后再看。</p>';
    }
  }

  function selectCategory(id) {
    var cat = getCategory(id);
    if (!cat) return;
    currentCategoryId = cat.id;
    try { localStorage.setItem(CATEGORY_KEY, cat.id); } catch (e) {}

    updateChipState();
    updateHint(cat);

    var grid = document.getElementById("shelf-grid");
    clearCoverLoads(grid);
    renderSkeleton(grid, Math.min(cat.books.length || 1, 4));

    var requested = cat.id;
    loadCategoryScripts(cat, function () {
      if (currentCategoryId !== requested) return;
      renderShelf(cat);
    });
  }

  function initShelf() {
    if (!categories.length) {
      document.getElementById("shelf-grid").innerHTML =
        '<p class="shelf-empty">书架还是空的，请按 README 的说明添加故事。</p>';
      return;
    }

    var saved = null;
    try { saved = localStorage.getItem(CATEGORY_KEY); } catch (e) {}
    var initial = getCategory(saved) ? saved : categories[0].id;

    renderCategoryBar();
    selectCategory(initial);
  }

  document.addEventListener("DOMContentLoaded", function () {
    domReady = true;
    document.getElementById("back-btn").addEventListener("click", showShelf);

    var bar = document.getElementById("category-bar");
    bar.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var chips = Array.prototype.slice.call(bar.querySelectorAll(".category-chip"));
      if (!chips.length) return;
      var idx = chips.findIndex(function (c) { return c.dataset.id === currentCategoryId; });
      if (idx < 0) idx = 0;
      idx += e.key === "ArrowRight" ? 1 : -1;
      if (idx < 0) idx = chips.length - 1;
      if (idx >= chips.length) idx = 0;
      chips[idx].focus();
      selectCategory(chips[idx].dataset.id);
      e.preventDefault();
    });

    if (catalogReady) initShelf();
  });
})();
