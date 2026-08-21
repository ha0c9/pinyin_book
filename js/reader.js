/* 阅读器：渲染页面、点字出拼音、翻页 */
(function () {
  var currentBook = null;
  var currentPage = 0;
  var bubbleTimers = new WeakMap();
  var pageImageToken = 0;

  var el = {}; // DOM 引用，init 时填充

  function $(id) { return document.getElementById(id); }

  /* ---- 阅读进度记忆 ---- */
  function progressKey(bookId) { return "pinyinBook.progress." + bookId; }
  function saveProgress() {
    if (!currentBook) return;
    try { localStorage.setItem(progressKey(currentBook.id), String(currentPage)); } catch (e) {}
  }
  function loadProgress(bookId, pageCount) {
    try {
      var p = parseInt(localStorage.getItem(progressKey(bookId)), 10);
      if (p >= 0 && p < pageCount) return p;
    } catch (e) {}
    return 0;
  }

  /* ---- 拼音气泡 ---- */
  function removeBubble(charEl) {
    var bubble = charEl.querySelector(".pinyin-bubble");
    if (bubble) bubble.remove();
    charEl.classList.remove("active");
    var t = bubbleTimers.get(charEl);
    if (t) { clearTimeout(t.hide); clearTimeout(t.fade); bubbleTimers.delete(charEl); }
  }

  function showBubble(charEl, pinyin) {
    var bubble = document.createElement("span");
    bubble.className = "pinyin-bubble";
    bubble.textContent = pinyin;
    charEl.appendChild(bubble);
    charEl.classList.add("active");

    var duration = window.AppSettings.get().pinyinDuration;
    if (duration > 0) {
      var fade = setTimeout(function () {
        bubble.classList.add("fading");
        charEl.classList.remove("active"); // 底色与气泡同步淡出
      }, duration);
      var hide = setTimeout(function () {
        removeBubble(charEl);
      }, duration + 500);
      bubbleTimers.set(charEl, { fade: fade, hide: hide });
    }
  }

  /* ---- 页面渲染 ---- */
  function renderText(page) {
    var container = el.pageText;
    container.innerHTML = "";
    // 内层容器：避免横屏布局下 .page-text 的 flex 纵向居中把每个字拆成一行
    var inner = document.createElement("div");
    inner.className = "text-inner";
    container.appendChild(inner);
    var chars = Array.from(page.text);
    var pinyins = page.pinyin || [];

    chars.forEach(function (ch, i) {
      var py = pinyins[i] || "";
      var node;

      if (!py) {
        node = document.createElement("span");
        node.className = "char punct";
        node.textContent = ch;
      } else {
        node = document.createElement("span");
        node.className = "char";
        node.textContent = ch;
        // 点击切换：已显示拼音时再点一下立即消失（与淡出时间设置无关）
        node.addEventListener("click", function () {
          if (node.classList.contains("active") || node.querySelector(".pinyin-bubble")) {
            removeBubble(node);
          } else {
            showBubble(node, py);
          }
        });
      }
      inner.appendChild(node);
    });
  }

  function clearPageImage() {
    if (!el.pageImage) return;
    el.pageImage.onload = null;
    el.pageImage.onerror = null;
    el.pageImage.classList.remove("is-loading");
    el.pageImage.removeAttribute("src");
  }

  function renderPage() {
    var page = currentBook.pages[currentPage];
    var token = ++pageImageToken;

    if (page.image) {
      el.pageImageWrap.classList.remove("no-image");
      var src = currentBook.basePath + page.image;
      var img = el.pageImage;
      var already = img.getAttribute("src") === src && img.complete && img.naturalWidth;

      img.onload = function () {
        if (token !== pageImageToken) return;
        img.classList.remove("is-loading");
      };
      img.onerror = function () {
        if (token !== pageImageToken) return;
        img.classList.remove("is-loading");
        el.pageImageWrap.classList.add("no-image");
        img.removeAttribute("src");
      };

      if (already) {
        img.classList.remove("is-loading");
      } else {
        img.classList.add("is-loading");
        img.src = src;
      }
    } else {
      el.pageImageWrap.classList.add("no-image");
      clearPageImage();
    }

    renderText(page);

    el.pageIndicator.textContent = "第 " + (currentPage + 1) + " / " + currentBook.pages.length + " 页";
    el.prevBtn.disabled = currentPage === 0;
    el.nextBtn.disabled = currentPage === currentBook.pages.length - 1;
    if (el.firstPageBtn) el.firstPageBtn.disabled = currentPage === 0;
    saveProgress();
  }

  function goto(delta) {
    if (!currentBook) return;
    var next = currentPage + delta;
    if (next < 0 || next >= currentBook.pages.length) return;
    currentPage = next;
    renderPage();
  }

  function gotoFirst() {
    if (!currentBook || currentPage === 0) return;
    currentPage = 0;
    renderPage();
  }

  /* ---- 对外接口 ---- */
  window.Reader = {
    open: function (book) {
      currentBook = book;
      currentPage = loadProgress(book.id, book.pages.length);
      el.bookTitle.textContent = book.title;
      renderPage();
    },
    close: function () {
      currentBook = null;
      pageImageToken++;
      clearPageImage();
    }
  };

  /* ---- 初始化 ---- */
  document.addEventListener("DOMContentLoaded", function () {
    el.pageText = $("page-text");
    el.pageImage = $("page-image");
    el.pageImageWrap = $("page-image-wrap");
    el.pageIndicator = $("page-indicator");
    el.bookTitle = $("book-title");
    el.prevBtn = $("prev-btn");
    el.nextBtn = $("next-btn");
    el.firstPageBtn = $("first-page-btn");

    el.prevBtn.addEventListener("click", function () { goto(-1); });
    el.nextBtn.addEventListener("click", function () { goto(1); });
    el.firstPageBtn.addEventListener("click", gotoFirst);

    document.addEventListener("keydown", function (e) {
      if (!currentBook) return;
      if (e.key === "ArrowLeft") goto(-1);
      if (e.key === "ArrowRight") goto(1);
    });

    /* 触屏滑动翻页 */
    var touchStartX = null;
    var pageArea = document.querySelector(".page-area");
    pageArea.addEventListener("touchstart", function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    pageArea.addEventListener("touchend", function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 60) goto(dx < 0 ? 1 : -1);
      touchStartX = null;
    }, { passive: true });

    /* 设置变化时重新渲染当前页（例如字号） */
    window.AppSettings.onChange(function () {
      if (currentBook) renderPage();
    });
  });
})();
