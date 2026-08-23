/* 阅读器：渲染页面、点字出拼音 / 点词出中文与读音、翻页 */
(function () {
  var currentBook = null;
  var currentPage = 0;
  var bubbleTimers = new WeakMap();
  var pageImageToken = 0;

  var el = {}; // DOM 引用，init 时填充

  function $(id) { return document.getElementById(id); }

  function isEnglishBook(book) {
    return !!(book && book.lang === "en");
  }

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

  /* ---- 英文朗读 ---- */
  function stopSpeech() {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
  }

  function speakEnglish(word) {
    if (!word || !window.speechSynthesis) return;
    stopSpeech();
    var u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.85;
    u.pitch = 1;
    try {
      var voices = window.speechSynthesis.getVoices() || [];
      var en = null;
      for (var i = 0; i < voices.length; i++) {
        var lang = voices[i].lang || "";
        if (/^en-US/i.test(lang)) { en = voices[i]; break; }
        if (!en && /^en/i.test(lang)) en = voices[i];
      }
      if (en) u.voice = en;
    } catch (e) {}
    window.speechSynthesis.speak(u);
  }

  /* ---- 拼音 / 中文气泡 ---- */
  function removeBubble(charEl) {
    var bubble = charEl.querySelector(".pinyin-bubble");
    if (bubble) bubble.remove();
    charEl.classList.remove("active");
    var t = bubbleTimers.get(charEl);
    if (t) { clearTimeout(t.hide); clearTimeout(t.fade); bubbleTimers.delete(charEl); }
  }

  function showBubble(charEl, label, speakWord) {
    var bubble = document.createElement("span");
    bubble.className = "pinyin-bubble";
    bubble.textContent = label;
    charEl.appendChild(bubble);
    charEl.classList.add("active");
    if (speakWord) speakEnglish(speakWord);

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

  function bindTap(node, label, speakWord) {
    node.addEventListener("click", function () {
      if (node.classList.contains("active") || node.querySelector(".pinyin-bubble")) {
        removeBubble(node);
        if (speakWord) stopSpeech();
      } else {
        showBubble(node, label, speakWord || "");
      }
    });
  }

  /* ---- 页面渲染 ---- */
  function renderChineseText(page) {
    var inner = document.createElement("div");
    inner.className = "text-inner";
    var chars = Array.from(page.text);
    var pinyins = page.pinyin || [];

    chars.forEach(function (ch, i) {
      var py = pinyins[i] || "";
      var node = document.createElement("span");
      if (!py) {
        node.className = "char punct";
        node.textContent = ch;
      } else {
        node.className = "char";
        node.textContent = ch;
        bindTap(node, py, "");
      }
      inner.appendChild(node);
    });
    return inner;
  }

  function noSpaceBefore(en) {
    return /^[.,!?;:)'”’]/.test(en);
  }

  function isOpeningQuote(en) {
    return en === "\"" || en === "“" || en === "‘";
  }

  function renderEnglishText(page) {
    var inner = document.createElement("div");
    inner.className = "text-inner";
    var words = page.words || [];

    words.forEach(function (item, i) {
      var en = item.en;
      if (i > 0 && !noSpaceBefore(en) && !isOpeningQuote(words[i - 1].en)) {
        inner.appendChild(document.createTextNode(" "));
      }
      var node = document.createElement("span");
      if (item.zh) {
        node.className = "char word";
        node.textContent = en;
        bindTap(node, item.zh, en);
      } else {
        node.className = "char punct";
        node.textContent = en;
      }
      inner.appendChild(node);
    });
    return inner;
  }

  function renderText(page) {
    var container = el.pageText;
    container.innerHTML = "";
    // 内层容器：避免横屏布局下 .page-text 的 flex 纵向居中把每个字拆成一行
    var inner = isEnglishBook(currentBook) ? renderEnglishText(page) : renderChineseText(page);
    container.appendChild(inner);
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

    stopSpeech();

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
      document.getElementById("reader-view").classList.toggle("lang-en", isEnglishBook(book));
      renderPage();
    },
    close: function () {
      currentBook = null;
      pageImageToken++;
      stopSpeech();
      var view = document.getElementById("reader-view");
      if (view) view.classList.remove("lang-en");
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

    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }

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
