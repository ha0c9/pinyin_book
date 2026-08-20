/* 设置：读取/保存 localStorage，并驱动设置面板 UI */
(function () {
  var STORAGE_KEY = "pinyinBook.settings";

  var DEFAULTS = {
    pinyinDuration: 5000, // 拼音气泡停留毫秒数，0 = 不自动消失
    fontSize: "large"     // large | xlarge
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { /* 隐私模式等场景下 localStorage 不可用，回退默认值 */ }
    return Object.assign({}, DEFAULTS);
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) { /* 忽略 */ }
  }

  var settings = load();
  var listeners = [];

  function apply() {
    document.body.dataset.fontsize = settings.fontSize;
    listeners.forEach(function (fn) { fn(settings); });
  }

  window.AppSettings = {
    get: function () { return settings; },
    set: function (key, value) {
      settings[key] = value;
      save(settings);
      apply();
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  /* ---- 设置面板 UI ---- */
  function initPanel() {
    var overlay = document.getElementById("settings-overlay");

    function bindGroup(groupId, key, parse) {
      var group = document.getElementById(groupId);
      var buttons = group.querySelectorAll("button");

      function refresh() {
        buttons.forEach(function (b) {
          var v = parse ? parse(b.dataset.value) : b.dataset.value;
          b.classList.toggle("selected", v === settings[key]);
        });
      }
      buttons.forEach(function (b) {
        b.addEventListener("click", function () {
          window.AppSettings.set(key, parse ? parse(b.dataset.value) : b.dataset.value);
          refresh();
        });
      });
      refresh();
    }

    bindGroup("duration-options", "pinyinDuration", function (v) { return parseInt(v, 10); });
    bindGroup("fontsize-options", "fontSize", null);

    function open() { overlay.classList.remove("hidden"); }
    function close() { overlay.classList.add("hidden"); }

    document.getElementById("settings-btn").addEventListener("click", open);
    document.getElementById("settings-btn-2").addEventListener("click", open);
    document.getElementById("settings-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    apply();
  }

  document.addEventListener("DOMContentLoaded", initPanel);
})();
