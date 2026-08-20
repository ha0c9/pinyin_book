/* 阅读器：渲染页面、点字出拼音、翻页 */
(function () {
  var currentBook = null;
  var currentPage = 0;
  var bubbleTimers = new WeakMap();

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
    removeBubble(charEl); // 再次点击：先清除旧气泡与计时，重新计时

    var bubble = document.createElement("span");
    bubble.className = "pinyin-bubble";
    bubble.textContent = pinyin;
    charEl.appendChild(bubble);
    charEl.classList.add("active");

    var duration = window.AppSettings.get().pinyinDuration;
    if (duration > 0) {
      var fade = setTimeout(function () {
        bubble.classList.add("fading");
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
    var chars = Array.from(page.text);
    var pinyins = page.pinyin || [];
    var allPinyin = window.AppSettings.get().allPinyin === "on";

    chars.forEach(function (ch, i) {
      var py = pinyins[i] || "";
      var node;

      if (!py) {
        node = document.createElement("span");
        node.className = "char punct";
        node.textContent = ch;
      } else if (allPinyin) {
        node = document.createElement("ruby");
        node.className = "char";
        node.appendChild(document.createTextNode(ch));
        var rt = document.createElement("rt");
        rt.textContent = py;
        node.appendChild(rt);
      } else {
        node = document.createElement("span");
        node.className = "char";
        node.textContent = ch;
        node.addEventListener("click", function () { showBubble(node, py); });
      }
      container.appendChild(node);
    });
  }

  function renderPage() {
    var page = currentBook.pages[currentPage];

    if (page.image) {
      el.pageImageWrap.classList.remove("no-image");
      el.pageImage.src = currentBook.basePath + page.image;
    } else {
      el.pageImageWrap.classList.add("no-image");
      el.pageImage.removeAttribute("src");
    }
    el.pageImage.onerror = function () { el.pageImageWrap.classList.add("no-image"); };

    renderText(page);

    el.pageIndicator.textContent = "第 " + (currentPage + 1) + " / " + currentBook.pages.length + " 页";
    el.prevBtn.disabled = currentPage === 0;
    el.nextBtn.disabled = currentPage === currentBook.pages.length - 1;
    saveProgress();
  }

  function goto(delta) {
    if (!currentBook) return;
    var next = currentPage + delta;
    if (next < 0 || next >= currentBook.pages.length) return;
    currentPage = next;
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

    el.prevBtn.addEventListener("click", function () { goto(-1); });
    el.nextBtn.addEventListener("click", function () { goto(1); });

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

    /* 整页拼音开关变化时重新渲染当前页 */
    window.AppSettings.onChange(function () {
      if (currentBook) renderPage();
    });
  });
})();
