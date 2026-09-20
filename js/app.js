/* 书架与路由：按分类加载 book.js，封面只在当前分类渲染。
   可分享链接：#/分类id 打开某一类；#/分类id/故事id 打开某一本。 */
(function () {
  var booksByPath = {};
  var categories = [];
  var currentCategoryId = null;
  var loadedPaths = {};
  var domReady = false;
  var catalogReady = false;
  var toastTimer = null;

  var CATEGORY_KEY = "pinyinBook.shelfCategory";
  var SITE_TITLE = "点读绘本屋";

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
    var isEn = data.lang === "en";
    for (var i = 0; i < data.pages.length; i++) {
      var p = data.pages[i];
      if (isEn) {
        if (!Array.isArray(p.words) || p.words.length === 0) {
          return "第 " + (i + 1) + " 页缺少 words";
        }
        for (var w = 0; w < p.words.length; w++) {
          if (!p.words[w] || typeof p.words[w].en !== "string" || !p.words[w].en) {
            return "第 " + (i + 1) + " 页 words[" + w + "] 缺少 en";
          }
        }
      } else {
        var chars = Array.from(p.text || "");
        if (!Array.isArray(p.pinyin) || p.pinyin.length !== chars.length) {
          return "第 " + (i + 1) + " 页 pinyin 数组长度(" +
            (p.pinyin ? p.pinyin.length : 0) + ")与文字字数(" + chars.length + ")不一致";
        }
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
    return null;
  }

  function bookIdFromPath(path) {
    var m = String(path || "").match(/books\/([^/]+)\//);
    return m ? m[1] : "";
  }

  function findBookEntry(bookId) {
    if (!bookId) return null;
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      for (var j = 0; j < cat.books.length; j++) {
        var path = cat.books[j];
        if (bookIdFromPath(path) === bookId) return { cat: cat, path: path };
      }
    }
    return null;
  }

  function routeHash(catId, bookId) {
    var h = "#/" + encodeURIComponent(catId);
    if (bookId) h += "/" + encodeURIComponent(bookId);
    return h;
  }

  function parseRoute() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (raw.charAt(0) === "/") raw = raw.slice(1);
    var parts = raw.split("/").filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    if (!parts.length) return { catId: null, bookId: null };

    if (getCategory(parts[0])) {
      return { catId: parts[0], bookId: parts[1] || null };
    }
    var found = findBookEntry(parts[0]);
    if (found) return { catId: found.cat.id, bookId: parts[0] };
    return { catId: null, bookId: null };
  }

  function shareUrl(catId, bookId) {
    var base = location.href.replace(/#.*$/, "");
    return base + routeHash(catId, bookId);
  }

  function showToast(msg) {
    var el = document.getElementById("copy-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 1800);
  }

  /* 同步复制：必须在点击手势里立刻执行。clipboard.writeText 在微信/iOS 里经常卡住，
     不能把它当成主路径，否则按钮会像“没反应”。 */
  function copyWithExecCommand(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0.01;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) {}
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return !!ok;
  }

  function copyText(text, okMsg) {
    if (copyWithExecCommand(text)) {
      showToast(okMsg || "链接已复制");
      return Promise.resolve(true);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return new Promise(function (resolve) {
        var settled = false;
        function finish(ok) {
          if (settled) return;
          settled = true;
          if (ok) showToast(okMsg || "链接已复制");
          resolve(!!ok);
        }
        navigator.clipboard.writeText(text).then(function () {
          finish(true);
        }).catch(function () {
          finish(false);
        });
        setTimeout(function () { finish(false); }, 700);
      });
    }
    return Promise.resolve(false);
  }

  function canNativeShare(url) {
    try {
      return !!(navigator.share && (!navigator.canShare || navigator.canShare({ url: url })));
    } catch (e) {
      return !!navigator.share;
    }
  }

  function closeSharePanel() {
    var overlay = document.getElementById("share-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function openSharePanel(url, heading) {
    var overlay = document.getElementById("share-overlay");
    var input = document.getElementById("share-url-input");
    var title = document.getElementById("share-title");
    var copyBtn = document.getElementById("share-copy-btn");
    var nativeBtn = document.getElementById("share-native-btn");
    if (!overlay || !input) {
      copyText(url, "链接已复制");
      return;
    }
    if (title) title.textContent = heading || "分享链接";
    input.value = url;
    if (copyBtn) copyBtn.textContent = "复制链接";
    overlay.classList.remove("hidden");
    input.style.height = "auto";
    input.style.height = Math.min(160, Math.max(52, input.scrollHeight + 2)) + "px";

    if (nativeBtn) {
      nativeBtn.classList.toggle("hidden", !canNativeShare(url));
      nativeBtn.dataset.url = url;
      nativeBtn.dataset.title = heading || SITE_TITLE;
    }

    try {
      input.focus();
      input.select();
      input.setSelectionRange(0, url.length);
    } catch (e) {}

    copyText(url, "链接已复制").then(function (ok) {
      if (ok && copyBtn) copyBtn.textContent = "已复制";
    });
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
  function showShelfView() {
    document.getElementById("reader-view").classList.add("hidden");
    document.getElementById("shelf-view").classList.remove("hidden");
    window.Reader.close();
  }

  function openBook(book) {
    document.getElementById("shelf-view").classList.add("hidden");
    document.getElementById("reader-view").classList.remove("hidden");
    window.Reader.open(book);
  }

  function setDocumentTitle(cat, book) {
    if (book) {
      document.title = book.title + " · " + SITE_TITLE;
    } else if (cat) {
      document.title = cat.name + " · " + SITE_TITLE;
    } else {
      document.title = SITE_TITLE;
    }
  }

  /* ---- 分类栏 ---- */
  function renderCategoryBar() {
    var bar = document.getElementById("category-bar");
    bar.innerHTML = "";
    categories.forEach(function (cat) {
      var btn = document.createElement("a");
      btn.href = routeHash(cat.id);
      btn.className = "category-chip";
      btn.dataset.id = cat.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", cat.id === currentCategoryId ? "true" : "false");
      btn.textContent = cat.name;
      btn.title = "打开「" + cat.name + "」分类";
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

      var card = document.createElement("a");
      card.href = routeHash(cat.id, book.id);
      card.className = "book-card";
      card.title = "打开《" + book.title + "》";

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
      meta.textContent = book.pages.length + " 页" +
        (book.lang === "en" ? " · 英文" : "") +
        (book.grade ? " · 适合" + book.grade + "年级" : "");
      card.appendChild(meta);

      grid.appendChild(card);
    });

    if (shown === 0) {
      grid.innerHTML = '<p class="shelf-empty">这一架的故事还在路上，请稍后再看。</p>';
    }
  }

  function showCategory(id) {
    var cat = getCategory(id) || categories[0];
    if (!cat) return;
    currentCategoryId = cat.id;
    try { localStorage.setItem(CATEGORY_KEY, cat.id); } catch (e) {}

    updateChipState();
    updateHint(cat);
    setDocumentTitle(cat, null);

    var grid = document.getElementById("shelf-grid");
    clearCoverLoads(grid);
    renderSkeleton(grid, Math.min(cat.books.length || 1, 4));

    var requested = cat.id;
    loadCategoryScripts(cat, function () {
      if (currentCategoryId !== requested) return;
      renderShelf(cat);
    });
  }

  function applyRoute() {
    if (!categories.length) return;
    var route = parseRoute();
    var entry = route.bookId ? findBookEntry(route.bookId) : null;
    var cat = entry ? entry.cat : (getCategory(route.catId) || getCategory(currentCategoryId) || categories[0]);
    if (!cat) return;

    if (entry) {
      currentCategoryId = cat.id;
      try { localStorage.setItem(CATEGORY_KEY, cat.id); } catch (e) {}
      updateChipState();
      updateHint(cat);

      var requested = entry.path;
      loadCategoryScripts(cat, function () {
        var book = booksByPath[requested];
        if (!book) {
          showShelfView();
          renderShelf(cat);
          setDocumentTitle(cat, null);
          return;
        }
        renderShelf(cat);
        openBook(book);
        setDocumentTitle(cat, book);
      });
      return;
    }

    showShelfView();
    if (currentCategoryId === cat.id && document.querySelector("#shelf-grid .book-card")) {
      updateChipState();
      updateHint(cat);
      setDocumentTitle(cat, null);
      return;
    }
    showCategory(cat.id);
  }

  function goHome() {
    var catId = currentCategoryId || (categories[0] && categories[0].id);
    if (!catId) {
      showShelfView();
      return;
    }
    var hash = routeHash(catId);
    if ((location.hash || "") === hash) {
      applyRoute();
    } else {
      location.hash = hash;
    }
  }

  function initShelf() {
    if (!categories.length) {
      document.getElementById("shelf-grid").innerHTML =
        '<p class="shelf-empty">书架还是空的，请按 README 的说明添加故事。</p>';
      return;
    }

    var route = parseRoute();
    if (!route.catId && !route.bookId) {
      var saved = null;
      try { saved = localStorage.getItem(CATEGORY_KEY); } catch (e) {}
      var initial = getCategory(saved) ? saved : categories[0].id;
      history.replaceState(null, "", routeHash(initial));
    }

    renderCategoryBar();
    applyRoute();
  }

  document.addEventListener("DOMContentLoaded", function () {
    domReady = true;
    document.getElementById("back-btn").addEventListener("click", goHome);

    var shareCat = document.getElementById("share-cat-btn");
    if (shareCat) {
      shareCat.addEventListener("click", function () {
        var catId = currentCategoryId || (categories[0] && categories[0].id);
        if (!catId) return;
        var cat = getCategory(catId);
        openSharePanel(shareUrl(catId), cat ? "分享「" + cat.name + "」" : "分享分类");
      });
    }
    var shareBook = document.getElementById("share-book-btn");
    if (shareBook) {
      shareBook.addEventListener("click", function () {
        var book = window.Reader.currentBook && window.Reader.currentBook();
        var catId = currentCategoryId;
        if (!book || !catId) return;
        openSharePanel(shareUrl(catId, book.id), "分享《" + book.title + "》");
      });
    }

    var shareOverlay = document.getElementById("share-overlay");
    var shareInput = document.getElementById("share-url-input");
    var shareCopyBtn = document.getElementById("share-copy-btn");
    var shareNativeBtn = document.getElementById("share-native-btn");
    var shareCloseBtn = document.getElementById("share-close-btn");
    if (shareCloseBtn) shareCloseBtn.addEventListener("click", closeSharePanel);
    if (shareOverlay) {
      shareOverlay.addEventListener("click", function (e) {
        if (e.target === shareOverlay) closeSharePanel();
      });
    }
    if (shareInput) {
      shareInput.addEventListener("focus", function () {
        try {
          shareInput.select();
          shareInput.setSelectionRange(0, shareInput.value.length);
        } catch (e) {}
      });
    }
    if (shareCopyBtn && shareInput) {
      shareCopyBtn.addEventListener("click", function () {
        copyText(shareInput.value, "链接已复制").then(function (ok) {
          shareCopyBtn.textContent = ok ? "已复制" : "请长按上面的链接复制";
        });
      });
    }
    if (shareNativeBtn) {
      shareNativeBtn.addEventListener("click", function () {
        var url = shareNativeBtn.dataset.url;
        var title = shareNativeBtn.dataset.title || SITE_TITLE;
        if (!url || !navigator.share) return;
        navigator.share({ title: title, text: title, url: url }).catch(function () {});
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var overlay = document.getElementById("share-overlay");
      if (overlay && !overlay.classList.contains("hidden")) closeSharePanel();
    });

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
      location.hash = routeHash(chips[idx].dataset.id);
      e.preventDefault();
    });

    window.addEventListener("hashchange", applyRoute);

    if (catalogReady) initShelf();
  });
})();
