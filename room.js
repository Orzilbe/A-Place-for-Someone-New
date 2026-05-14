// ══════════════════════════════════════════════════════════════
//  room.js — חדר תינוקת עם אסטים
// ══════════════════════════════════════════════════════════════

// ── מיפוי אסטים ───────────────────────────────────────────────
const ASSETS = {
  room: "assets/EmptyBabyRoom.png",
  crib: {
    new:  "assets/NewCrib.png",
    used: "assets/Second-handCrib.png",
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
  crib:     { left: "2%",  bottom: "4%",  width: "24%" },
  dresser:  { left: "22%", bottom: "4%",  width: "20%" },
  stroller: { left: "38%", bottom: "2%",  width: "22%" },
  carseat:  { left: "57%", bottom: "2%",  width: "20%" },
  clothes:  { left: "74%", bottom: "5%",  width: "18%" },
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
    object-fit: cover;
    object-position: center;
    z-index: 0;
    pointer-events: none;
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
      object-position: bottom;
      z-index: 1;
      pointer-events: auto;
      cursor: grab;
      opacity: 0;
      transform: scale(0.88) translateY(12px);
      transition: opacity 0.4s ease, transform 0.4s ease;
    `;
    container.appendChild(el);
    _attachItemHandles(el, item, container);
  }

  el.src           = src;
  el.style.left    = layout.left;
  el.style.bottom  = layout.bottom;
  el.style.width   = layout.width;
  el.style.height  = "auto";
  el.style.display = "block";

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

  // Drag image to reposition
  el.addEventListener("mousedown", e => {
    if (e.target === handle) return;
    e.preventDefault();

    const cr    = container.getBoundingClientRect();
    const init  = getInitLayout();
    const startX = e.clientX;
    const startY = e.clientY;
    let curL = init.left, curB = init.bottom;

    el.style.zIndex     = "50";
    el.style.cursor     = "grabbing";
    el.style.transition = "none";

    function onMove(e) {
      curL = Math.max(0, Math.min(90, init.left   + (e.clientX - startX) / cr.width  * 100));
      curB = Math.max(0, Math.min(90, init.bottom - (e.clientY - startY) / cr.height * 100));
      el.style.left   = curL.toFixed(1) + "%";
      el.style.bottom = curB.toFixed(1) + "%";
      syncHandle();
    }
    function onUp() {
      el.style.zIndex     = "1";
      el.style.cursor     = "grab";
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      saveLayout(curL, curB, init.width);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });

  // Drag corner handle to resize
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();

    const cr     = container.getBoundingClientRect();
    const init   = getInitLayout();
    const startX = e.clientX;
    let curW = init.width;

    function onMove(e) {
      curW = Math.max(4, Math.min(60, init.width + (e.clientX - startX) / cr.width * 100));
      el.style.width = curW.toFixed(1) + "%";
      syncHandle();
    }
    function onUp() {
      saveLayout(init.left, init.bottom, curW);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });
}
