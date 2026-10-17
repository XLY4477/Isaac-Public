(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CACHE_NAME = "isaac-eternal-pwa-v5";
  const GAME_URL = new URL(new URLSearchParams(location.search).has("roomtest") ? "./public/game/room-tile-test.swf" : "./public/game/game.swf", document.baseURI).href;
  const SETTINGS_KEY = "isaac-eternal-webapp-controls-v1";
  const app = {
    player: null, stickPointers: new Map(), keyCounts: new Map(), toastTimer: 0, db: null,
    settingsOpen: false,
    controlSettings: { opacity: 48, size: 128, showItemZones: false, controlsVisible: true },
  };

  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(() => node.classList.remove("show"), 2700);
  }
  function setStatus(label, mode = "") {
    const node = $("connection");
    node.className = "status-chip " + mode;
    node.innerHTML = "<i></i> " + label;
  }
  function setWelcome(message, percent) {
    $("welcomeStatus").textContent = message;
    if (Number.isFinite(percent)) $("downloadBar").style.width = Math.max(0, Math.min(100, percent)) + "%";
  }
  function updateStorageLabel(text) {
    $("storageStatus").textContent = text;
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("isaac-eternal-webapp", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("appState")) db.createObjectStore("appState");
      };
      request.onsuccess = () => { app.db = request.result; resolve(app.db); };
      request.onerror = () => reject(request.error);
    });
  }
  function dbGet(key) {
    return new Promise((resolve, reject) => {
      const request = app.db.transaction("appState", "readonly").objectStore("appState").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function dbPut(key, value) {
    return new Promise((resolve, reject) => {
      const tx = app.db.transaction("appState", "readwrite");
      tx.objectStore("appState").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function requestPersistentStorage() {
    try {
      if (!navigator.storage?.persist) {
        updateStorageLabel("存档：浏览器不提供持久化申请，已用本地存储并可导出备份");
        return false;
      }
      const granted = await navigator.storage.persist();
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ? Math.round(estimate.usage / 1048576) : 0;
      const quota = estimate.quota ? Math.round(estimate.quota / 1048576) : 0;
      updateStorageLabel(granted
        ? "存档：已获持久化保护 · " + used + "/" + quota + " MB"
        : "存档：持久化未获批准 · " + used + "/" + quota + " MB · 建议定期导出");
      if (app.db) await dbPut("storageProtectionRequested", { granted, checkedAt: new Date().toISOString() });
      return granted;
    } catch (error) {
      updateStorageLabel("存档：本地持久化申请失败，仍可使用导出备份");
      return false;
    }
  }
  async function cacheGameFile() {
    if (await caches.match(GAME_URL)) {
      setWelcome("游戏文件已缓存，可离线启动", 100);
      return true;
    }
    if (!navigator.onLine) {
      setWelcome("当前离线且游戏文件未缓存。请联网打开一次以准备离线游戏。", 0);
      return false;
    }
    setWelcome("正在缓存完整游戏文件…首次下载约 43 MB", 0);
    const response = await fetch(GAME_URL, { cache: "reload" });
    if (!response.ok) throw new Error("游戏文件下载失败，HTTP " + response.status);
    const total = Number(response.headers.get("content-length")) || 0;
    const cache = await caches.open(CACHE_NAME);
    const cachePromise = cache.put(GAME_URL, response.clone());
    if (!response.body?.getReader) {
      await cachePromise;
      setWelcome("游戏文件缓存完成", 100);
      return true;
    }
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      received += result.value.byteLength;
      const percent = total ? Math.min(99, received / total * 100) : NaN;
      const mb = (received / 1048576).toFixed(1);
      setWelcome("正在缓存游戏 " + mb + " MB" + (total ? " / " + (total / 1048576).toFixed(1) + " MB" : ""), percent);
    }
    await cachePromise;
    setWelcome("游戏文件已缓存，可离线启动", 100);
    return true;
  }
  async function registerOfflineSupport() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) {
      setStatus(navigator.onLine ? "网页模式" : "离线模式", navigator.onLine ? "" : "offline");
      return false;
    }
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1200);
          navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
      setStatus(navigator.onLine ? "在线 · 可缓存" : "离线模式", navigator.onLine ? "online" : "offline");
      return true;
    } catch (error) {
      setStatus("离线缓存不可用");
      console.error("Service worker registration failed", error);
      return false;
    }
  }
  function keyboardEvent(code, type) {
    const keys = {
      KeyW: ["w", 87], KeyA: ["a", 65], KeyS: ["s", 83], KeyD: ["d", 68],
      ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40],
      ArrowLeft: ["ArrowLeft", 37], ArrowRight: ["ArrowRight", 39],
      KeyE: ["e", 69], KeyQ: ["q", 81], Space: [" ", 32], F1: ["F1", 112],
    };
    const key = keys[code];
    if (!key || !app.player) return;
    app.player.dispatchEvent(new KeyboardEvent(type, {
      key: key[0], code, keyCode: key[1], which: key[1],
      bubbles: true, cancelable: true, composed: true,
    }));
  }
  function focusPlayer() {
    if (!app.player) return;
    try { app.player.focus({ preventScroll: true }); }
    catch { app.player.focus(); }
  }
  function pressKey(code) {
    const count = app.keyCounts.get(code) || 0;
    app.keyCounts.set(code, count + 1);
    if (!count) keyboardEvent(code, "keydown");
  }
  function releaseKey(code) {
    const count = app.keyCounts.get(code) || 0;
    if (count <= 1) {
      app.keyCounts.delete(code);
      keyboardEvent(code, "keyup");
    } else app.keyCounts.set(code, count - 1);
  }
  function releaseAll() {
    for (const code of app.keyCounts.keys()) keyboardEvent(code, "keyup");
    app.keyCounts.clear();
    app.stickPointers.clear();
    document.querySelectorAll(".stick-knob").forEach((knob) => {
      knob.style.left = "50%";
      knob.style.top = "50%";
    });
  }
  function desiredStickKeys(kind, x, y) {
    const deadZone = .2;
    const threshold = .38;
    if (Math.hypot(x, y) < deadZone) return [];
    if (kind === "move") {
      const keys = [];
      if (x <= -threshold) keys.push("KeyA");
      if (x >= threshold) keys.push("KeyD");
      if (y <= -threshold) keys.push("KeyW");
      if (y >= threshold) keys.push("KeyS");
      return keys;
    }
    const keys = [];
    if (x <= -threshold) keys.push("ArrowLeft");
    if (x >= threshold) keys.push("ArrowRight");
    if (y <= -threshold) keys.push("ArrowUp");
    if (y >= threshold) keys.push("ArrowDown");
    return keys;
  }
  function updateStickKeys(state, nextKeys) {
    const next = new Set(nextKeys);
    for (const key of state.keys) if (!next.has(key)) releaseKey(key);
    for (const key of next) if (!state.keys.has(key)) pressKey(key);
    state.keys = next;
  }
  function updateStickFromPointer(event, state) {
    const rect = state.element.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * .34;
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const dx = rawX * scale;
    const dy = rawY * scale;
    state.knob.style.left = `calc(50% + ${dx}px)`;
    state.knob.style.top = `calc(50% + ${dy}px)`;
    updateStickKeys(state, desiredStickKeys(state.kind, dx / radius, dy / radius));
  }
  function bindJoystick(element, kind) {
    const knob = element.querySelector(".stick-knob");
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (app.settingsOpen || app.stickPointers.has(event.pointerId)) return;
      if ([...app.stickPointers.values()].some((entry) => entry.element === element)) return;
      focusPlayer();
      const state = { element, knob, kind, keys: new Set() };
      app.stickPointers.set(event.pointerId, state);
      try { element.setPointerCapture(event.pointerId); } catch {}
      updateStickFromPointer(event, state);
    });
    element.addEventListener("pointermove", (event) => {
      const state = app.stickPointers.get(event.pointerId);
      if (!state) return;
      event.preventDefault();
      event.stopPropagation();
      updateStickFromPointer(event, state);
    });
    const end = (event) => {
      const state = app.stickPointers.get(event.pointerId);
      if (!state) return;
      event.preventDefault();
      event.stopPropagation();
      app.stickPointers.delete(event.pointerId);
      updateStickKeys(state, []);
      state.knob.style.left = "50%";
      state.knob.style.top = "50%";
    };
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("lostpointercapture", end);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }
  function setControlsVisible(visible) {
    app.controlSettings.controlsVisible = visible;
    $("touchLayer").hidden = !visible || !app.player;
    $("toggleControls").textContent = visible ? "摇杆：开启" : "摇杆：关闭";
    if (!visible) releaseAll();
    saveControlSettings();
    requestAnimationFrame(positionStageControls);
  }
  function applyControlSettings() {
    document.documentElement.style.setProperty("--stick-opacity", String(app.controlSettings.opacity / 100));
    $("joystickOpacity").value = String(app.controlSettings.opacity);
    $("opacityValue").value = app.controlSettings.opacity + "%";
    $("opacityValue").textContent = app.controlSettings.opacity + "%";
    $("joystickSize").value = String(app.controlSettings.size);
    $("sizeValue").value = app.controlSettings.size + " px";
    $("sizeValue").textContent = app.controlSettings.size + " px";
    $("showItemZones").checked = app.controlSettings.showItemZones;
    $("touchLayer").classList.toggle("debug-item-zones", app.controlSettings.showItemZones);
    $("touchLayer").hidden = !app.controlSettings.controlsVisible || !app.player;
    $("toggleControls").textContent = app.controlSettings.controlsVisible ? "摇杆：开启" : "摇杆：关闭";
    requestAnimationFrame(positionStageControls);
  }
  function saveControlSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.controlSettings)); }
    catch { /* Settings are optional; game and save data remain usable. */ }
  }
  function loadControlSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      if (Number.isFinite(saved.opacity)) app.controlSettings.opacity = Math.max(20, Math.min(85, saved.opacity));
      if (Number.isFinite(saved.size)) app.controlSettings.size = Math.max(96, Math.min(170, saved.size));
      app.controlSettings.showItemZones = Boolean(saved.showItemZones);
      app.controlSettings.controlsVisible = saved.controlsVisible !== false;
    } catch { /* Ignore a malformed optional settings record. */ }
  }
  function positionStageControls() {
    const host = $("gameArea");
    if (!host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const stageWidth = Math.min(width, height * 4 / 3);
    const stageHeight = stageWidth * 3 / 4;
    const left = (width - stageWidth) / 2;
    const top = (height - stageHeight) / 2;
    const size = Math.min(app.controlSettings.size, stageHeight * .44, stageWidth * .31);
    const bottom = top + stageHeight - size - Math.max(10, stageHeight * .025);
    const move = $("moveStick");
    const shoot = $("shootStick");
    for (const stick of [move, shoot]) {
      stick.style.width = `${size}px`;
      stick.style.height = `${size}px`;
      stick.style.setProperty("--stick-opacity", String(app.controlSettings.opacity / 100));
    }
    move.style.left = `${left + Math.max(10, stageWidth * .035)}px`;
    move.style.top = `${bottom}px`;
    shoot.style.left = `${left + stageWidth - size - Math.max(10, stageWidth * .035)}px`;
    shoot.style.top = `${bottom}px`;
    const zones = [
      [".bomb-hit", .355, .055, .075, .14],
      [".card-hit", .475, .035, .11, .14],
      [".active-hit", .595, .035, .11, .14],
    ];
    for (const [selector, x, y, w, h] of zones) {
      const zone = document.querySelector(selector);
      zone.style.left = `${left + stageWidth * x}px`;
      zone.style.top = `${top + stageHeight * y}px`;
      zone.style.width = `${stageWidth * w}px`;
      zone.style.height = `${stageHeight * h}px`;
    }
  }
  function setSettingsOpen(open) {
    app.settingsOpen = open;
    $("settingsPanel").hidden = !open;
    $("settingsToggle").setAttribute("aria-expanded", String(open));
    $("touchLayer").classList.toggle("settings-open", open);
    if (open) releaseAll();
    else focusPlayer();
  }
  function bindTouchControls() {
    bindJoystick($("moveStick"), "move");
    bindJoystick($("shootStick"), "shoot");
    document.querySelectorAll(".item-hit[data-key]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (app.settingsOpen) return;
        focusPlayer();
        const code = button.dataset.key;
        pressKey(code);
        setTimeout(() => releaseKey(code), 90);
      });
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }
  function showError(text) {
    $("gameError").hidden = false;
    $("gameError").textContent = text;
  }
  function createPlayer() {
    if (app.player) return;
    if (!window.RufflePlayer) throw new Error("Ruffle 运行器未加载。请检查本地 vendor/ruffle 文件。");
    const ruffle = window.RufflePlayer.newest();
    app.player = ruffle.createPlayer();
    app.player.id = "rufflePlayer";
    app.player.tabIndex = 0;
    app.player.setAttribute("aria-label", "游戏画面");
    $("playerHost").appendChild(app.player);
    focusPlayer();
    const loaded = app.player.ruffle().load({ url: GAME_URL });
    if (loaded && typeof loaded.catch === "function") loaded.catch((error) => showError("游戏加载失败：" + error.message));
    $("welcome").hidden = true;
    applyControlSettings();
    $("gameArea").classList.add("playing");
    if (new URLSearchParams(location.search).has("room3space")) {
      app.player.addEventListener("loadedmetadata", () => {
        let count = 0;
        const pressSpace = () => {
          app.player.dispatchEvent(new KeyboardEvent("keydown", {key: " ", code: "Space", keyCode: 32, which: 32, bubbles: true, cancelable: true, composed: true}));
          app.player.dispatchEvent(new KeyboardEvent("keyup", {key: " ", code: "Space", keyCode: 32, which: 32, bubbles: true, cancelable: true, composed: true}));
          if (++count < 3) setTimeout(pressSpace, 1800);
        };
        setTimeout(pressSpace, 1500);
      }, {once: true});
    }    app.player.addEventListener("loadedmetadata", () => {
      focusPlayer();
      toast("游戏已启动：左摇杆移动，右摇杆射击；点击 HUD 图标使用道具。");
    });
    app.player.addEventListener("error", (event) => showError("Ruffle 报告游戏加载错误：" + (event.detail || "未知错误")));
  }
  async function startGame() {
    $("startGame").disabled = true;
    try {
      if (app.db) await requestPersistentStorage();
      const ready = await cacheGameFile();
      if (!ready) { $("startGame").disabled = false; return; }
      createPlayer();
    } catch (error) {
      console.error(error);
      setWelcome("启动失败：" + error.message, 0);
      $("startGame").disabled = false;
    }
  }
  function backupBlob(value) {
    return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  }
  async function exportBackup() {
    try {
      const local = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        local[key] = localStorage.getItem(key);
      }
      const backup = {
        format: "isaac-eternal-webapp-save",
        version: 1,
        exportedAt: new Date().toISOString(),
        localStorage: local,
        appState: { storageProtectionRequested: app.db ? await dbGet("storageProtectionRequested") : null },
      };
      const url = URL.createObjectURL(backupBlob(backup));
      const a = document.createElement("a");
      a.href = url;
      a.download = "以撒永恒网页存档-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("网页存档已导出。");
    } catch (error) {
      toast("导出失败：" + error.message);
    }
  }
  async function importBackup(file) {
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== "isaac-eternal-webapp-save" || backup.version !== 1 || !backup.localStorage) {
        throw new Error("存档文件格式不匹配。");
      }
      for (const [key, value] of Object.entries(backup.localStorage)) {
        if (typeof value === "string") localStorage.setItem(key, value);
      }
      if (backup.appState?.storageProtectionRequested && app.db) {
        await dbPut("storageProtectionRequested", backup.appState.storageProtectionRequested);
      }
      toast("存档已恢复，正在重新载入游戏。");
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      toast("导入失败：" + error.message);
    } finally {
      $("backupFile").value = "";
    }
  }
  async function updateStorageLabelFromSavedState() {
    const saved = await dbGet("storageProtectionRequested");
    if (saved?.granted) updateStorageLabel("网页存档：已申请持久化保护；Ruffle SharedObject 保存游戏、收藏和语言");
    else updateStorageLabel("网页存档：Ruffle SharedObject + IndexedDB · 可导出备份");
  }
  function bind() {
    bindTouchControls();
    $("startGame").addEventListener("click", startGame);
    $("settingsToggle").addEventListener("click", () => setSettingsOpen(!app.settingsOpen));
    $("closeSettings").addEventListener("click", () => setSettingsOpen(false));
    $("saveExport").addEventListener("click", exportBackup);
    $("saveImport").addEventListener("click", () => $("backupFile").click());
    $("backupFile").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) importBackup(file);
    });
    $("requestStorage").addEventListener("click", async () => {
      const granted = await requestPersistentStorage();
      toast(granted ? "浏览器已批准持久化存储。" : "浏览器未批准持久化；请定期导出存档备份。");
    });
    $("toggleControls").addEventListener("click", () => setControlsVisible(!app.controlSettings.controlsVisible));
    $("toggleHelperUI").addEventListener("click", () => {
      setSettingsOpen(false);
      focusPlayer();
      pressKey("F1");
      setTimeout(() => releaseKey("F1"), 90);
    });
    $("joystickOpacity").addEventListener("input", (event) => {
      app.controlSettings.opacity = Number(event.target.value);
      applyControlSettings();
      saveControlSettings();
    });
    $("joystickSize").addEventListener("input", (event) => {
      app.controlSettings.size = Number(event.target.value);
      applyControlSettings();
      saveControlSettings();
    });
    $("showItemZones").addEventListener("change", (event) => {
      app.controlSettings.showItemZones = event.target.checked;
      applyControlSettings();
      saveControlSettings();
    });
    document.addEventListener("keydown", (event) => {
      if (!app.settingsOpen || event.target instanceof HTMLInputElement) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE", "KeyQ", "Space", "F1", "Escape"].includes(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (event.code === "Escape") setSettingsOpen(false);
    }, true);
    if ("ResizeObserver" in window) new ResizeObserver(positionStageControls).observe($("gameArea"));
    window.addEventListener("resize", positionStageControls);
    window.visualViewport?.addEventListener("resize", positionStageControls);
    window.addEventListener("orientationchange", () => setTimeout(positionStageControls, 120));
    document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
    window.addEventListener("blur", releaseAll);
    window.addEventListener("online", () => setStatus("在线 · 可缓存", "online"));
    window.addEventListener("offline", () => setStatus("离线模式", "offline"));
  }
  async function init() {
    loadControlSettings();
    applyControlSettings();
    bind();
    try {
      await openDb();
      await updateStorageLabelFromSavedState();
      await dbPut("lastOpenedAt", new Date().toISOString());
    } catch (error) {
      updateStorageLabel("网页数据库不可用；请检查 Safari 存储设置");
      console.error("IndexedDB unavailable", error);
    }
    await registerOfflineSupport();
    if (await caches.match(GAME_URL)) setWelcome("离线游戏资源已准备好", 100);
    else setWelcome("首次启动需联网缓存游戏文件", 0);
    if (!navigator.onLine) setStatus("离线模式", "offline");
    if (location.hostname === "localhost" && new URLSearchParams(location.search).get("preview") === "1") {
      startGame();
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
