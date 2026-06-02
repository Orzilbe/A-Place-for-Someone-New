// ══════════════════════════════════════════════════════════════
//  room.js — חדר תינוקת עם אסטים
// ══════════════════════════════════════════════════════════════

// ── אסטים תינוקת ──────────────────────────────────────────────
const BABY_ASSETS = {
  sleepingNew:  "assets/SleepingBabyInNewCrib.png",
  sleepingUsed: "assets/SleepingBabyInSecond-handCrib.png",
  crying:       "assets/CryingBaby.png",
};

// ── מיפוי אסטים ───────────────────────────────────────────────
const ASSETS = {
  room: "assets/EmptyBabyRoom.png",
  crib: {
    new:          "assets/NewCrib.png",
    used:         "assets/Second-handCrib.png",
    newSleeping:  "assets/SleepingBabyInNewCrib.png",
    usedSleeping: "assets/SleepingBabyInSecond-handCrib.png",
  },
  dresser: {
    new:  "assets/NewDresser.png",
    used: "assets/Second-handDresser.png",
  },
  stroller: {
    new:       "assets/NewStroller.png",
    used:      "assets/Second-handStroller.png",
    usedRonit: "assets/RonitSecond-handStroller.png",
  },
  carseat: {
    new:  "assets/NewCarseat.png",
    used: "assets/Second-handCarseat.png",
  },
  clothes: {
    new:  "assets/NewBabyClothes.png",
    used: "assets/Second-handBabyClothes.png",
  },
};

// ── מיקומי פריטים (ברירת מחדל — אחוזים: left, bottom, width) ──
const ITEM_LAYOUT = {
  crib:     { left: "5%",  bottom: "8%",  width: "23%" },
  dresser:  { left: "26%", bottom: "6%",  width: "18%" },
  stroller: { left: "43%", bottom: "4%",  width: "18%" },
  carseat:  { left: "60%", bottom: "3%",  width: "16%" },
  clothes:  { left: "76%", bottom: "3%",  width: "14%" },
};

// ── אתחול רקע החדר ────────────────────────────────────────────
function initRoomBackground() {
  const container = document.getElementById("room-view");
  if (!container) return;

  const oldBg = document.getElementById("room-bg");
  if (oldBg) oldBg.style.background = "none";

  if (document.getElementById("room-asset-bg")) return;

  const bg = document.createElement("img");
  bg.id  = "room-asset-bg";
  bg.src = ASSETS.room;
  bg.alt = "חדר תינוקת";
  bg.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    z-index: 0;
    pointer-events: none;
    transition: opacity 0.6s ease;
  `;

  const firstChild = container.firstChild;
  firstChild
    ? container.insertBefore(bg, firstChild)
    : container.appendChild(bg);
}

// ── רינדור פריט בודד ──────────────────────────────────────────
function renderItem(item) {
  const container = document.getElementById("room-view");
  if (!container) return;

  const elId = `room-item-${item.id}`;
  let el = document.getElementById(elId);

  if (!item.inHouse) {
    if (el) el.style.display = "none";
    return;
  }

  const assetGroup = ASSETS[item.id];
  if (!assetGroup) return;

  let src;
  if (!item._worn) {
    src = assetGroup.new;
  } else if (item.id === "stroller" && item._fromRonitL) {
    src = assetGroup.usedRonit;
  } else {
    src = assetGroup.used;
  }

  if (item.id === "crib") {
    // Sleeping variant only in act 2 action phase (baby is asleep inside crib).
    // Act 1, act 2 lullaby (baby crying outside), act 2 crying → empty crib.
    const isAct2 = typeof gameState !== "undefined" && gameState.act === 2;
    const showWithBaby = isAct2 &&
                         gameState.stealthActive &&
                         !gameState.lullabyPhase;
    if (showWithBaby) {
      src = item._worn ? assetGroup.usedSleeping : assetGroup.newSleeping;
    } else {
      src = item._worn ? assetGroup.used : assetGroup.new;
    }
  }

  // Use player-saved position if available, otherwise fall back to defaults
  const saved = (typeof gameState !== "undefined" && gameState.itemPositions)
    ? gameState.itemPositions[item.id]
    : null;
  const layout = saved || ITEM_LAYOUT[item.id];
  if (!layout) return;

  if (!el) {
    el = document.createElement("img");
    el.id  = elId;
    el.alt = item.name;
    el.style.cssText = `
      position: absolute;
      object-fit: contain;
      object-position: bottom center;
      z-index: 1;
      pointer-events: auto;
      cursor: grab;
      opacity: 0;
      transform: scale(0.8) translateY(20px);
      transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1);
      filter: drop-shadow(2px 8px 6px rgba(0,0,0,0.25));
    `;
    container.appendChild(el);
    _attachItemHandles(el, item, container);
  }

  el.src                  = src;
  el.style.left           = layout.left;
  el.style.bottom         = layout.bottom;
  el.style.width          = layout.width;
  el.style.height         = "auto";
  el.style.objectFit      = "contain";
  el.style.objectPosition = "bottom center";
  el.style.filter         = "drop-shadow(2px 8px 6px rgba(0,0,0,0.25))";
  el.style.display        = "block";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.opacity   = "1";
      el.style.transform = "scale(1) translateY(0)";
    });
  });
}

// ── רינדור כל החדר ────────────────────────────────────────────
function renderRoom() {
  initRoomBackground();
  if (typeof gameState === "undefined") return;
  gameState.items.forEach(item => renderItem(item));
}

// ── תאימות עם game.js ─────────────────────────────────────────
function showSprite(itemId) {
  renderRoom();
}

// ── גרירה ושינוי גודל פריטים ─────────────────────────────────
function _attachItemHandles(el, item, container) {
  if (el.dataset.handlesAttached) return;
  el.dataset.handlesAttached = "1";

  // Subtle L-shaped resize handle in the bottom-right corner
  const handle = document.createElement("div");
  handle.style.cssText = `
    position: absolute;
    width: 18px; height: 18px;
    border-right: 3px solid rgba(255,255,255,0.65);
    border-bottom: 3px solid rgba(255,255,255,0.65);
    border-radius: 0 0 4px 0;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
    cursor: se-resize;
    z-index: 10;
    display: none;
    pointer-events: auto;
  `;
  container.appendChild(handle);

  function syncHandle() {
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.width === 0) return;
    handle.style.left    = (er.right  - cr.left - 18) + "px";
    handle.style.top     = (er.bottom - cr.top  - 18) + "px";
    handle.style.display = "block";
  }
  el.addEventListener("load", () => setTimeout(syncHandle, 450));
  setTimeout(syncHandle, 550);

  function getInitLayout() {
    const saved = (typeof gameState !== "undefined" && gameState.itemPositions)
      ? gameState.itemPositions[item.id]
      : null;
    const base = saved || ITEM_LAYOUT[item.id];
    return {
      left:   parseFloat(base.left),
      bottom: parseFloat(base.bottom),
      width:  parseFloat(base.width),
    };
  }

  function saveLayout(left, bottom, width) {
    if (typeof gameState !== "undefined" && gameState.itemPositions) {
      gameState.itemPositions[item.id] = {
        left:   left.toFixed(1)   + "%",
        bottom: bottom.toFixed(1) + "%",
        width:  width.toFixed(1)  + "%",
      };
    }
  }

  function getTouchPos(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  // Drag image to reposition — mouse
  el.addEventListener("mousedown", e => {
    if (e.target === handle) return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  // Drag image to reposition — touch
  el.addEventListener("touchstart", e => {
    if (e.target === handle) return;
    e.preventDefault();
    const pos = getTouchPos(e);
    startDrag(pos.clientX, pos.clientY);
  }, { passive: false });

  function startDrag(startX, startY) {
    const cr   = container.getBoundingClientRect();
    const init = getInitLayout();
    let curL = init.left, curB = init.bottom;

    el.style.zIndex     = "50";
    el.style.cursor     = "grabbing";
    el.style.transition = "none";

    function onMove(clientX, clientY) {
      curL = Math.max(0, Math.min(85, init.left   + (clientX - startX) / cr.width  * 100));
      curB = Math.max(0, Math.min(35, init.bottom - (clientY - startY) / cr.height * 100));
      el.style.left   = curL.toFixed(1) + "%";
      el.style.bottom = curB.toFixed(1) + "%";
      syncHandle();
    }
    function onUp() {
      el.style.zIndex     = "1";
      el.style.cursor     = "grab";
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      saveLayout(curL, curB, init.width);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
    }
    function onMouseMove(e) { onMove(e.clientX, e.clientY); }
    function onMouseUp()    { onUp(); }
    function onTouchMove(e) { const p = getTouchPos(e); onMove(p.clientX, p.clientY); }
    function onTouchEnd()   { onUp(); }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend",  onTouchEnd);
  }

  // Drag corner handle to resize — mouse
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();
    startResize(e.clientX);
  });

  // Drag corner handle to resize — touch
  handle.addEventListener("touchstart", e => {
    e.preventDefault();
    e.stopPropagation();
    startResize(getTouchPos(e).clientX);
  }, { passive: false });

  function startResize(startX) {
    const cr   = container.getBoundingClientRect();
    const init = getInitLayout();
    let curW   = init.width;

    function onMove(clientX) {
      curW = Math.max(4, Math.min(60, init.width + (clientX - startX) / cr.width * 100));
      el.style.width = curW.toFixed(1) + "%";
      syncHandle();
    }
    function onUp() {
      saveLayout(init.left, init.bottom, curW);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
    }
    function onMouseMove(e) { onMove(e.clientX); }
    function onMouseUp()    { onUp(); }
    function onTouchMove(e) { onMove(getTouchPos(e).clientX); }
    function onTouchEnd()   { onUp(); }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend",  onTouchEnd);
  }
}

// ── מצב רוח חדר (יום / לילה) ─────────────────────────────────
function setRoomMood(mood) {
  const bg = document.getElementById("room-asset-bg");
  if (!bg) return;

  if (mood === "night") {
    bg.style.opacity = "0";
    setTimeout(() => {
      bg.src = "assets/NightRoom.png";
      bg.style.opacity = "1";
    }, 600);
  } else if (mood === "day") {
    bg.style.opacity = "0";
    setTimeout(() => {
      bg.src = "assets/EmptyBabyRoom.png";
      bg.style.opacity = "1";
    }, 600);
  }
}

// ── תינוקת בעריסה ─────────────────────────────────────────────
function renderBaby(state) {
  // state: "sleeping" | "crying" | "hidden"
  const container = document.getElementById("room-view");
  if (!container) return;

  const crib = (typeof gameState !== "undefined")
    ? gameState.items.find(i => i.id === "crib")
    : null;

  if (state === "sleeping") {
    // Hide the separate baby element — baby appears inside the crib asset
    const babyEl = document.getElementById("room-baby");
    if (babyEl) babyEl.style.display = "none";

    // Swap crib to sleeping variant
    if (crib && crib.inHouse) {
      const el = document.getElementById("room-item-crib");
      if (el) el.src = crib._worn
        ? ASSETS.crib.usedSleeping
        : ASSETS.crib.newSleeping;
    }
    return;
  }

  if (state === "crying") {
    // Restore empty crib asset
    if (crib && crib.inHouse) {
      const el = document.getElementById("room-item-crib");
      if (el) el.src = crib._worn
        ? ASSETS.crib.used
        : ASSETS.crib.new;
    }

    // Show crying baby outside crib
    let babyEl = document.getElementById("room-baby");
    if (!babyEl) {
      babyEl = document.createElement("img");
      babyEl.id = "room-baby";
      babyEl.style.cssText = `
        position: absolute;
        object-fit: contain;
        z-index: 2;
        pointer-events: none;
        transition: opacity 0.6s ease, bottom 0.4s ease, left 0.4s ease;
      `;
      container.appendChild(babyEl);
    }
    babyEl.src            = BABY_ASSETS.crying;
    babyEl.style.display  = "block";
    babyEl.style.opacity  = "1";
    babyEl.style.left     = "3%";
    babyEl.style.bottom   = "18%";
    babyEl.style.width    = "14%";
    babyEl.classList.add("baby-crying");
    babyEl.classList.remove("lullaby");
    return;
  }

  if (state === "hidden") {
    const babyEl = document.getElementById("room-baby");
    if (babyEl) babyEl.style.display = "none";
    // Restore empty crib
    if (crib && crib.inHouse) renderItem(crib);
  }
}
