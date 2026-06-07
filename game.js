// ═══════════════════════════════════════════════════════════════════════════
//  מקום למישהי חדשה — game.js
// ═══════════════════════════════════════════════════════════════════════════

// ── מחלקת פריט ─────────────────────────────────────────────────────────────
class GameItem {
  constructor(id, name, emoji, costNew, costUsed, allowWhatsapp = false, gender = "f") {
    this.id            = id;
    this.name          = name;
    this.emoji         = emoji;
    this.costNew       = costNew;
    this.costUsed      = costUsed;
    this.allowWhatsapp = allowWhatsapp;
    this.gender        = gender; // "f" = feminine, "m" = masculine
    this.isSecured     = false;
    this.inHouse       = false;
  }
}

// ── מצב המשחק הגלובלי ───────────────────────────────────────────────────────
const gameState = {
  budget:               4000,
  sanity:               100,
  superstition:         false,
  superstitionFate:     null,   // "good" | "neutral" | "bad" — נקבע בסתר בעת הבחירה
  babyMeterSlowdown:    1.0,    // 0.6 במסלול מזל טוב
  act:                  1,
  items:                [],
  callPending:          false,
  callTimer:            null,
  sleepCycle:           0,
  totalCycles:          4,
  lullabyPhase:         false,
  babyCried:            false,
  stealthListenerAdded: false,
  babyMeter:            0,
  stealthActive:        false,
  negotiating:          false,
  choiceMade:           false,
  roniConvoHistory:     [],
  itemPositions:        {},
  tasksDone: {
    pump:    false,
    laundry: false,
  },
  loanFromMom: false,
  loanFromDad: false,
  // ── מצב מחזה ב׳ — טיימר שינה ומיני־משחקים ──
  sleepTimer:        0,
  sleepTimerTimeout: null,
  activeMinigame:    null,   // "pump" | "laundry" | "coffee" | "reading"
  minigameCleanup:   null,   // () => void — מנקה DOM/טיימרים כשהתינוקת בוכה
  readingMode:       false,  // משאיר את stealthMouseHandler בעדינות יתרה
  endingTriggered:   false,  // true ברגע שהיום נגמר — חוסם השכמות/הרדמות נוספות
  couponUsed:        false,
  couponItem:        null,
  couponDiscount:    null,
};

// ── טיימר שינה — מחזה ב׳ ───────────────────────────────────────────────
function startSleepTimer() {
  clearSleepTimer();
  gameState.sleepTimer = Math.random() * 20000 + 20000;   // 20–40s
  gameState.sleepTimerTimeout = setTimeout(() => {
    gameState.sleepTimerTimeout = null;
    if (gameState.stealthActive && !gameState.lullabyPhase) {
      triggerBabyCrying();
    }
  }, gameState.sleepTimer);
}

function clearSleepTimer() {
  if (gameState.sleepTimerTimeout) {
    clearTimeout(gameState.sleepTimerTimeout);
    gameState.sleepTimerTimeout = null;
  }
}

function runMinigameCleanup() {
  if (typeof gameState.minigameCleanup === "function") {
    try { gameState.minigameCleanup(); } catch (e) { console.error(e); }
  }
  gameState.minigameCleanup = null;
  gameState.activeMinigame  = null;
  gameState.readingMode     = false;
}

// ── מנהל שמע — Web Audio API ────────────────────────────────────────────────
let soundEnabled = true;

const SoundManager = {
  ctx: null,

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },

  babyCry() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const duration = 1.8;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const distortion = ctx.createWaveShaper();

    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
    }
    distortion.curve = curve;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.3);
    osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.7);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.2);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + duration - 0.2);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(distortion);
    distortion.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  },

  phoneRing() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;

    const playRing = (startTime) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.value = 480;
      osc2.frequency.value = 620;
      osc1.type = "sine";
      osc2.type = "sine";

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.35);
      gainNode.gain.linearRampToValueAtTime(0, startTime + 0.4);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + 0.4);
      osc2.start(startTime);
      osc2.stop(startTime + 0.4);
    };

    playRing(ctx.currentTime);
    playRing(ctx.currentTime + 0.5);
  },

  moneySpend() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => {
      if (!this.ctx) return;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(900, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.1, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.2);
    }, 120);
  },

  itemSecured() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const notes = [523, 659, 784]; // C, E, G

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;

      osc.type = "sine";
      osc.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.12, t + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },

  sanityDrain() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },

  softClick() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  },

  lullabySuccess() {
    if (!soundEnabled) return;
    this.init();
    const ctx = this.ctx;
    const notes = [392, 494, 587]; // G, B, D

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const t = ctx.currentTime + i * 0.2;

      osc.type = "sine";
      osc.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.08, t + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    });
  },
};

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById("sound-toggle");
  if (btn) btn.textContent = soundEnabled ? "🔊" : "🔇";
  const mobIcon = document.getElementById("mob-sound-icon");
  if (mobIcon) mobIcon.textContent = soundEnabled ? "🔊" : "🔇";
}

// ── מצב טלפון ───────────────────────────────────────────────────────────────
const phoneState = {
  notifications: 0,
};
let _groupActive = false;
let _groupVisitCount = 0;

// ── נתוני איש קשר ───────────────────────────────────────────────────────────
const chatHistories = {
  oriel: [], mom: [], dad: [], maya: [], shira: [], noa: [], dana: [],
  ronit: [], hadar: [],
};

function revealContactRow(contactId) {
  const row = document.querySelector(`.contact-row[data-contact="${contactId}"]`);
  if (row) row.classList.remove("hidden");
}

const CONTACT_PROMPTS = {
  oriel: () => ORIEL_WHATSAPP_PROMPT,
  mom:   () => MOM_WHATSAPP_PROMPT,
  dad:   () => DAD_CALL_PROMPT,
 // maya:  () => MAYA_PROMPT,
 // shira: () => SHIRA_PROMPT,
 // noa:   () => NOA_PROMPT,
 // dana:  () => DANA_PROMPT,
};

const CONTACT_NAMES = {
  oriel: "אוריאל ❤️",
  mom:   "אמא",
  dad:   "אבא",
 // maya:  "מאיה 🌸",
  //shira: "שירה",
  //noa:   "נועה 🎀",
  //dana:  "דנה 😎",
};

const ITEMS_DATA = [
  new GameItem("crib",     "עריסה",        "🛏️",  1200, 600, false, "f"),
  new GameItem("dresser",  "שידה",         "🗄️",   800, 500, false, "f"),
  new GameItem("stroller", "עגלה",         "🛒",  1500, 700, false, "f"),
  new GameItem("carseat",  "כיסא בטיחות", "💺",   900, 400, false, "m"),
  new GameItem("clothes",  "בגדי תינוקת", "👕",   300,  80, true,  "f"),
];

// ── רפרנסים ל-DOM ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const hudAct         = $("hud-act");
const narrationText  = $("narration-text");
const choiceButtons  = $("choice-buttons");
const phoneOverlay   = $("phone-overlay");
const phoneContent   = $("phone-content");
const phoneInputArea = $("phone-input-area");
const phoneTextInput = $("phone-text-input");
const phoneSendBtn   = $("phone-send-btn");
const phoneAppName   = $("phone-app-name");
const phoneCloseBtn  = $("phone-close-btn");
const callBanner     = $("call-banner");
const actFade        = $("act-fade-overlay");
const actFadeText    = $("act-fade-text");
const babyMeterCont  = $("baby-meter-container");
const babyMeterFill  = $("baby-meter-fill");

// ── עדכון לוח הצד ────────────────────────────────────────────────────────────
function updateHUD() {
  const budgetVal = document.getElementById("hud-budget-val");
  if (budgetVal) {
    budgetVal.textContent = gameState.budget.toLocaleString("he-IL") + " ₪";
    if (gameState.budget === 0) {
      budgetVal.style.color = "#c03030";
    } else if (gameState.budget < 300) {
      budgetVal.style.color = "#e07030";
    } else if (gameState.budget < 1000) {
      budgetVal.style.color = "#c8a030";
    } else {
      budgetVal.style.color = "#4a7c59";
    }
  }

  const heartsEl = document.getElementById("sanity-hearts");
  if (heartsEl) {
    heartsEl.innerHTML = "";
    const filled = Math.round(gameState.sanity / 10);
    for (let i = 0; i < 10; i++) {
      const span = document.createElement("span");
      if (i < filled) {
        span.textContent = "🩷";
      } else {
        span.textContent = "🤍";
        span.classList.add("empty");
        span.style.opacity = "0.35";
      }
      heartsEl.appendChild(span);
    }
    if (gameState.sanity < 40) {
      heartsEl.classList.add("danger");
    } else {
      heartsEl.classList.remove("danger");
    }
    const oldPct = heartsEl.parentElement.querySelector(".sanity-pct");
    if (oldPct) oldPct.remove();
    const pct = document.createElement("div");
    pct.classList.add("sanity-pct");
    pct.style.cssText = "font-size:0.7rem;color:var(--muted);margin-top:2px;";
    pct.textContent = gameState.sanity + "%";
    heartsEl.parentElement.appendChild(pct);
  }

  const itemsEl = document.getElementById("item-icons");
  if (itemsEl) {
    itemsEl.innerHTML = "";
    const thumbs = {
      crib:     "assets/NewCrib.png",
      dresser:  "assets/NewDresser.png",
      stroller: "assets/NewStroller.png",
      carseat:  "assets/NewCarseat.png",
      clothes:  "assets/NewBabyClothes.png",
    };
    gameState.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-thumb" + (item.isSecured ? " secured" : "");
      const img = document.createElement("img");
      img.src = thumbs[item.id] || "";
      img.alt = item.name;
      const label = document.createElement("span");
      label.textContent = item.name;
      row.appendChild(img);
      row.appendChild(label);
      itemsEl.appendChild(row);
    });
  }

  const cycleEl = document.getElementById("hud-cycle");
  if (cycleEl) {
    if (gameState.act === 2) {
      cycleEl.style.display = "flex";
      const valEl = cycleEl.querySelector(".stat-value");
      if (valEl) valEl.textContent = `חלון ${gameState.sleepCycle + 1} מתוך ${gameState.totalCycles}`;
    } else {
      cycleEl.style.display = "none";
    }
  }

  // ── סנכרון סרגל תחתון למובייל ─────────────────────────────────
  const mobBudget = document.getElementById("mob-budget-val");
  if (mobBudget) {
    mobBudget.textContent = gameState.budget.toLocaleString("he-IL") + " ₪";
    mobBudget.style.color = gameState.budget === 0
      ? "#c03030"
      : gameState.budget < 1000
        ? "#c8a030"
        : "#4a7c59";
  }

  const mobHearts = document.getElementById("mob-hearts");
  if (mobHearts) {
    const filled = Math.round(gameState.sanity / 10);
    mobHearts.textContent = "🩷".repeat(filled) + "🤍".repeat(10 - filled);
  }

  const mobItems = document.getElementById("mob-items-val");
  if (mobItems) {
    const secured = gameState.items.filter(i => i.isSecured).length;
    mobItems.textContent = secured + "/5";
  }

  const mobDot = document.getElementById("mob-phone-dot");
  const desktopDot = document.getElementById("phone-notification-dot");
  if (mobDot && desktopDot) {
    if (desktopDot.classList.contains("hidden")) {
      mobDot.classList.add("hidden");
    } else {
      mobDot.classList.remove("hidden");
    }
  }
}

// ── עדכוני תקציב / שפיות ────────────────────────────────────────────────────
function spendBudget(amount) {
  gameState.budget = Math.max(0, gameState.budget - amount);
  if (amount > 0) SoundManager.moneySpend();
  updateHUD();

  const budgetEl = document.getElementById("hud-budget-val");
  if (budgetEl) {
    budgetEl.classList.remove("pulse-red");
    void budgetEl.offsetWidth;
    budgetEl.classList.add("pulse-red");
    setTimeout(() => budgetEl.classList.remove("pulse-red"), 600);
  }

  if (gameState.budget < 1000 && gameState.budget > 0) {
    drainSanity(2);
    showToast("התקציב דל. הלחץ עולה. −2 שפיות 💸");
  }

  if (gameState.budget === 0) {
    drainSanity(5);
    narrate(`<strong>נגמר הכסף.</strong><br>עמדת מול הרשימה ריקת הידיים. חלק מהפריטים כבר לא בהישג יד. −5 שפיות.`);
    showToast("אין יותר תקציב. −5 שפיות 💸");
  }
}

function updateSanityFilter() {
  const wrapper = document.getElementById("game-wrapper");
  wrapper.classList.remove("sanity-low", "sanity-critical");
  if (gameState.sanity < 40) wrapper.classList.add("sanity-low");
  if (gameState.sanity < 20) wrapper.classList.add("sanity-critical");
}

function drainSanity(amount) {
  SoundManager.sanityDrain();
  gameState.sanity = Math.max(0, gameState.sanity - amount);
  updateHUD();
  updateSanityFilter();
  const heartsEl = document.getElementById("sanity-hearts");
  if (heartsEl) {
    heartsEl.classList.remove("pulse-red");
    void heartsEl.offsetWidth;
    heartsEl.classList.add("pulse-red");
    setTimeout(() => heartsEl.classList.remove("pulse-red"), 600);
  }
  if (gameState.sanity <= 0) triggerBadEnding();
}

function restoreSanity(amount) {
  gameState.sanity = Math.min(100, gameState.sanity + amount);
  updateHUD();
  updateSanityFilter();
}

// ── הגרלת גורל האמונות הטפלות ────────────────────────────────────────────────
// נקראת פעם אחת כשהשחקנית בוחרת להקשיב לאמא.
// התוצאה נשמרת בסתר — השחקנית לא יודעת מה הוגרל.
function rollSuperstitionFate() {
  const roll = Math.random();
  if (roll < 0.33) {
    gameState.superstitionFate = "good";
  } else if (roll < 0.66) {
    gameState.superstitionFate = "neutral";
  } else {
    gameState.superstitionFate = "bad";
  }
}

// ── החלת גורל האמונות בתחילת היום הראשון ────────────────────────────────────────
function applySuperstitionFate() {
  switch (gameState.superstitionFate) {

    case "good":
      gameState.babyMeterSlowdown = 0.6; // מד עולה 40% לאט יותר
      setTimeout(() => {
        showToast("התינוקת נרגעת מהר. אולי אמא שלך ידעה משהו. 🍀");
        narrate(`
          את בבית. התינוקת ישנה בכיסא הבטיחות במסדרון.<br><br>
          חמש קופסאות ערוכות באמצע החדר. הנשימה שלה שקטה ואחידה —
          שקטה יותר מהרגיל, כאילו היא יודעת שאת צריכה רגע.<br><br>
          <em>זזי בזהירות. אל תעירי אותה.</em>
        `);
      }, 500);
      break;

    case "neutral":
      gameState.babyMeterSlowdown = 1.0;
      setTimeout(() => {
        narrate(`
          את בבית. התינוקת ישנה בכיסא הבטיחות במסדרון.<br><br>
          חמש קופסאות ערוכות באמצע החדר. קשה לדעת אם זה עזר.
          אבל לפחות שמרת על השלום עם אמא.<br><br>
          <em>זזי בזהירות. אל תעירי אותה.</em>
        `);
      }, 500);
      break;

    case "bad":
      gameState.babyMeterSlowdown = 1.0;
      // קופסה "נפלה" — מד הערות קופץ מיד בכניסה
      setTimeout(() => {
        narrate(`
          את בבית. התינוקת ישנה בכיסא הבטיחות במסדרון.<br><br>
          חמש קופסאות ערוכות באמצע החדר. אחת מהן הייתה על הקצה —
          ונפלה ברגע שנכנסת.<br><br>
          <em>רעש. שקט. נשימה. עוד לא בכתה. עוד לא.</em>
        `);
        setTimeout(() => {
          increaseBabyMeter(35);
          showToast("הקופסה נפלה. מד הערות קפץ. 😬");
        }, 1800);
      }, 500);
      break;
  }
}

// ── הודעת טוסט ──────────────────────────────────────────────────────────────
let toastEl;
function showToast(msg, duration = 3500) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

// ── עדכון נרטיב וכפתורי בחירה ───────────────────────────────────────────────
function narrate(text) {
  narrationText.innerHTML = text;
}

function setChoices(choices) {
  choiceButtons.innerHTML = "";
  choices.forEach(({ label, action, primary }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (primary) btn.classList.add("primary");
    if (label.includes("(אין תקציב)")) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
      btn.style.pointerEvents = "none";
    } else {
      btn.addEventListener("click", () => {
        choiceButtons.querySelectorAll("button").forEach(b => {
          b.disabled = true;
          b.style.opacity = "0.5";
          b.style.cursor = "not-allowed";
        });
        action();
      });
    }
    choiceButtons.appendChild(btn);
  });
}

// ── בדיקה אם כל הפריטים הובטחו ──────────────────────────────────────────────
function checkAllSecured() {
  if (gameState.items.every(i => i.isSecured)) {
    setTimeout(triggerActTransition, 800);
  }
}

// ── סימון פריט כמובטח ───────────────────────────────────────────────────────
function secureItem(item, cost, fromRonitL = false, forceNew = false) {
  item.isSecured = true;
  SoundManager.itemSecured();
  item._worn = forceNew ? false : (cost < item.costNew && cost > 0);
  if (fromRonitL) item._fromRonitL = true;
  if (!gameState.superstition) {
    item.inHouse = true;
    renderRoom();
    showToast(`${item.name} כבר בחדר התינוקת! 🏠`);
  } else {
    showToast(`${item.name} נרכש — ממתין בחוץ בקופסה. 📦`);
  }
  if (cost > 0) spendBudget(cost);
  updateHUD();
  checkAllSecured();
}

// ── תפריט קנייה לפריט בודד ──────────────────────────────────────────────────
function showItemMenu(item) {
  if (item.isSecured) {
    narrate(`<em>${item.name}</em> כבר ${item.gender === "f" ? "טופלה" : "טופל"}. ✓`);
    showMainItemList();
    return;
  }

  if (gameState.budget === 0) {
    narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>אין תקציב. אפשר לחפש בחינם בלבד.</em>`);
    const choices = [];
    if (item.id === "clothes") {
      choices.push({
        label: "💬 בדקי בקבוצה - אולי יש בחינם",
        primary: true,
        action: () => openWhatsAppGroup(null)
      });
    }
    choices.push({ label: "← חזרה", action: showMainItemList });
    setChoices(choices);
    return;
  }

  const hasCoupon = gameState.couponItem === item.id;
  const buyPrice  = hasCoupon ? gameState.couponDiscount : item.costNew;

  const choices = [
    {
      label: hasCoupon
        ? `קנייה חדשה — 🎟️ ${gameState.couponDiscount.toLocaleString()} ₪ (במקום ${item.costNew.toLocaleString()})${gameState.budget < gameState.couponDiscount ? " (אין תקציב)" : ""}`
        : `קנייה חדשה — ${item.costNew.toLocaleString()} ₪${gameState.budget < item.costNew ? " (אין תקציב)" : ""}`,
      action: () => {
        if (gameState.budget < buyPrice) return;
        if (gameState.budget < 300 && buyPrice > 400) {
          drainSanity(3);
          showToast("זה מחוץ להישג יד עכשיו. −3 שפיות 💸");
          narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>עמדת מול המחיר ולא יכולת. אולי יד שנייה? אולי הקבוצה?</em>`);
          return;
        }
        narrate(`הזמנת <em>${item.name}</em> ${item.gender === "f" ? "חדשה לגמרי. יקרה." : "חדש לגמרי. טרי. יקר."} שווה את זה.`);
        secureItem(item, buyPrice, false, hasCoupon);
        setTimeout(showMainItemList, 1200);
      }
    },
    {
      label: `יד שנייה — מ-${item.costUsed.toLocaleString()} ₪`,
      action: () => {
        if (gameState.budget < 300 && item.costUsed > 400) {
          drainSanity(2);
          showToast("גם יד שנייה זה יותר מדי עכשיו. −2 שפיות 💸");
          return;
        }
        if (item.id === "dresser") {
          openRonitNegotiation(item);
        } else {
          openGenericNegotiation(item);
        }
      }
    }
  ];

  choices.push({ label: "← חזרה", action: showMainItemList });

  if (item.id === "clothes") {
    narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>חדש עולה ${item.costNew.toLocaleString()} ₪. איך תטפלי בזה?</em><br><small style="color:var(--muted);font-size:0.78rem;">💬 אולי שווה לבדוק את הטלפון — לפעמים אמהות מחלקות דברים בקבוצות...</small>`);
  } else {
    narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>חדש עולה ${item.costNew.toLocaleString()} ₪. איך תטפלי בזה?</em>`);
  }
  setChoices(choices);
}

// ── הצעות תשובה מהירה ───────────────────────────────────────────────────────
function showQuickReplies(replies) {
  const existing = document.getElementById("quick-replies");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "quick-replies";
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 8px;
    background: #f5f5f5;
    border-top: 1px solid #e0e0e0;
    direction: rtl;
  `;

  replies.forEach(text => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      background: white;
      border: 1.5px solid var(--sage-dark);
      border-radius: 16px;
      padding: 6px 14px;
      font-size: 0.8rem;
      color: var(--charcoal);
      cursor: pointer;
      text-align: right;
      font-family: inherit;
      transition: background 0.15s;
    `;
    btn.addEventListener("mouseenter", () => btn.style.background = "#f0f0f0");
    btn.addEventListener("mouseleave", () => btn.style.background = "white");
    btn.addEventListener("click", () => {
      phoneTextInput.value = text;
      container.remove();
      phoneSendBtn.click();
    });
    container.appendChild(btn);
  });

  const inputArea = document.getElementById("phone-input-area");
  inputArea.parentNode.insertBefore(container, inputArea);
}

// ── שיחת הלוואה עם הורה ─────────────────────────────────────────────────────
function openLoanChat(contact) {
  const isMom = contact === "mom";
  const name   = isMom ? "אמא" : "אבא";
  const avatar = isMom ? "👩" : "👨";

  let systemPrompt;
  if (isMom) {
    if (gameState.superstition) {
      systemPrompt = `
את האמא של השחקנית. הבת שלך הקשיבה לך בתחילת ההריון ועשתה מה שביקשת.
את גאה בה מאוד ואוהבת אותה ללא תנאי.
היא מתקשרת כי אין לה כסף לסיים לקנות ציוד לתינוקת.
עני בחמימות, תציעי לעזור כלכלית מיד בלי שיפוט.
הסכום שתציעי: בין 300 ל-600 שקל, לפי שיקול דעתך לפי תחושת השיחה.
אחרי שהשחקנית מסכימה — סיימי את השיחה בחמימות.
כתבי בעברית יומיומית וחמה. פני בלשון נקבה.

חשוב מאוד: אל תציגי את ה-JSON בהודעה. הטקסט שבשדה text הוא בלבד מה שהמשתמשת רואה.
פורמט תשובה — JSON בלבד. ללא markdown. ללא טקסט מחוץ ל-JSON.
סכמה: { "text": "<ההודעה שלך>", "loanAmount": <מספר או null>, "loanClosed": <true או false> }

כללי הסגירה:
- loanClosed: false כל עוד לא הוסכם על סכום
- כשהשחקנית אומרת כן / בסדר / תודה / יאללה / מסכימה — הגדירי loanClosed: true ו-loanAmount למספר שהצעת
- אל תשאלי אישור נוסף — ברגע שהיא מסכימה, סגרי את העסקה
      `.trim();
    } else {
      systemPrompt = `
את האמא של השחקנית. הבת שלך לא הקשיבה לך בתחילת ההריון.
את אוהבת אותה אבל לא יכולה שלא להגיד "אמרתי לך".
היא מתקשרת כי אין לה כסף לסיים לקנות ציוד לתינוקת.
עני בשיחה — תעזרי בסוף אבל תוסיפי הערה אחת על כך שלא הקשיבה.
הסכום שתציעי: בין 300 ל-500 שקל.
אחרי שהשחקנית מסכימה — סיימי עם הערה קטנה ואהבה.
כתבי בעברית יומיומית. פני בלשון נקבה.

חשוב מאוד: אל תציגי את ה-JSON בהודעה. הטקסט שבשדה text הוא בלבד מה שהמשתמשת רואה.
פורמט תשובה — JSON בלבד. ללא markdown. ללא טקסט מחוץ ל-JSON.
סכמה: { "text": "<ההודעה שלך>", "loanAmount": <מספר או null>, "loanClosed": <true או false> }

כללי הסגירה:
- loanClosed: false כל עוד לא הוסכם על סכום
- כשהשחקנית אומרת כן / בסדר / תודה / יאללה / מסכימה — הגדירי loanClosed: true ו-loanAmount למספר שהצעת
- אל תשאלי אישור נוסף — ברגע שהיא מסכימה, סגרי את העסקה
      `.trim();
    }
  } else {
    if (gameState.superstition) {
      systemPrompt = `
אתה האבא של השחקנית. הבת שלך מתקשרת כי אין לה כסף לסיים לקנות ציוד לתינוקת.
אתה אוהב אותה אבל קצת מופתע שהיא צריכה עזרה כלכלית.
עני בחמימות אבל עם קצת שאלות — "כמה בדיוק צריך? על מה הכסף הלך?"
בסוף תעזור — הסכום: בין 200 ל-500 שקל.
כתבי בעברית פשוטה. פנה בלשון נקבה.

חשוב מאוד: אל תציגי את ה-JSON בהודעה. הטקסט שבשדה text הוא בלבד מה שהמשתמשת רואה.
פורמט תשובה — JSON בלבד. ללא markdown. ללא טקסט מחוץ ל-JSON.
סכמה: { "text": "<ההודעה שלך>", "loanAmount": <מספר או null>, "loanClosed": <true או false> }

כללי הסגירה:
- loanClosed: false כל עוד לא הוסכם על סכום
- כשהשחקנית אומרת כן / בסדר / תודה / יאללה / מסכימה — הגדירי loanClosed: true ו-loanAmount למספר שהצעת
- אל תשאלי אישור נוסף — ברגע שהיא מסכימה, סגרי את העסקה
      `.trim();
    } else {
      systemPrompt = `
אתה האבא של השחקנית. הבת שלך מתקשרת כי אין לה כסף לסיים לקנות ציוד לתינוקת.
אתה נותן בלי לשאול שאלות ובלי שיפוט. זו הבת שלך.
עני בחום ובקצרה — משפט תומך ומציע עזרה מיד.
הסכום: בין 300 ל-600 שקל לפי תחושת השיחה.
כתבי בעברית פשוטה וקצרה. פנה בלשון נקבה.

חשוב מאוד: אל תציגי את ה-JSON בהודעה. הטקסט שבשדה text הוא בלבד מה שהמשתמשת רואה.
פורמט תשובה — JSON בלבד. ללא markdown. ללא טקסט מחוץ ל-JSON.
סכמה: { "text": "<ההודעה שלך>", "loanAmount": <מספר או null>, "loanClosed": <true או false> }

כללי הסגירה:
- loanClosed: false כל עוד לא הוסכם על סכום
- כשהשחקנית אומרת כן / בסדר / תודה / יאללה / מסכימה — הגדירי loanClosed: true ו-loanAmount למספר שהצעת
- אל תשאלי אישור נוסף — ברגע שהיא מסכימה, סגרי את העסקה
      `.trim();
    }
  }

  const homeEl = document.getElementById("phone-home");
  if (homeEl) homeEl.classList.add("hidden");
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.remove("hidden");
  phoneAppName.textContent = `${avatar} ${name}`;
  $("phone-status-bar").style.background = "#3a3a3a";
  phoneContent.innerHTML = "";
  phoneSendBtn.onclick = null;
  phoneTextInput.onkeydown = null;
  phoneOverlay.classList.remove("hidden");

  const history = [];

  const opening = isMom ? "שלום אהובתי, מה קרה?" : "היי מה שלומך? הכל בסדר?";
  addChatBubble(name, opening, "ronit");
  history.push({ role: "model", text: opening });

  if (isMom) {
    showQuickReplies([
      "אמא, אני צריכה עזרה כלכלית קטנה עם הציוד לתינוקת...",
      "אמא, נגמר לי התקציב. יכולה לעזור?",
      "אמא, יש לי מצוקה קצת עם הכסף לציוד...",
    ]);
  } else {
    showQuickReplies([
      "אבא, אני צריכה קצת עזרה עם הציוד לתינוקת...",
      "אבא, נגמר לי התקציב. יכול לעזור?",
      "אבא, יש לי מצוקה קצת עם הכסף לציוד...",
    ]);
  }

  phoneTextInput.addEventListener("input", () => {
    const qr = document.getElementById("quick-replies");
    if (qr && phoneTextInput.value.length > 0) qr.remove();
  });

  const chatBackBtn = document.getElementById("chat-back-btn");
  if (chatBackBtn) {
    chatBackBtn.classList.remove("hidden");
    chatBackBtn.onclick = () => {
      chatBackBtn.classList.add("hidden");
      closePhone();
      showMainItemList();
    };
  }

  async function sendMessage() {
    const msg = phoneTextInput.value.trim();
    if (!msg) return;
    phoneTextInput.value = "";
    phoneTextInput.disabled = true;
    phoneSendBtn.disabled = true;

    addChatBubble("את", msg, "player");
    history.push({ role: "user", text: msg });
    const typingEl = addTypingIndicator();

    try {
      const fullHistory = history
        .slice(0, -1)
        .map(m => `${m.role === "user" ? "שחקנית" : name}: ${m.text}`)
        .join("\n");
      const contextualMessage = fullHistory
        ? `שיחה קודמת:\n${fullHistory}\n\nהודעה אחרונה: ${msg}`
        : msg;

      const raw = await callGemini(contextualMessage, systemPrompt);
      typingEl.remove();

      let parsed;
      try {
        const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { text: raw, loanAmount: null, loanClosed: false };
        }
      } catch {
        parsed = { text: raw, loanAmount: null, loanClosed: false };
      }

      history.push({ role: "model", text: parsed.text });
      addChatBubble(name, parsed.text, "ronit");

      if (parsed.loanClosed && parsed.loanAmount) {
        const amount = parsed.loanAmount;
        if (isMom) gameState.loanFromMom = true;
        else        gameState.loanFromDad = true;

        if  (isMom && !gameState.superstition) drainSanity(8);
        if  (isMom &&  gameState.superstition) restoreSanity(3);
        if (!isMom &&  gameState.superstition) drainSanity(5);
        if (!isMom && !gameState.superstition) restoreSanity(2);

        setTimeout(() => {
          closePhone();
          gameState.budget += amount;
          updateHUD();
          showToast(`+${amount.toLocaleString()} ₪ מ${name}. 💛`);
          showMainItemList();
        }, 3000);
      }
    } catch (err) {
      typingEl.remove();
      addChatBubble("מערכת", `⚠️ שגיאה: ${err.message}`, "ronit");
    } finally {
      phoneTextInput.disabled = false;
      phoneSendBtn.disabled = false;
      phoneTextInput.focus();
    }
  }

  phoneSendBtn.onclick = sendMessage;
  phoneTextInput.onkeydown = e => { if (e.key === "Enter") sendMessage(); };
}

// ── רשימת פריטים ראשית ──────────────────────────────────────────────────────
function showMainItemList() {
  const remaining = gameState.items.filter(i => !i.isSecured);
  if (remaining.length === 0) {
    narrate("הכל מסודר. לקחת נשימה עמוקה.");
    setChoices([]);
    return;
  }

  const canGetLoan = !gameState.loanFromMom || !gameState.loanFromDad;
  const unsecured = remaining.filter(i =>
    gameState.budget < i.costUsed || gameState.budget < i.costNew
  );
  const cantAffordAnything = remaining.length > 0 &&
    unsecured.length === remaining.length && canGetLoan;

  const budgetWarning = cantAffordAnything
    ? `<br><small style="color:#e07030;">נראה שהתקציב לא מספיק — אפשר לבקש עזרה ממשפחה</small>`
    : "";

  narrate(`נותרו לך <strong>${gameState.budget.toLocaleString()} ₪</strong> ועוד ${remaining.length} פריט${remaining.length > 1 ? "ים" : ""} להשיג. על מה עובדים?${budgetWarning}`);

  const choices = remaining.map(item => ({
    label: `${item.emoji} ${item.name}`,
    primary: true,
    action: () => showItemMenu(item)
  }));

  if (cantAffordAnything) {
    const canMom = !gameState.loanFromMom;
    const canDad = !gameState.loanFromDad;
    if (canMom) choices.push({ label: "📞 התקשרי לאמא",  action: () => openLoanChat("mom") });
    if (canDad) choices.push({ label: "📞 התקשרי לאבא",  action: () => openLoanChat("dad") });
  }

  setChoices(choices);
}

// ── סצנת פתיחה ──────────────────────────────────────────────────────────────
function startOpeningScene() {
  narrate(`
    החדר ריק. הקירות עדיין חשופים. איפשהו בבסיס בדרום, אוריאל מנקה את הנשק שלו במקום להרכיב עריסה.<br><br>
    אמא שלך מתקשרת. היא אומרת: <em>"אל תכניסי שום דבר הביתה לפני הלידה. זה מזל רע."</em><br><br>
    את מקשיבה?
  `);
  setChoices([
    {
      label: "כן - אשאיר הכל בחוץ עד שהתינוקת תגיע.",
      action: () => {
        gameState.choiceMade = true;
        const phoneWrapper = document.getElementById("phone-icon-wrapper");
        if (phoneWrapper) { phoneWrapper.style.opacity = "1"; phoneWrapper.style.cursor = "pointer"; }
        gameState.superstition = true;
        rollSuperstitionFate(); // הגרלה סמויה
        drainSanity(5);
        showToast("−5 שפיות. לא כל ההחלטות קלות, גם הנכונות. 💙");
        narrate(`סגרת את השיחה וכתבת על פתקית: <em>״רק בחוץ.״</em><br><br>
          החדר יישאר ריק עד הלידה. חלק מהמסורות קיימות מסיבה.`);
        setTimeout(beginAct1, 1800);
      }
    },
    {
      label: "לא - אני מסדרת את החדר עכשיו.",
      action: () => {
        gameState.choiceMade = true;
        const phoneWrapper = document.getElementById("phone-icon-wrapper");
        if (phoneWrapper) { phoneWrapper.style.opacity = "1"; phoneWrapper.style.cursor = "pointer"; }
        gameState.superstition = false;
        drainSanity(5);
        showToast("−5 שפיות. גם ההחלטה הזו עולה משהו. 💙");
        narrate(`אמרת לה שאת אוהבת אותה, אבל העריסה נכנסת לחדר ברגע שהיא תגיע.<br><br>
          היא שתקה רגע לפני שסגרה. אותו רגע ילווה אותך.`);
        setTimeout(beginAct1, 1800);
      }
    }
  ]);
}

// ── שבועות אחרונים ─────────────────────────────────────────────────────────────────
function beginAct1() {
  if (typeof gtag !== 'undefined') gtag('event', 'game_start');
  gameState.act = 1;
  hudAct.textContent = "שבועות אחרונים";
  renderBaby("hidden");
  setTimeout(() => {
    addPhoneNotification("group", 2);
  }, 25000);

  if (gameState.superstition) {
    narrate(`פתחת את רשימת הקניות. חמישה פריטים. הציוד יחכה בחוץ עד הלידה - אבל עדיין צריך לשלם על הדברים מראש.`);
    setTimeout(() => {
      showMainItemList();
      scheduleMotherSupportCall();
    }, 1000);
  } else {
    narrate(`פתחת את רשימת הקניות. חמישה פריטים. את יכולה לעשות את זה.`);
    setTimeout(() => {
      showMainItemList();
    }, 1000);
  }
}

// ── שיחת תמיכה מאמא — מסלול אמונות טפלות בלבד ──────────────────────────────
function scheduleMotherSupportCall() {
  const delay = 20000 + Math.random() * 20000;
  setTimeout(() => {
    if (gameState.act === 2) {
      if (gameState.stealthActive) {
        increaseBabyMeter(25);
        showToast("הטלפון של אמא צלצל! מד הערות עלה. 📱");
      }
      return;
    }
    if (gameState.act !== 1 || gameState.negotiating) return;

    gameState.callPending = true;
    callBanner.classList.remove("hidden");
    $("call-name").textContent = "אמא 📞";
    $("call-sub").textContent = "מתקשרת...";

    $("call-answer-btn").onclick = () => {
      callBanner.classList.add("hidden");
      gameState.callPending = false;
      openMomCall();
    };

    $("call-ignore-btn").onclick = () => {
      callBanner.classList.add("hidden");
      gameState.callPending = false;
      drainSanity(3);
      showToast("נתת לאמא לצלצל. −3 שפיות 💛");
    };
  }, delay);
}

function openMomCall() {
  const homeEl = document.getElementById("phone-home");
  if (homeEl) homeEl.classList.add("hidden");

  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.add("hidden");
  phoneAppName.textContent = "📞 אמא";
  $("phone-status-bar").classList.add("call-mode");
  $("phone-status-bar").style.background = "#3a3a3a";

  const lines = [
    "\"עשית את הדבר הנכון. אני גאה בך. תשמרי על עצמך.\"",
    "\"כשנולדת, גם אני חיכיתי. זה מה שעושים. את לא לבד.\"",
    "\"הכל יהיה בסדר. תסמכי עלי — ותסמכי על עצמך.\""
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];

  phoneContent.innerHTML = `
    <div class="wa-bubble incoming" style="font-style:italic;margin-top:auto;">${line}</div>
    <div class="wa-bubble incoming" style="font-size:0.78rem;color:#888;">הקו חמים. היא ממתינה.</div>
  `;
  phoneOverlay.classList.remove("hidden");

  phoneCloseBtn.onclick = () => {
    closePhone();
    restoreSanity(10);
    showToast("לשמוע את אמא עזר יותר ממה שציפית. +10 שפיות 💛");
    $("phone-status-bar").classList.remove("call-mode");
    $("phone-status-bar").style.background = "";
  };
}

// ── מכניזם שיחת הבעל ────────────────────────────────────────────────────────
function scheduleHusbandCall() {
  const delay = 15000 + Math.random() * 30000;
  gameState.callTimer = setTimeout(() => {
    if (gameState.act === 2) {
      if (gameState.stealthActive) {
        increaseBabyMeter(30);
        showToast("הטלפון צלצל! מד הערות עלה. 📱");
      }
      return;
    }
    if (gameState.act !== 1) return;
    if (gameState.negotiating) {
      callBanner.classList.remove("hidden");
      $("call-answer-btn").style.display = "none";
      $("call-sub").textContent = "התקשר בזמן שהיית עסוקה…";
      setTimeout(() => {
        callBanner.classList.add("hidden");
        $("call-answer-btn").style.display = "";
        drainSanity(3);
        showToast("השיחה של אוריאל עברה לתא קולי. −3 שפיות 💙");
      }, 3500);
    } else {
      if (!phoneOverlay.classList.contains("hidden") &&
          !phoneContent.classList.contains("hidden")) {
        gameState.callTimer = setTimeout(() => showCallBanner(), 20000);
        return;
      }
      showCallBanner();
    }
  }, delay);
}

function showCallBanner() {
  SoundManager.phoneRing();
  gameState.callPending = true;
  $("call-name").textContent = "אוריאל 📞";
  $("call-sub").textContent = "מתקשר מהבסיס...";

  if (!phoneOverlay.classList.contains("hidden")) {
    const homeEl = document.getElementById("phone-home");
    if (homeEl) homeEl.classList.add("hidden");
    phoneContent.classList.remove("hidden");
    phoneInputArea.classList.add("hidden");

    phoneAppName.textContent = "אוריאל 📞";
    $("phone-status-bar").style.background = "#3a3a3a";
    phoneContent.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
                  justify-content:center;flex:1;gap:1.5rem;padding:2rem;
                  text-align:center;color:var(--charcoal);">
        <div style="font-size:3rem;">👨‍✈️</div>
        <div style="font-size:1.1rem;font-weight:700;">אוריאל מתקשר...</div>
        <div style="font-size:0.8rem;color:var(--muted);">מהבסיס</div>
        <div style="display:flex;gap:1rem;margin-top:1rem;">
          <button onclick="answerCallInPhone()"
            style="background:#25d366;color:white;padding:0.6rem 1.4rem;
                   border-radius:50px;border:none;font-size:0.9rem;
                   font-weight:700;cursor:pointer;">ענה</button>
          <button onclick="ignoreCallInPhone()"
            style="background:#e05555;color:white;padding:0.6rem 1.4rem;
                   border-radius:50px;border:none;font-size:0.9rem;
                   font-weight:700;cursor:pointer;">התעלמי</button>
        </div>
      </div>
    `;
    return;
  }

  callBanner.classList.remove("hidden");
  $("call-answer-btn").onclick = () => {
    callBanner.classList.add("hidden");
    gameState.callPending = false;
    openPhoneCall();
    scheduleHusbandCall();
  };
  $("call-ignore-btn").onclick = () => {
    callBanner.classList.add("hidden");
    gameState.callPending = false;
    drainSanity(3);
    showToast("נתת לו לצלצל. −3 שפיות 💙");
    scheduleHusbandCall();
  };
}

function answerCallInPhone() {
  callBanner.classList.add("hidden");
  gameState.callPending = false;
  openPhoneCall();
  scheduleHusbandCall();
}

function ignoreCallInPhone() {
  callBanner.classList.add("hidden");
  gameState.callPending = false;
  drainSanity(3);
  showToast("נתת לו לצלצל. −3 שפיות 💙");
  scheduleHusbandCall();
  openPhoneHome();
}

function openPhoneCall() {
  const homeEl = document.getElementById("phone-home");
  if (homeEl) homeEl.classList.add("hidden");
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.add("hidden");

  const DORITOS_LINE = "\"מאמי, רק דבר אחד אני מבקש — דוריטוס חמוץ חריף. זה הכל. תשמרי לי. 🧡\"";
  const lines = [
    "\"מאמי, מה שלומך? הכל בסדר?\"",
    "\"כמה שהייתי רוצה לחזור הביתה להיות איתך ולעזור בהכנות.\"",
    "\"החברים כאן שולחים דרישת שלום. כולנו חושבים עלייך.\"",
    "\"אחזור הביתה בקרוב. יכולה לדאוג שיהיה דוריטוס חמוץ חריף?\"",
    DORITOS_LINE,
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (line === DORITOS_LINE) showToast("😂 הוא רציני לגמרי.");

  phoneAppName.textContent = "📞 אוריאל";
  $("phone-status-bar").classList.add("call-mode");
  $("phone-status-bar").style.background = "#3a3a3a";
  phoneContent.innerHTML = `
    <div class="wa-bubble incoming" style="font-style:italic;margin-top:auto;">${line}</div>
    <div class="wa-bubble incoming" style="font-size:0.78rem;color:#888;">הקו רועש, ואז שקט.</div>
  `;

  const unsecuredItems = gameState.items.filter(i => !i.isSecured);
  if (unsecuredItems.length > 0 && !gameState.couponUsed) {
    const topItem = unsecuredItems.reduce((a, b) => a.costNew > b.costNew ? a : b);
    gameState.couponUsed     = true;
    gameState.couponItem     = topItem.id;
    gameState.couponDiscount = Math.round(topItem.costNew * 0.80);
    phoneContent.insertAdjacentHTML("beforeend", `
      <div class="wa-bubble incoming" style="margin-top:8px;">אגב — מצאתי קופון אונליין ל${topItem.name}. שלחתי לך, אמור לחסוך לך כמה שקלים 🎟️</div>
    `);
    setTimeout(() => showToast(`🎟️ קופון התקבל! ${topItem.name} במחיר מיוחד.`), 2000);
  }

  phoneOverlay.classList.remove("hidden");

  phoneCloseBtn.onclick = () => {
    closePhone();
    restoreSanity(5);
    showToast("לשמוע את קולו עזר. +5 שפיות 💙");
    $("phone-status-bar").classList.remove("call-mode");
    $("phone-status-bar").style.background = "";
  };
}

// ── מיני-משחק קבוצת ווטסאפ ──────────────────────────────────────────────────
function openWhatsAppGroup(item) {
  if (!item) item = gameState.items.find(i => i.id === "clothes");
  _groupActive = true;
  _groupVisitCount++;
  phoneAppName.textContent = "קהילת משוערות ינואר 2026";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.add("hidden");
  phoneOverlay.classList.remove("hidden");

  let fakeMessages;
  if (_groupVisitCount === 1) {
    fakeMessages = [
      { sender: "מיכל כ.",      text: "מישהי ניסתה את בית המרקחת החדש ברחוב הרצל?", time: "09:12" },
      { sender: "נועה ט.",       text: "יש למישהי המלצה על צידנית טובה?", time: "09:15" },
      { sender: "יעל ר.",        text: "מישהי מכירה יועצת הנקה טובה? חייבת עזרה דחוף 😭", time: "09:18" },
      { sender: "מנהלת 📌",      text: "תזכורת: אין פרסומות בקבוצה.", time: "09:19" },
      { sender: "סיגל ג.",       text: "מתנה בחינם 🎁 בגדי תינוקת 0-3 חודשים, בקושי בשימוש! הראשונה שמגיבה מקבלת!", time: "09:25", giveaway: true },
      { sender: "מיכל כ.",      text: "וואו סיגל כמה שזה נחמד ממך!", time: "09:26" },
      { sender: "אפרת מ.",       text: "יש פה מישהי שהעמסת סוכר יצא גבוה?", time: "09:28" },
      { sender: "נועה ט.",       text: "עוד מישהי חווה לחצים באמצע הגב?", time: "09:29" },
      { sender: "רבקה ח.",       text: "בוקר טוב לכולן! ☀️", time: "09:31" },
    ];
  } else {
    const stroller = gameState.items.find(i => i.id === "stroller");
    const showRonitL = !stroller || !stroller.isSecured;
    fakeMessages = [
      { sender: "רבקה ח.",       text: "מישהי יודעת מה עושים כשהתינוק לא מרפה מהשד? 😅", time: "10:02" },
      { sender: "מיכל כ.",      text: "נורמלי לישון שעה וחצי סך הכל בלילה הראשון?? 😭", time: "10:15" },
      { sender: "יעל ר.",        text: "שלחתי הודעה ליועצת ההנקה, מחכה לחזרה. תודה לכולן ❤️", time: "10:18" },
      ...(showRonitL ? [{ sender: "הדר 🛒", text: "היי לכולן, הבת שלי מוכרת עגלת תינוק במצב מעולה. כמעט לא השתמשנו. 700 שקל. מי שמעוניינת 👇", time: "10:22", ronitL: true }] : []),
      { sender: "דינה מ.",       text: "מישהי קנתה את הסבון של Johnson's החדש? טוב?", time: "10:28" },
      { sender: "נועה ט.",       text: "אני ממליצה על Mustela, הרגיש לי יותר עדין 🌸", time: "10:31" },
      { sender: "מנהלת 📌",      text: "תזכורת: מפגש זום ראשון שלנו יום ראשון ב-20:00! 🎉", time: "10:45" },
    ];
  }

  let revealIndex = 0;
  let giveawayClickable = false;
  let giveawayEl = null;
  let scrollInterval;
  let missTimer;

  function addBubble(msg) {
    if (!_groupActive) return document.createElement("div");
    const div = document.createElement("div");
    div.className = "wa-bubble incoming" + (msg.giveaway ? " giveaway" : "");
    div.innerHTML = `
      <span class="wa-sender">${msg.sender}</span>
      ${msg.text}
      <div class="wa-time">${msg.time}</div>
    `;
    if (msg.ronitL) {
      div.style.cursor = "pointer";
      div.style.borderBottom = "2px solid #8aab84";
      div.addEventListener("click", () => {
        const stroller = gameState.items.find(i => i.id === "stroller");
        if (stroller && stroller.isSecured) return;
        _groupActive = false;
        clearTimeout(scrollInterval);
        clearTimeout(missTimer);
        closePhone();
        openHadarNegotiation();
      });
    }
    if (msg.giveaway) {
      giveawayEl = div;
      giveawayClickable = true;
      div.addEventListener("click", () => {
        if (!giveawayClickable) return;
        _groupActive = false;
        clearTimeout(scrollInterval);
        clearTimeout(missTimer);
        closePhone();
        const clothesItem = gameState.items.find(i => i.id === "clothes");
        if (clothesItem && !clothesItem.isSecured) {
          narrate(`<strong>לחצת על ההודעה של סיגל בזמן!</strong> רגע אחר כך: "סבבה! בואי מתי שנוח לך." הבגדים שלך — חינם. 🎁`);
          secureItem(clothesItem, 0);
          setTimeout(showMainItemList, 1600);
        } else {
          showMainItemList();
        }
      });
    }
    phoneContent.appendChild(div);
    phoneContent.scrollTop = phoneContent.scrollHeight;
    return div;
  }

  let revealDelay = 1800;
  function tick() {
    revealNext();
    revealDelay = Math.max(900, revealDelay - 30);
    if (revealIndex < fakeMessages.length) {
      scrollInterval = setTimeout(tick, revealDelay);
    } else if (_groupActive) {
      phoneInputArea.classList.remove("hidden");
      phoneSendBtn.onclick = () => {
        const msg = phoneTextInput.value.trim();
        if (!msg) return;
        phoneTextInput.value = "";
        addChatBubble("את", msg, "player");
        setTimeout(() => {
          addBubble({
            sender: "נועה ט.",
            text: "👍",
            time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
          });
        }, 1500);
      };
    }
  }
  function revealNext() {
    if (revealIndex < fakeMessages.length) {
      addBubble(fakeMessages[revealIndex]);
      revealIndex++;
    }
  }
  scrollInterval = setTimeout(tick, 500);

  missTimer = setTimeout(() => {
    if (!_groupActive) return;
    if (giveawayClickable) {
      giveawayClickable = false;
      if (giveawayEl) {
        giveawayEl.style.opacity = "0.4";
        giveawayEl.style.border = "none";
        const note = document.createElement("div");
        note.style.cssText = "font-size:0.72rem;color:#e05555;text-align:center;padding:4px;";
        note.textContent = "ההצעה נתפסה 😞";
        phoneContent.appendChild(note);
      }
      const closeNote = document.createElement("button");
      closeNote.textContent = "סגור";
      closeNote.style.cssText = "margin:8px auto;display:block;background:#e8b4b8;padding:6px 16px;border-radius:12px;font-size:0.82rem;";
      closeNote.onclick = () => {
        clearInterval(scrollInterval);
        closePhone();
        drainSanity(5);
        showToast("פספסת. −5 שפיות");
        showMainItemList();
      };
      phoneContent.appendChild(closeNote);
      phoneContent.scrollTop = phoneContent.scrollHeight;
    }
  }, 15000);

  phoneCloseBtn.onclick = () => {
    _groupActive = false;
    clearTimeout(scrollInterval);
    clearTimeout(missTimer);
    closePhone();
  };
}

// ── משא ומתן AI עם רונית (שידה) ──────────────────────────────────────────
function openRonitNegotiation(item, opts = {}) {
  console.log("[openRonitNegotiation] called");
  const fromContact = !!opts.fromContact;
  const dealDone = !!(item && item.isSecured);
  gameState.negotiating = !dealDone;

  phoneAppName.textContent = "🛋️ רונית (שידה)";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.remove("hidden");
  phoneOverlay.classList.remove("hidden");
  document.getElementById("phone-home").classList.add("hidden");
  revealContactRow("ronit");

  const history = chatHistories.ronit;
  // alias retained for any legacy reads
  gameState.roniConvoHistory = history;

  if (history.length === 0) {
    const greeting = "שלום! השידה עולה 500 שקל. מצב מעולה, כמעט לא הייתה בשימוש. מעניין אותך?";
    history.push({ role: "model", text: greeting });
  }
  history.forEach(msg => {
    addChatBubble(msg.role === "user" ? "את" : "רונית",
                  msg.text,
                  msg.role === "user" ? "player" : "ronit");
  });

  const chatBackBtn = document.getElementById("chat-back-btn");
  if (fromContact && chatBackBtn) {
    chatBackBtn.classList.remove("hidden");
    chatBackBtn.onclick = () => {
      chatBackBtn.classList.add("hidden");
      gameState.negotiating = false;
      openPhoneHome();
    };
  }

  phoneCloseBtn.onclick = () => {
    gameState.negotiating = false;
    closePhone();
    if (!fromContact && !dealDone) showItemMenu(item);
  };

  if (dealDone) {
    phoneInputArea.classList.add("hidden");
    return;
  }

  async function sendMessage() {
    const msg = phoneTextInput.value.trim();
    if (!msg) return;
    phoneTextInput.value = "";
    phoneTextInput.disabled = true;
    phoneSendBtn.disabled = true;

    addChatBubble("את", msg, "player");
    const typingEl = addTypingIndicator();

    try {
      const fullHistory = gameState.roniConvoHistory
        .map(m => `${m.role === "user" ? "משחקנית" : "רונית"}: ${m.text}`)
        .join("\n");
      const contextualMessage = fullHistory
        ? `שיחה קודמת:\n${fullHistory}\n\nהודעה אחרונה מהמשחקנית: ${msg}`
        : msg;

      gameState.roniConvoHistory.push({ role: "user", text: msg });

      const raw = await callGemini(contextualMessage, RONIT_PROMPT);
      typingEl.remove();

      let parsed;
      try {
        const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { text: raw, agreedPrice: null, leaveOutside: false, dealClosed: false, sendImage: false };
        }
      } catch {
        parsed = { text: raw, agreedPrice: null, leaveOutside: false, dealClosed: false, sendImage: false };
      }

      gameState.roniConvoHistory.push({ role: "model", text: parsed.text });
      addChatBubble("רונית", parsed.text, "ronit");

      if (parsed.sendImage) {
        const imgDiv = document.createElement("div");
        imgDiv.className = "wa-bubble incoming chat-bubble-ronit";
        imgDiv.innerHTML = `
          <span class="wa-sender">רונית</span>
          <img src="assets/Second-handDresser.png"
               style="width:100%;max-width:200px;border-radius:8px;margin-top:6px;display:block;"
               alt="שידה יד שנייה"/>
        `;
        phoneContent.appendChild(imgDiv);
        phoneContent.scrollTop = phoneContent.scrollHeight;
      }

      if (parsed.dealClosed && parsed.agreedPrice) {
        if (typeof gtag !== 'undefined') gtag('event', 'deal_closed', { item: item.name, price: parsed.agreedPrice });
        const price = parsed.agreedPrice;
        if (parsed.leaveOutside) {
          showToast("רונית תשאיר את השידה מחוץ לבניין שלה. 🏠");
        }
        gameState.negotiating = false;
        setTimeout(() => {
          closePhone();
          narrate(`עסקה. השידה עולה <strong>${price.toLocaleString()} ₪</strong>.${parsed.leaveOutside ? " רונית תשאיר אותה בחוץ בשבילך." : ""}`);
          secureItem(item, price);
          setTimeout(showMainItemList, 1600);
        }, 800);
      }
    } catch (err) {
      console.error("[Ronit] API error:", err);
      typingEl.remove();
      addChatBubble("מערכת", `⚠️ שגיאה: ${err.message}`, "ronit");
    } finally {
      phoneTextInput.disabled = false;
      phoneSendBtn.disabled = false;
      phoneTextInput.focus();
    }
  }

  phoneSendBtn.onclick = sendMessage;
  phoneTextInput.onkeydown = e => { if (e.key === "Enter") sendMessage(); };
}


// ── משא ומתן AI עם הדר (עגלה) ──────────────────────────────────────────
function openHadarNegotiation(opts = {}) {
  const fromContact = !!opts.fromContact;
  const item = gameState.items.find(i => i.id === "stroller");
  if (!item) return;
  const dealDone = !!item.isSecured;

  gameState.negotiating = !dealDone;
  const history = chatHistories.hadar;

  phoneAppName.textContent = "🛒 הדר (עגלה)";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.remove("hidden");
  phoneOverlay.classList.remove("hidden");
  document.getElementById("phone-home").classList.add("hidden");
  revealContactRow("hadar");

  if (history.length === 0) {
    const greeting = "היי! ראיתי שפנית בנוגע לעגלה. 700 שקל, מצב מצוין, הבת שלי השתמשה בה בקושי. מעניין אותך?";
    history.push({ role: "model", text: greeting });
  }
  history.forEach(msg => {
    addChatBubble(msg.role === "user" ? "את" : "הדר",
                  msg.text,
                  msg.role === "user" ? "player" : "ronit");
  });

  const chatBackBtn = document.getElementById("chat-back-btn");
  if (fromContact && chatBackBtn) {
    chatBackBtn.classList.remove("hidden");
    chatBackBtn.onclick = () => {
      chatBackBtn.classList.add("hidden");
      gameState.negotiating = false;
      openPhoneHome();
    };
  }

  phoneCloseBtn.onclick = () => {
    gameState.negotiating = false;
    closePhone();
  };

  if (dealDone) {
    phoneInputArea.classList.add("hidden");
    return;
  }

  async function sendMessage() {
    const msg = phoneTextInput.value.trim();
    if (!msg) return;
    phoneTextInput.value = "";
    phoneTextInput.disabled = true;
    phoneSendBtn.disabled = true;

    addChatBubble("את", msg, "player");
    const typingEl = addTypingIndicator();

    try {
      const fullHistory = history
        .map(m => `${m.role === "user" ? "משחקנית" : "הדר"}: ${m.text}`)
        .join("\n");
      const contextualMessage = fullHistory
        ? `שיחה קודמת:\n${fullHistory}\n\nהודעה אחרונה מהמשחקנית: ${msg}`
        : msg;

      history.push({ role: "user", text: msg });

      const raw = await callGemini(contextualMessage, HADAR_PROMPT);
      typingEl.remove();

      let parsed;
      try {
        const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { text: raw, agreedPrice: null, dealClosed: false, sendImage: false };
        }
      } catch {
        parsed = { text: raw, agreedPrice: null, dealClosed: false, sendImage: false };
      }

      history.push({ role: "model", text: parsed.text });
      addChatBubble("הדר", parsed.text, "ronit");

      if (parsed.sendImage) {
        const imgDiv = document.createElement("div");
        imgDiv.className = "wa-bubble incoming chat-bubble-ronit";
        imgDiv.innerHTML = `
          <span class="wa-sender">הדר</span>
          <img src="assets/RonitSecond-handStroller.png"
               style="width:100%;max-width:200px;border-radius:8px;margin-top:6px;display:block;"
               alt="עגלה יד שנייה"/>
        `;
        phoneContent.appendChild(imgDiv);
        phoneContent.scrollTop = phoneContent.scrollHeight;
      }

      if (parsed.dealClosed && parsed.agreedPrice) {
        if (typeof gtag !== 'undefined') gtag('event', 'deal_closed', { item: item.name, price: parsed.agreedPrice });
        const price = parsed.agreedPrice;
        gameState.negotiating = false;
        setTimeout(() => {
          closePhone();
          narrate(`עסקה. העגלה עולה <strong>${price.toLocaleString()} ₪</strong>.`);
          secureItem(item, price, true);
          setTimeout(showMainItemList, 1600);
        }, 800);
      }
    } catch (err) {
      typingEl.remove();
      addChatBubble("מערכת", `⚠️ שגיאה: ${err.message}`, "ronit");
    } finally {
      phoneTextInput.disabled = false;
      phoneSendBtn.disabled = false;
      phoneTextInput.focus();
    }
  }

  phoneSendBtn.onclick = sendMessage;
  phoneTextInput.onkeydown = e => { if (e.key === "Enter") sendMessage(); };
}

// ── משא ומתן כללי (פריטים שאינם שידה) ────────────────────────────────────
function openGenericNegotiation(item) {
  gameState.negotiating = true;
  const finalPrice = item.costUsed;

  narrate(`מצאת מודעה ל${item.name} יד שנייה ב-<strong>${finalPrice.toLocaleString()} ₪</strong>. המוכרת נראית סבירה.`);
  setChoices([
    {
      label: `קבלי — ${finalPrice.toLocaleString()} ₪`,
      primary: true,
      action: () => {
        gameState.negotiating = false;
        narrate(`הסכמת למחיר. ה${item.name} שלך.`);
        secureItem(item, finalPrice);
        setTimeout(showMainItemList, 1400);
      }
    },
    {
      label: "נסי להתמקח (−5 שפיות אם יסרבו)",
      action: () => {
        gameState.negotiating = false;
        const success = Math.random() > 0.45;
        if (success) {
          const reduced = Math.round(finalPrice * 0.85);
          narrate(`היא הסכימה ל-<strong>${reduced.toLocaleString()} ₪</strong>. לא רע.`);
          secureItem(item, reduced);
        } else {
          drainSanity(5);
          showToast("היא לא הסכימה. −5 שפיות");
          narrate(`היא עומדת על ${finalPrice.toLocaleString()} ₪. השתיקה המביכה עולה לך משהו.`);
          secureItem(item, finalPrice);
        }
        setTimeout(showMainItemList, 1600);
      }
    },
    { label: "← חזרה", action: () => { gameState.negotiating = false; showItemMenu(item); } }
  ]);
}

// ── עזרי צ׳אט בטלפון ────────────────────────────────────────────────────────
function addChatBubble(sender, text, side) {
  const div = document.createElement("div");
  div.className = `wa-bubble ${side === "player" ? "outgoing chat-bubble-player" : "incoming chat-bubble-ronit"}`;
  div.innerHTML = `<span class="wa-sender">${sender}</span>${text}`;
  phoneContent.appendChild(div);
  phoneContent.scrollTop = phoneContent.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "typing-indicator";
  div.innerHTML = "<span></span><span></span><span></span>";
  phoneContent.appendChild(div);
  phoneContent.scrollTop = phoneContent.scrollHeight;
  return div;
}

function closePhone() {
  _groupActive = false;
  const qr = document.getElementById("quick-replies");
  if (qr) qr.remove();
  phoneOverlay.classList.add("hidden");
  phoneContent.innerHTML = "";
  phoneInputArea.classList.add("hidden");
  phoneSendBtn.onclick = null;
  phoneTextInput.onkeydown = null;
  phoneCloseBtn.onclick = null;
  document.getElementById("phone-home").classList.add("hidden");
  const chatBack = document.getElementById("chat-back-btn");
  if (chatBack) chatBack.classList.add("hidden");

  gameState.negotiating = false;

  choiceButtons.querySelectorAll("button, div").forEach(b => {
    b.disabled = false;
    b.style.opacity = "";
    b.style.pointerEvents = "";
    b.style.cursor = "";
  });
}

// ── ניווט מסכי טלפון ────────────────────────────────────────────────────────
function openPhoneHome() {
  if (!gameState.choiceMade) {
    showToast("רגע... קודם תעני לאמא שלך. 📞");
    return;
  }
  clearPhoneNotifications();
  document.getElementById("phone-home").classList.remove("hidden");
  phoneContent.classList.add("hidden");
  phoneInputArea.classList.add("hidden");

  const chatBackBtn = document.getElementById("chat-back-btn");
  if (chatBackBtn) chatBackBtn.classList.add("hidden");

  const now = new Date();
  const timeEl = document.getElementById("phone-home-time");
  if (timeEl) timeEl.textContent =
    now.getHours().toString().padStart(2, "0") + ":" +
    now.getMinutes().toString().padStart(2, "0");

  phoneAppName.textContent = "הודעות";
  phoneOverlay.classList.remove("hidden");
}

function addPhoneNotification(contactId, count = 1) {
  SoundManager.phoneRing();
  const row = document.querySelector(`.contact-row[data-contact="${contactId}"]`);
  if (row) {
    const badge = row.querySelector(".contact-badge");
    if (badge) {
      badge.classList.remove("hidden");
      badge.textContent = count;
    }
  }
  const icon = document.getElementById("phone-icon");
  const dot  = document.getElementById("phone-notification-dot");
  if (icon) icon.classList.add("ringing");
  if (dot)  dot.classList.remove("hidden");
  const mobDot = document.getElementById("mob-phone-dot");
  if (mobDot) mobDot.classList.remove("hidden");
}

function clearPhoneNotifications() {
  phoneState.notifications = 0;
  const dot  = document.getElementById("phone-notification-dot");
  const icon = document.getElementById("phone-icon");
  if (dot)  dot.classList.add("hidden");
  if (icon) icon.classList.remove("ringing");
  const mobDot = document.getElementById("mob-phone-dot");
  if (mobDot) mobDot.classList.add("hidden");
}

// ── צ׳אט AI גנרי לכל איש קשר ───────────────────────────────────────────────
function openContactChat(contactId) {
  const name    = CONTACT_NAMES[contactId];
  const prompt  = CONTACT_PROMPTS[contactId];
  if (!prompt) return;

  phoneSendBtn.onclick = null;
  phoneTextInput.onkeydown = null;
  phoneContent.innerHTML = "";

  const history = chatHistories[contactId];

  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.remove("hidden");
  phoneAppName.textContent = "💬 " + name;

  const chatBackBtn = document.getElementById("chat-back-btn");
  if (chatBackBtn) {
    chatBackBtn.classList.remove("hidden");
    chatBackBtn.onclick = () => {
      chatBackBtn.classList.add("hidden");
      phoneContent.classList.add("hidden");
      phoneInputArea.classList.add("hidden");
      openPhoneHome();
    };
  }

  if (history.length === 0) {
    const greetings = {
      oriel: "היי מאמי 💙 מה שלומך? הכל בסדר?",
      mom:   "שלום אהובתי! חשבתי עלייך כל היום. איך את מרגישה?",
      dad:   "היי מה שלומך? הכל בסדר?",
      maya:  "היי! 🌸 חשבתי עלייך. מה קורה?",
      shira: "היי! אז איך הולך? אצלי היה כזה כאוס בהתחלה, לא תאמיני...",
      noa:   "היי... סורי שאני כותבת, סתם רציתי לדעת איך את 😅",
      dana:  "HEYYYY 😎 אז מה קורה?! מתי כבר נצא??",
    };
    let greeting = greetings[contactId];
    if (contactId === "oriel" && !gameState.couponUsed) {
      const unsecuredItems = gameState.items.filter(i => !i.isSecured);
      if (unsecuredItems.length > 0) {
        const topItem = unsecuredItems.reduce((a, b) => a.costNew > b.costNew ? a : b);
        gameState.couponUsed     = true;
        gameState.couponItem     = topItem.id;
        gameState.couponDiscount = Math.round(topItem.costNew * 0.80);
        greeting = `היי מאמי 💙 חשבתי עלייך כל היום. מצאתי קופון אונליין ל${topItem.name} — שלחתי לך 🎟️ אמור לחסוך לך כמה שקלים.`;
        setTimeout(() => showToast(`🎟️ קופון התקבל! ${topItem.name} במחיר מיוחד.`), 2000);
      }
    }
    if (greeting) {
      addChatBubble(name, greeting, "ronit");
      history.push({ role: "model", text: greeting });
    }
  } else {
    history.forEach(msg => {
      addChatBubble(
        msg.role === "user" ? "את" : name,
        msg.text,
        msg.role === "user" ? "player" : "ronit"
      );
    });
  }

  async function sendMessage() {
    const msg = phoneTextInput.value.trim();
    if (!msg) return;
    phoneTextInput.value = "";
    phoneTextInput.disabled = true;
    phoneSendBtn.disabled = true;

    addChatBubble("את", msg, "player");
    history.push({ role: "user", text: msg });
    const typingEl = addTypingIndicator();

    try {
      const fullHistory = history
        .slice(0, -1)
        .map(m => `${m.role === "user" ? "שחקנית" : name}: ${m.text}`)
        .join("\n");
      const contextualMessage = fullHistory
        ? `שיחה קודמת:\n${fullHistory}\n\nהודעה אחרונה: ${msg}`
        : msg;

      const raw = await callGemini(contextualMessage, prompt());
      typingEl.remove();

      addChatBubble(name, raw, "ronit");
      history.push({ role: "model", text: raw });

      if (contactId === "maya")  restoreSanity(3);
      if (contactId === "shira") drainSanity(2);
      if (contactId === "dana")  restoreSanity(1);
      if (contactId === "oriel") restoreSanity(4);
      if (contactId === "mom")   restoreSanity(2);

    } catch (err) {
      typingEl.remove();
      addChatBubble("מערכת", `⚠️ שגיאה: ${err.message}`, "ronit");
    } finally {
      phoneTextInput.disabled = false;
      phoneSendBtn.disabled = false;
      phoneTextInput.focus();
    }
  }

  phoneSendBtn.onclick = sendMessage;
  phoneTextInput.onkeydown = e => { if (e.key === "Enter") sendMessage(); };
}

// ── שיחת אבא — קצרה ומרגשת ─────────────────────────────────────────────────
async function openDadCall() {
  const homeEl = document.getElementById("phone-home");
  if (homeEl) homeEl.classList.add("hidden");
  phoneContent.classList.remove("hidden");
  phoneInputArea.classList.add("hidden");

  phoneAppName.textContent = "📞 אבא";
  $("phone-status-bar").classList.add("call-mode");
  $("phone-status-bar").style.background = "#3a3a3a";

  phoneContent.innerHTML = `
    <div class="wa-bubble incoming" style="font-style:italic;margin-top:3rem;">מתחבר...</div>
  `;
  phoneOverlay.classList.remove("hidden");

  try {
    const raw = await callGemini(
      "התקשרת לבתך שזה עתה ילדה תינוקת. אמור לה משהו קצר מאוד, אישי ומרגש — משפט אחד או שניים בלבד.",
      DAD_CALL_PROMPT
    );
    phoneContent.innerHTML = `
      <div class="wa-bubble incoming" style="font-style:italic;margin-top:3rem;">${raw}</div>
      <div class="wa-bubble incoming" style="font-size:0.78rem;color:#888;margin-top:0.5rem;">הקו התנתק.</div>
    `;
  } catch {
    phoneContent.innerHTML = `
      <div class="wa-bubble incoming" style="font-style:italic;margin-top:3rem;">
        "את עושה עבודה טובה. אני רואה אותך."
      </div>
    `;
  }

  phoneCloseBtn.onclick = () => {
    closePhone();
    restoreSanity(8);
    showToast("לשמוע את אבא עזר יותר ממה שציפית. +8 שפיות 🤍");
    $("phone-status-bar").classList.remove("call-mode");
    $("phone-status-bar").style.background = "";
  };
}

// ── מעבר בין מחזות ──────────────────────────────────────────────────────────
function triggerActTransition() {
  if (typeof gtag !== 'undefined') gtag('event', 'act_complete', { act: 1 });
  clearTimeout(gameState.callTimer);
  actFade.classList.add("active");

  setTimeout(() => {
    actFadeText.textContent = "שבועיים מאוחר יותר…";
  }, 200);

  setTimeout(() => {
    actFade.classList.remove("active");
    beginAct2();
  }, 4000);
}

// ── היום הראשון ─────────────────────────────────────────────────────────────────
function beginAct2() {
  gameState.act = 2;
  gameState.sleepCycle = 0;
  gameState.lullabyPhase = false;
  hudAct.textContent = "היום הראשון";
  document.getElementById("game-wrapper").classList.add("act2");
  updateHUD();
  setRoomMood("night");
  const sidePanel = document.getElementById("side-panel");
  if (sidePanel) {
    sidePanel.style.borderLeft = "2px solid var(--rose-dark)";
    sidePanel.style.background = "rgba(253,240,232,0.98)";
  }
  const tasksPanel = document.getElementById("panel-tasks");
  if (tasksPanel) {
    tasksPanel.style.display = "flex";
    tasksPanel.style.background = "rgba(138,171,132,0.3)";
    setTimeout(() => {
      tasksPanel.style.background = "";
    }, 2000);
  }

  if (gameState.superstition) {
    applySuperstitionFate();
    spawnBoxes();
  } else {
    gameState.items.forEach(i => { i.inHouse = true; });
    renderRoom();
    renderBaby("sleeping");
    renderRoom();
    setTimeout(beginLullaby, 1500);
  }
}

// ── יצירת קופסאות לפתיחה (מסלול אמונות טפלות) ──────────────────────────────
function spawnBoxes() {
  const roomView = $("room-view");
  const positions = [
    { left: "20%", bottom: "15%" },
    { left: "33%", bottom: "18%" },
    { left: "46%", bottom: "13%" },
    { left: "58%", bottom: "17%" },
    { left: "70%", bottom: "14%" },
  ];

  gameState.items.forEach((item, i) => {
    const variants = ["assets/NewBox1.png", "assets/NewBox2.png"];
    const src = item._worn
      ? "assets/Second-handBox.png"
      : variants[Math.floor(Math.random() * variants.length)];

    const box = document.createElement("img");
    box.src = src;
    box.id  = `box-${item.id}`;
    box.alt = item.name;
    box.classList.add("box-pulse");
    box.style.cssText = `position:absolute; left:${positions[i].left}; bottom:${positions[i].bottom}; width:13%; height:auto; object-fit:contain; z-index:3; cursor:pointer`;
    box.addEventListener("click", () => unpackBox(item, box));
    roomView.appendChild(box);
  });
}

function unpackBox(item, boxEl) {
  boxEl.remove();
  item.inHouse = true;
  renderRoom();
  showToast(`${item.name} ${item.gender === "f" ? "פוּרְקה" : "פוּרַק"}! 📦 ➡️ ${item.emoji}`);
  increaseBabyMeter(35);
  showToast("רעש מהקופסה! מד הערות עלה בחדות 📦");

  const remaining = document.querySelectorAll("[id^='box-']").length;
  narrate(`פרקת את <strong>${item.name}</strong>. ${remaining} קופסאות נותרו.`);

  if (remaining === 0) {
    if (gameState.babyMeter >= 100 || !gameState.stealthActive) {
      narrate("כל הקופסאות רוקנו. אבל התינוקת התעוררה מהרעש...");
    } else {
      narrate("כל הקופסאות רוקנו. החדר נראה כמו חדר תינוקת. הגב כואב.");
      setTimeout(beginLullaby, 1200);
    }
  }
}

// ── שלב הרדמה — היום הראשון ─────────────────────────────────────────────────────
function beginLullaby() {
  if (gameState.endingTriggered) return;          // היום נגמר — אין עוד הרדמות
  clearSleepTimer();
  gameState.lullabyPhase = true;
  gameState.stealthActive = true;
  gameState.babyMeter = 80;
  babyMeterFill.style.width = "80%";
  babyMeterFill.classList.add("danger");

  const cycleNum = Math.min(gameState.sleepCycle + 1, gameState.totalCycles);

  renderBaby("crying");
  renderRoom();

  narrate(`
    <strong>😴 חלון שינה ${cycleNum} מתוך ${gameState.totalCycles}</strong><br><br>
    התינוקת ערה. הזיזי <strong>לאט מאוד</strong>
    מעל התינוקת עד שתירדם.
  `);
  setChoices([]);

  const babyEl = document.getElementById("room-baby");
  if (babyEl) {
    babyEl.classList.add("lullaby");
    babyEl.style.pointerEvents = "auto";
  }

  document.getElementById("lullaby-hint")?.classList.remove("hidden");

  beginStealthMode();
}

// ── שלב פעולה — היום הראשון ──────────────────────────────────────────────────────
function beginActionPhase() {
  gameState.lullabyPhase = false;
  gameState.stealthActive = true;
  gameState.babyCried = false;
  gameState.babyMeter = 0;
  babyMeterFill.classList.remove("danger");
  babyMeterFill.style.width = "0%";
  updateTasksPanel();
  startSleepTimer();   // התינוקת תתעורר עוד 20–40 שניות (אלא אם המד יגיע ל-100 קודם)
  showSelfCareMenu();
}

function showSelfCareMenu() {
  const cycle    = gameState.sleepCycle;
  const pumpHint = cycle === 0 ? "⭐ עדיף לשאוב בהתחלה" : null;

  const actions = [];

  // ── שאיבה (אם לא בוצעה) ─────────────────────────────────────────
  if (!gameState.tasksDone.pump) {
    const electricCost = 200;
    const canAffordElectric = gameState.budget >= electricCost;
    actions.push({
      img: "assets/ActionPump.png",
      label: "🍼 משאבה חשמלית",
      sub:   `${electricCost} ₪ 🔇`,
      quiet: true,
      disabled: !canAffordElectric,
      hint:  pumpHint,
      action: () => startPumpMinigame("electric"),
    });
    actions.push({
      img: "assets/ActionPump.png",
      label: "🍼 משאבה ידנית",
      sub:   "חינם 🔉",
      quiet: false,
      hint:  pumpHint,
      action: () => startPumpMinigame("manual"),
    });
  }

  // ── כביסה (אם לא בוצעה) ─────────────────────────────────────────
  if (!gameState.tasksDone.laundry) {
    const laundromatCost = 150;
    const canAffordLaundromat = gameState.budget >= laundromatCost;
    actions.push({
      img: "assets/ActionLaundry.png",
      label: "🧺 מכבסה",
      sub:   `${laundromatCost} ₪ 🔇`,
      quiet: true,
      disabled: !canAffordLaundromat,
      action: () => startLaundryMinigame("service"),
    });
    actions.push({
      img: "assets/ActionLaundry.png",
      label: "🧺 כביסה בבית",
      sub:   "חינם 🔉",
      quiet: false,
      action: () => startLaundryMinigame("home"),
    });
  }

  // ── טיפול עצמי — תמיד זמין, חוזר על עצמו ───────────────────────
  actions.push({
    img: "assets/ActionCoffee.png",
    label: "☕ קפה",
    sub:   "+8 שפיות",
    quiet: true,
    action: () => startCoffeeMinigame(),
  });
  actions.push({
    img: "assets/ActionBook.png",
    label: "📖 לקרוא",
    sub:   "+5 שפיות",
    quiet: true,
    action: () => startReadingMinigame(),
  });

  narrate("התינוקת ישנה 😴 בחרי מה לעשות עכשיו:");

  choiceButtons.innerHTML = "";
  const grid = document.createElement("div");
  grid.style.cssText = `
    display: flex;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
    padding: 0.4rem 0;
  `;

  actions.forEach(a => {
    const card = document.createElement("div");
    const disabled = !!a.disabled;
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      background: white;
      border: 2px solid ${a.quiet ? "var(--sage)" : "var(--rose)"};
      border-radius: 16px;
      padding: 0.6rem 0.7rem;
      width: 92px;
      transition: transform 0.15s, box-shadow 0.15s;
      direction: rtl;
      cursor: ${disabled ? "not-allowed" : "pointer"};
      opacity: ${disabled ? 0.4 : 1};
      filter: ${disabled ? "grayscale(0.6)" : "none"};
    `;
    if (a.tip) card.title = a.tip;
    card.innerHTML = `
      <img src="${a.img}" style="width:44px;height:44px;object-fit:contain;" alt="${a.label}"/>
      <span style="font-size:0.72rem;font-weight:700;color:var(--charcoal);text-align:center;">${a.label}</span>
      <span style="font-size:0.62rem;color:var(--muted);text-align:center;">${a.sub}</span>
      ${a.hint ? `<span style="font-size:0.58rem;color:var(--sage-dark);text-align:center;font-weight:700;">${a.hint}</span>` : ""}
    `;
    if (!disabled) {
      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-3px)";
        card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.style.boxShadow = "";
      });
      card.addEventListener("click", () => {
        grid.querySelectorAll("div").forEach(c => {
          c.style.opacity = "0.5";
          c.style.pointerEvents = "none";
        });
        a.action();
      });
    }
    grid.appendChild(card);
  });

  choiceButtons.appendChild(grid);
}

// ── סימון משימה כבוצעה ───────────────────────────────────────────────────────
function completeTask(taskId) {
  if (!(taskId in gameState.tasksDone)) return;
  if (gameState.tasksDone[taskId]) return;
  gameState.tasksDone[taskId] = true;

  const el = document.getElementById("task-" + taskId);
  if (el) {
    el.classList.add("done");
    const check = el.querySelector(".task-check");
    if (check) check.textContent = "✓";
    const hint = el.querySelector(".task-hint");
    if (hint) hint.remove();
  }
}

// ── עדכון לוח המשימות בצד ───────────────────────────────────────────────────
function updateTasksPanel() {
  ["pump", "laundry"].forEach(id => {
    const el = document.getElementById("task-" + id);
    if (!el) return;
    const done = gameState.tasksDone[id];
    if (done) {
      el.classList.add("done");
      const check = el.querySelector(".task-check");
      if (check) check.textContent = "✓";
    }
    // רמז "עדיף עכשיו" לשאיבה — מחזורים 0-1 בלבד, רק אם לא בוצעה
    if (id === "pump") {
      let hint = el.querySelector(".task-hint");
      const showHint = !done && gameState.act === 2 && gameState.sleepCycle <= 1;
      if (showHint && !hint) {
        hint = document.createElement("span");
        hint.className = "task-hint";
        hint.textContent = "⭐ עדיף עכשיו";
        hint.style.cssText =
          "font-size:0.62rem;color:var(--sage-dark);font-weight:700;margin-right:0.3rem;";
        el.appendChild(hint);
      } else if (!showHint && hint) {
        hint.remove();
      }
    }
  });
}

// ── סיום שלב פעולה ────────────────────────────────────────────────────────────
function endActionPhase() {
  updateHUD();
  updateTasksPanel();
  // sleepCycle מתקדם רק עם הרדמה מוצלחת. כאן רק חוזרים לתפריט;
  // השכמה מתבצעת דרך triggerBabyCrying (טיימר השינה או מד הרעות).
  setTimeout(showSelfCareMenu, 400);
}

// ═══════════════════════════════════════════════════════════════════════
//  MINI-GAMES — replace #choice-buttons content during a task
// ═══════════════════════════════════════════════════════════════════════

// בסיס למיני־משחק: ננקה את שטח הבחירה, נרשום cleanup, ונחזיר את ה־host element.
function _minigameHost(name) {
  runMinigameCleanup();
  gameState.activeMinigame = name;
  choiceButtons.innerHTML = "";
  const host = document.createElement("div");
  host.className = "minigame";
  host.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    direction: rtl;
    width: 100%;
  `;
  choiceButtons.appendChild(host);
  return host;
}

// ── מיני־משחק שאיבה ──────────────────────────────────────────────────
function startPumpMinigame(mode) {
  const host = _minigameHost("pump");
  const isElectric = mode === "electric";

  if (isElectric) {
    gameState.budget -= 200;
    SoundManager.moneySpend();
    updateHUD();
  }

  if (!document.getElementById('mg-pump-style')) {
    const s = document.createElement('style');
    s.id = 'mg-pump-style';
    s.textContent = [
      '.mg-bottle{position:relative;width:130px;height:260px;}',
      '.mg-teat{position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:36px;height:44px;background:radial-gradient(ellipse at 42% 28%,#fbf1dd 0%,#efdcbb 62%,#e2c99e 100%);border-radius:46% 46% 40% 40%/62% 62% 38% 38%;box-shadow:inset 0 -4px 7px rgba(180,140,90,.22),inset 3px 4px 6px rgba(255,255,255,.6);z-index:4;filter:url(#mg-wc);}',
      '.mg-teat::after{content:"";position:absolute;top:8px;left:10px;width:8px;height:18px;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.75),rgba(255,255,255,0));}',
      '.mg-teat::before{content:"";position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:40px;height:8px;border-radius:50%;background:linear-gradient(180deg,#e9d4ac,#dcc193);box-shadow:inset 0 -1px 2px rgba(150,110,60,.3);}',
      '.mg-collar{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:80px;height:22px;border-radius:7px;background:linear-gradient(180deg,#f5b9bf,#e8b4b8 60%,#d99aa0);box-shadow:inset 0 -3px 4px rgba(150,90,95,.3),0 2px 4px rgba(0,0,0,.08);z-index:3;filter:url(#mg-wc);}',
      '.mg-bottle-body{position:absolute;top:46px;left:50%;transform:translateX(-50%);width:110px;height:208px;border-radius:20px 20px 40px 40px/26px 26px 54px 54px;background:linear-gradient(105deg,rgba(255,255,255,.55),rgba(232,224,212,.4));box-shadow:inset 12px 0 20px rgba(255,255,255,.6),inset -14px 0 22px rgba(180,170,155,.35),0 12px 20px rgba(120,110,90,.18);overflow:hidden;border:2px solid rgba(255,255,255,.5);filter:url(#mg-wc);}',
      '.mg-milk{position:absolute;left:0;right:0;bottom:0;height:0%;background:linear-gradient(180deg,#fbfaf6 0%,#f6f2ea 60%,#efe9dd 100%);transition:height .65s cubic-bezier(.34,1.3,.5,1);}',
      '.mg-milk::before{content:"";position:absolute;top:-9px;left:-10%;width:120%;height:18px;background:radial-gradient(ellipse 28px 10px at 20% 50%,#fbfaf6 60%,transparent 70%),radial-gradient(ellipse 30px 10px at 55% 60%,#fbfaf6 60%,transparent 70%),radial-gradient(ellipse 28px 10px at 85% 50%,#fbfaf6 60%,transparent 70%);animation:mgWave 3s ease-in-out infinite;}',
      '@keyframes mgWave{0%,100%{transform:translateX(0)}50%{transform:translateX(-10px)}}',
      '.mg-bottle-shine{position:absolute;top:12px;left:16px;width:12px;height:140px;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,0));z-index:5;}',
      '.mg-ticks{position:absolute;top:46px;bottom:0;right:0;transform:translateX(32px);z-index:6;}',
      '.mg-ticks i{position:absolute;right:0;width:12px;height:2px;border-radius:2px;background:rgba(120,110,95,.4);}',
      '.mg-ticks i.big{width:18px;}',
      '.mg-ticks i span{position:absolute;right:16px;top:-7px;font-size:.58rem;color:var(--muted);}',
      '@keyframes mgSqueeze{0%,100%{transform:scaleY(1)}40%{transform:scaleY(.9) scaleX(1.03)}}',
      '.mg-bottle.pulse{animation:mgSqueeze .4s ease;}'
    ].join('');
    document.head.appendChild(s);
  }
  if (!document.getElementById('mg-wc-filter')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mg-wc-filter';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;overflow:hidden;';
    svg.innerHTML = '<filter id="mg-wc"><feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.insertBefore(svg, document.body.firstChild);
  }

  host.innerHTML = `
    <div style="font-size:0.85rem;color:var(--charcoal);font-weight:700;">
      ${isElectric ? "🔇 משאבה חשמלית" : "🔉 משאבה ידנית"}
    </div>
    <div style="position:relative;display:flex;align-items:flex-end;">
      <div class="mg-bottle" id="mg-bottle">
        <div class="mg-teat"></div>
        <div class="mg-collar"></div>
        <div class="mg-bottle-body">
          <div class="mg-milk" id="mg-milk"></div>
          <div class="mg-bottle-shine"></div>
        </div>
        <div class="mg-ticks" id="mg-ticks"></div>
      </div>
    </div>
    <div class="pump-progress" style="font-size:0.78rem;color:var(--muted);">
      ${isElectric ? "מתמלא..." : "0/10 לחיצות"}
    </div>
    ${isElectric ? "" : `
      <button class="pump-btn" style="
        padding:0.55rem 1.4rem; font-size:0.9rem; font-weight:700;
        background:var(--sage); color:var(--charcoal);
        border:2px solid var(--sage-dark); border-radius:14px;
        cursor:pointer; direction:rtl;
      ">לחצי לשאוב 🍼</button>
    `}
  `;

  // build measurement ticks
  const ticksEl = host.querySelector('#mg-ticks');
  for (let p = 10; p <= 100; p += 10) {
    const i = document.createElement('i');
    i.style.top = (100 - p) + '%';
    if (p % 50 === 0) { i.className = 'big'; i.innerHTML = '<span>' + Math.round(150 * p / 100) + '</span>'; }
    ticksEl.appendChild(i);
  }

  const fillEl     = host.querySelector("#mg-milk");
  const bottleEl   = host.querySelector("#mg-bottle");
  const progressEl = host.querySelector(".pump-progress");

  if (isElectric) {
    // מילוי אוטומטי ב-8 שניות
    requestAnimationFrame(() => {
      fillEl.style.transition = "height 8s linear";
      fillEl.style.height = "100%";
    });
    const finishT = setTimeout(() => {
      pumpComplete();
    }, 8100);
    gameState.minigameCleanup = () => {
      clearTimeout(finishT);
      choiceButtons.innerHTML = "";
    };
  } else {
    // ידנית — 10 לחיצות
    let clicks = 0;
    const btn = host.querySelector(".pump-btn");
    const onClick = () => {
      if (clicks >= 10) return;
      clicks++;
      fillEl.style.height = (clicks * 10) + "%";
      progressEl.textContent = `${clicks}/10 לחיצות`;
      bottleEl.classList.remove('pulse'); void bottleEl.offsetWidth; bottleEl.classList.add('pulse');
      SoundManager.softClick();
      increaseBabyMeter(2);
      // אם התינוקת התעוררה (מד 100) — runMinigameCleanup כבר רץ דרך triggerBabyCrying
      if (gameState.activeMinigame !== "pump") return;
      if (clicks >= 10) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        setTimeout(pumpComplete, 350);
      }
    };
    btn.addEventListener("click", onClick);
    gameState.minigameCleanup = () => {
      btn.removeEventListener("click", onClick);
      choiceButtons.innerHTML = "";
    };
  }

  function pumpComplete() {
    if (gameState.activeMinigame !== "pump") return;
    runMinigameCleanup();
    showToast("שאיבה הסתיימה 🍼");
    completeTask("pump");
    endActionPhase();
  }
}

// ── מיני־משחק כביסה ──────────────────────────────────────────────────
function startLaundryMinigame(mode) {
  const host = _minigameHost("laundry");
  const isService = mode === "service";

  if (isService) {
    gameState.budget -= 150;
    SoundManager.moneySpend();
    updateHUD();
  }

  // הודעת התקדמות בלבד בתחתית
  host.innerHTML = `
    <div style="font-size:0.85rem;color:var(--charcoal);font-weight:700;">
      ${isService ? "🔇 שירות איסוף כביסה" : "🔉 כביסה בבית"}
    </div>
    <div class="laundry-progress" style="font-size:0.8rem;color:var(--muted);">
      0/4 פריטים נאספו — גררי לסל
    </div>
  `;
  const progressEl = host.querySelector(".laundry-progress");

  const roomView = document.getElementById("room-view");
  const clothes = [
    { src: "assets/Small socks need washing.png",       alt: "גרביים" },
    { src: "assets/Baby shirt worn slightly dirty.png", alt: "חולצה" },
    { src: "assets/baby overall.png",                   alt: "אוברול" },
    { src: "assets/Baby hat needs washing.png",         alt: "כובע" },
  ];
  const positions = [
    { left: "12%", bottom: "28%" },
    { left: "38%", bottom: "32%" },
    { left: "62%", bottom: "30%" },
    { left: "80%", bottom: "26%" },
  ];

  // סל יעד
  const bag = document.createElement("img");
  bag.src = "assets/laundryBag.png";
  bag.alt = "סל כביסה";
  bag.id  = "laundry-bag-target";
  bag.style.cssText = `
    position:absolute; left:50%; bottom:4%;
    transform:translateX(-50%);
    width:14%; height:auto; z-index:6;
    pointer-events:none;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
  `;
  roomView.appendChild(bag);

  const items = [];
  let collected = 0;

  clothes.forEach((c, i) => {
    const el = document.createElement("img");
    el.src = c.src;
    el.alt = c.alt;
    el.className = "laundry-item";
    el.style.cssText = `
      position:absolute;
      left:${positions[i].left}; bottom:${positions[i].bottom};
      width:9%; height:auto; z-index:7;
      cursor:grab;
      object-fit:contain;
      transition: filter 0.3s ease, transform 0.2s ease, opacity 0.3s ease;
      ${isService ? "filter: drop-shadow(0 0 8px rgba(255,225,140,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.25));" : "filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));"}
    `;
    roomView.appendChild(el);
    items.push(el);
    _attachLaundryDrag(el);
  });

  function _attachLaundryDrag(el) {
    let startX = 0, startY = 0, baseLeft = 0, baseBottom = 0;
    const cr = () => roomView.getBoundingClientRect();

    const onDown = (clientX, clientY) => {
      const r = roomView.getBoundingClientRect();
      baseLeft   = parseFloat(el.style.left);
      baseBottom = parseFloat(el.style.bottom);
      startX = clientX; startY = clientY;
      el.style.cursor = "grabbing";
      el.style.zIndex = "20";
    };

    const onMove = (clientX, clientY) => {
      const r = cr();
      const dxPct = (clientX - startX) / r.width  * 100;
      const dyPct = (clientY - startY) / r.height * 100;
      const newLeft   = Math.max(0, Math.min(92, baseLeft + dxPct));
      const newBottom = Math.max(0, Math.min(90, baseBottom - dyPct));
      el.style.left   = newLeft + "%";
      el.style.bottom = newBottom + "%";
    };

    const onUp = () => {
      el.style.cursor = "grab";
      // האם נחת על הסל?
      const er = el.getBoundingClientRect();
      const br = bag.getBoundingClientRect();
      const overlap =
        er.left < br.right && er.right > br.left &&
        er.top  < br.bottom && er.bottom > br.top;
      if (overlap) collectItem(el);
    };

    el.addEventListener("mousedown", e => {
      if (gameState.activeMinigame !== "laundry") return;
      e.preventDefault();
      onDown(e.clientX, e.clientY);
      const mm = ev => onMove(ev.clientX, ev.clientY);
      const mu = () => {
        document.removeEventListener("mousemove", mm);
        document.removeEventListener("mouseup", mu);
        onUp();
      };
      document.addEventListener("mousemove", mm);
      document.addEventListener("mouseup", mu);
    });

    el.addEventListener("touchstart", e => {
      if (gameState.activeMinigame !== "laundry") return;
      const t = e.touches[0]; if (!t) return;
      e.preventDefault();
      onDown(t.clientX, t.clientY);
      const tm = ev => {
        const tt = ev.touches[0]; if (!tt) return;
        onMove(tt.clientX, tt.clientY);
      };
      const tu = () => {
        document.removeEventListener("touchmove", tm);
        document.removeEventListener("touchend", tu);
        onUp();
      };
      document.addEventListener("touchmove", tm, { passive: false });
      document.addEventListener("touchend", tu);
    }, { passive: false });
  }

  function collectItem(el) {
    if (el.dataset.collected) return;
    el.dataset.collected = "1";
    if (!isService) increaseBabyMeter(6);
    if (gameState.activeMinigame !== "laundry") return;  // יתכן ש-triggerBabyCrying ניקה
    el.style.transition = "transform 0.35s ease, opacity 0.35s ease";
    el.style.transform  = "scale(0.4) translateY(20px)";
    el.style.opacity    = "0";
    setTimeout(() => el.remove(), 360);
    collected++;
    progressEl.textContent = `${collected}/4 פריטים נאספו`;
    if (collected >= 4) {
      setTimeout(laundryComplete, 500);
    }
  }

  function laundryComplete() {
    if (gameState.activeMinigame !== "laundry") return;
    runMinigameCleanup();
    showToast(isService ? "שירות הכביסה אסף הכל 🧺" : "הכביסה במכונה 🧺");
    completeTask("laundry");
    endActionPhase();
  }

  gameState.minigameCleanup = () => {
    items.forEach(el => { if (el.parentNode) el.remove(); });
    if (bag.parentNode) bag.remove();
    choiceButtons.innerHTML = "";
  };
}

// ── מיני־משחק קפה ────────────────────────────────────────────────────
function startCoffeeMinigame() {
  const host = _minigameHost("coffee");

  if (!document.getElementById('mg-coffee-style')) {
    const s = document.createElement('style');
    s.id = 'mg-coffee-style';
    s.textContent = [
      '.mg-coffee-scene{position:relative;width:260px;height:280px;display:flex;align-items:flex-end;justify-content:center;}',
      '.mg-pour{position:absolute;top:0;left:calc(50% + 6px);transform:translateX(-50%);width:11px;height:140px;z-index:6;transform-origin:top center;opacity:0;}',
      '.mg-pour i{position:absolute;inset:0;border-radius:46% 46% 40% 40%;background:linear-gradient(180deg,#3a2414,#5e3a22 60%,#6b4126);box-shadow:inset 2px 0 3px rgba(255,255,255,.18);filter:url(#mg-wc);}',
      '.mg-pour i::after{content:"";position:absolute;top:0;left:2px;width:3px;height:100%;background:linear-gradient(180deg,rgba(255,235,205,.55),transparent);}',
      '.mg-pour.go{animation:mgPourIn .5s ease forwards,mgPourOut .6s ease 3.2s forwards;}',
      '@keyframes mgPourIn{0%{opacity:0;transform:translateX(-50%) scaleY(.2)}100%{opacity:1;transform:translateX(-50%) scaleY(1)}}',
      '@keyframes mgPourOut{0%{opacity:1;transform:translateX(-50%) scaleY(1)}100%{opacity:0;transform:translateX(-50%) scaleY(.1)}}',
      '.mg-steam{position:absolute;bottom:195px;left:50%;width:100px;height:90px;transform:translateX(-50%);pointer-events:none;opacity:0;transition:opacity 1.2s ease;}',
      '.mg-steam.go{opacity:1;}',
      '.mg-steam span{position:absolute;bottom:0;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(255,255,255,.9),rgba(243,226,205,.2) 70%,transparent);filter:blur(2px);animation:mgSteam 3.4s ease-in-out infinite;}',
      '.mg-steam span:nth-child(1){left:20px;animation-delay:0s;}',
      '.mg-steam span:nth-child(2){left:40px;animation-delay:.9s;}',
      '.mg-steam span:nth-child(3){left:58px;animation-delay:1.8s;}',
      '.mg-steam span:nth-child(4){left:32px;animation-delay:2.5s;}',
      '@keyframes mgSteam{0%{transform:translateY(0) scale(.7);opacity:0;}18%{opacity:.7;}55%{transform:translateY(-48px) scale(1.5) translateX(-8px);opacity:.4;}100%{transform:translateY(-82px) scale(2.2) translateX(6px);opacity:0;}}',
      '.mg-mug-wrap{position:relative;width:170px;height:170px;margin-bottom:8px;}',
      '.mg-handle{position:absolute;top:48px;right:-32px;width:50px;height:76px;border:12px solid rgba(196,212,192,.5);border-radius:50%;border-left-color:transparent;border-top-color:transparent;transform:rotate(20deg);box-shadow:inset 1px 1px 3px rgba(255,255,255,.5);filter:url(#mg-wc);}',
      '.mg-mug{position:absolute;inset:0;background:linear-gradient(110deg,rgba(255,255,255,.42) 0%,rgba(196,212,192,.3) 40%,rgba(150,176,150,.28) 100%);border:2px solid rgba(255,255,255,.6);border-radius:18px 18px 58px 58px/14px 14px 52px 52px;box-shadow:inset 14px 0 22px rgba(255,255,255,.4),inset -16px 0 24px rgba(120,150,120,.18),0 14px 22px rgba(120,110,90,.16);overflow:hidden;filter:url(#mg-wc);}',
      '.mg-mug::before{content:"";position:absolute;top:12px;right:18px;width:13px;height:110px;border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,0));z-index:5;}',
      '.mg-well{position:absolute;top:5px;left:5px;right:5px;bottom:5px;border-radius:14px 14px 54px 54px/10px 10px 50px 50px;overflow:hidden;z-index:2;}',
      '.mg-coffee-fill{position:absolute;left:0;right:0;bottom:0;height:0%;background:linear-gradient(180deg,#6b4327 0%,#5a361f 30%,#3a2414 100%);box-shadow:inset 22px 16px 36px rgba(150,96,54,.45),inset -18px -8px 26px rgba(20,10,4,.35);}',
      '.mg-crema{position:absolute;top:0;left:0;right:0;height:22%;background:linear-gradient(180deg,#f6e8ce 0%,#f0ddb8 45%,#cf9f63 85%,#b98a4e 100%);border-radius:50% 50% 0 0/60% 60% 0 0;opacity:0;transition:opacity 0.5s ease;}'
    ].join('');
    document.head.appendChild(s);
  }
  if (!document.getElementById('mg-wc-filter')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mg-wc-filter';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;overflow:hidden;';
    svg.innerHTML = '<filter id="mg-wc"><feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.insertBefore(svg, document.body.firstChild);
  }

  host.innerHTML = `
    <div style="font-size:0.85rem;color:var(--charcoal);font-weight:700;">
      ☕ קפה — אל תזוזי מהר
    </div>
    <div class="mg-coffee-scene">
      <div class="mg-steam" id="mg-steam"><span></span><span></span><span></span><span></span></div>
      <div class="mg-pour" id="mg-pour"><i></i></div>
      <div class="mg-mug-wrap">
        <div class="mg-handle"></div>
        <div class="mg-mug">
          <div class="mg-well">
            <div class="mg-coffee-fill" id="mg-coffee-fill">
              <div class="mg-crema" id="mg-crema"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="coffee-status" style="font-size:0.75rem;color:var(--muted);min-height:1em;">
      מחממת...
    </div>
  `;

  const fillEl   = host.querySelector("#mg-coffee-fill");
  const foamEl   = host.querySelector("#mg-crema");
  const steamEl  = host.querySelector("#mg-steam");
  const pourEl   = host.querySelector("#mg-pour");
  const statusEl = host.querySelector(".coffee-status");

  let phaseTimer1 = null, phaseTimer2 = null, completeTimer = null;
  let lcx = 0, lcy = 0, lct = 0;

  function startBrew() {
    pourEl.classList.remove('go'); void pourEl.offsetWidth; pourEl.classList.add('go');
    fillEl.style.transition = "height 3s linear";
    fillEl.style.height = "100%";
    phaseTimer1 = setTimeout(() => {
      foamEl.style.opacity = "1";
      steamEl.classList.add('go');
      statusEl.textContent = "כמעט מוכן ☕";
    }, 3050);
    completeTimer = setTimeout(coffeeComplete, 5000);
  }

  function restartBrew() {
    if (gameState.activeMinigame !== "coffee") return;
    clearTimeout(phaseTimer1);
    clearTimeout(completeTimer);
    fillEl.style.transition = "height 0.2s ease";
    fillEl.style.height   = "0%";
    foamEl.style.opacity  = "0";
    steamEl.classList.remove('go');
    pourEl.classList.remove('go');
    statusEl.textContent = "הקפה נשפך! 😅";
    setTimeout(() => {
      if (gameState.activeMinigame !== "coffee") return;
      statusEl.textContent = "מחממת שוב...";
      startBrew();
    }, 800);
  }

  function spillCheck(e) {
    if (gameState.activeMinigame !== "coffee") return;
    const now = Date.now();
    const dt = now - lct;
    if (dt < 16) return;
    const dist = Math.hypot(e.clientX - lcx, e.clientY - lcy);
    const speed = dist / dt;
    if (speed > 2.0) restartBrew();
    lcx = e.clientX; lcy = e.clientY; lct = now;
  }
  function touchSpill(e) {
    const t = e.touches[0]; if (!t) return;
    spillCheck({ clientX: t.clientX, clientY: t.clientY });
  }
  document.addEventListener("mousemove", spillCheck);
  document.addEventListener("touchmove", touchSpill, { passive: true });

  function coffeeComplete() {
    if (gameState.activeMinigame !== "coffee") return;
    runMinigameCleanup();
    restoreSanity(8);
    showToast("+8 שפיות — חמימות בכפות הידיים.");
    endActionPhase();
  }

  gameState.minigameCleanup = () => {
    clearTimeout(phaseTimer1);
    clearTimeout(phaseTimer2);
    clearTimeout(completeTimer);
    document.removeEventListener("mousemove", spillCheck);
    document.removeEventListener("touchmove", touchSpill);
    choiceButtons.innerHTML = "";
  };

  startBrew();
}

// ── מיני־משחק קריאה ──────────────────────────────────────────────────
function startReadingMinigame() {
  const host = _minigameHost("reading");
  gameState.readingMode = true;  // מוריד מכפיל רעש ב-stealthMouseHandler

  const pages = [
    "לקחת נשימה. הכל בסדר.",
    "את עושה עבודה טובה.",
    "יום אחד כל פעם.",
  ];

  if (!document.getElementById('mg-book-style')) {
    const s = document.createElement('style');
    s.id = 'mg-book-style';
    s.textContent = [
      '.mg-book{position:relative;width:min(420px,86vw);height:260px;perspective:1600px;filter:drop-shadow(0 14px 20px rgba(120,100,80,.2));}',
      '.mg-cover{position:absolute;inset:-12px -16px -18px;background:linear-gradient(120deg,#cdb79a,#b89a78);border-radius:12px 16px 16px 12px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.12);}',
      '.mg-spread{position:absolute;inset:0;display:flex;border-radius:7px;overflow:hidden;background:#fbf4e9;}',
      '.mg-page-half{flex:1;position:relative;background:linear-gradient(var(--mg-ang,100deg),#fbf4e9 0%,#f7eedd 100%);padding:2rem 1.6rem;display:flex;align-items:center;justify-content:center;}',
      '.mg-page-half.right{--mg-ang:80deg;}',
      '.mg-page-deco{position:absolute;inset:1.4rem;border:1.5px solid rgba(200,168,106,.22);border-radius:5px;pointer-events:none;}',
      '.mg-gutter{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:40px;z-index:5;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(120,90,60,.14) 38%,rgba(120,90,60,.2) 50%,rgba(120,90,60,.14) 62%,transparent);}',
      '.mg-spread::before,.mg-spread::after{content:"";position:absolute;top:5px;bottom:5px;width:7px;background:repeating-linear-gradient(180deg,#ecdcc4,#ecdcc4 1px,#f6ead4 1px,#f6ead4 3px);z-index:4;}',
      '.mg-spread::before{right:-6px;border-radius:0 5px 5px 0;}',
      '.mg-spread::after{left:-6px;border-radius:5px 0 0 5px;}',
      '.mg-story{font-family:"Frank Ruhl Libre","Assistant",serif;font-size:1.1rem;line-height:1.9;color:#3d2b2b;text-align:center;max-width:11rem;transition:opacity .5s ease,transform .5s ease;}',
      '.mg-story.out{opacity:0;transform:translateY(6px);}',
      '.mg-vignette{width:130px;height:160px;position:relative;}',
      '.mg-sky{position:absolute;inset:0;border-radius:50% 50% 46% 46%/55% 55% 45% 45%;background:radial-gradient(ellipse at 50% 30%,#f6dfe3 0%,#e8c5cd 60%,#d8b0bb 100%);filter:url(#mg-wc2);}',
      '.mg-hill{position:absolute;bottom:0;left:0;right:0;height:64px;border-radius:46% 46% 0 0/100% 100% 0 0;background:radial-gradient(ellipse at 40% 0%,#cfe0c9,#a9c6a2);filter:url(#mg-wc2);}',
      '.mg-sun{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#fff4d6,#f3d79a 70%,#e9c178);box-shadow:0 0 18px rgba(243,215,154,.7);}',
      '.mg-bird{position:absolute;width:12px;height:6px;border:2px solid #9a7d6a;border-color:#9a7d6a transparent transparent transparent;border-radius:50%;}',
      '.mg-bird.b1{top:40px;left:26px;}',
      '.mg-bird.b2{top:50px;left:80px;transform:scale(.8);}',
      '.mg-turn{position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(100deg,#f7eedd,#fbf4e9);opacity:0;z-index:6;backface-visibility:hidden;}',
      '.mg-turn.next{left:0;transform-origin:right center;box-shadow:6px 0 14px rgba(120,90,60,.16);border-radius:2px 5px 5px 2px;}',
      '.mg-turn.next.flip{animation:mgFlipNext .9s ease both;}',
      '@keyframes mgFlipNext{0%{opacity:1;transform:rotateY(0deg)}100%{opacity:1;transform:rotateY(160deg)}}',
      '.mg-reading-progress{font-size:0.72rem;color:var(--muted);}'
    ].join('');
    document.head.appendChild(s);
  }
  if (!document.getElementById('mg-wc2-filter')) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mg-wc2-filter';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;overflow:hidden;';
    svg.innerHTML = '<filter id="mg-wc2"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.insertBefore(svg, document.body.firstChild);
  }

  host.innerHTML = `
    <div class="mg-book">
      <div class="mg-cover"></div>
      <div class="mg-spread">
        <div class="mg-page-half right">
          <div class="mg-page-deco"></div>
          <p class="mg-story" id="mg-story">${pages[0]}</p>
        </div>
        <div class="mg-page-half left">
          <div class="mg-page-deco"></div>
          <div class="mg-vignette">
            <div class="mg-sky"></div>
            <div class="mg-sun"></div>
            <div class="mg-bird b1"></div>
            <div class="mg-bird b2"></div>
            <div class="mg-hill"></div>
          </div>
        </div>
      </div>
      <div class="mg-gutter"></div>
      <div class="mg-turn next" id="mg-turn"></div>
    </div>
    <div class="mg-reading-progress" id="mg-reading-progress">עמוד 1 מתוך 3</div>
  `;

  const pageEl     = host.querySelector("#mg-story");
  const progressEl = host.querySelector("#mg-reading-progress");
  const turnEl     = host.querySelector("#mg-turn");
  let idx = 0;
  let turnTimer = null;

  function crossfadeTo(next) {
    turnEl.classList.remove('flip');
    void turnEl.offsetWidth;
    turnEl.classList.add('flip');
    pageEl.classList.add('out');
    setTimeout(() => {
      if (gameState.activeMinigame !== "reading") return;
      pageEl.textContent     = pages[next];
      progressEl.textContent = `עמוד ${next + 1} מתוך 3`;
      pageEl.classList.remove('out');
    }, 450);
    setTimeout(() => { turnEl.classList.remove('flip'); }, 900);
  }

  function tick() {
    idx++;
    if (idx >= pages.length) {
      finish();
      return;
    }
    crossfadeTo(idx);
    turnTimer = setTimeout(tick, 3000);
  }

  function finish() {
    if (gameState.activeMinigame !== "reading") return;
    runMinigameCleanup();
    restoreSanity(5);
    showToast("+5 שפיות — נזכרת מי את.");
    endActionPhase();
  }

  turnTimer = setTimeout(tick, 3000);

  gameState.minigameCleanup = () => {
    clearTimeout(turnTimer);
    gameState.readingMode = false;
    choiceButtons.innerHTML = "";
  };
}

// ── מכניזם עכבר סמוי — היום הראשון ─────────────────────────────────────────────
let lastX = 0, lastY = 0, lastTime = 0;

function isMouseOverBaby(e) {
  const babyEl = document.getElementById("room-baby");
  if (!babyEl) return false;
  const r = babyEl.getBoundingClientRect();
  return (
    e.clientX >= r.left && e.clientX <= r.right &&
    e.clientY >= r.top  && e.clientY <= r.bottom
  );
}

function beginStealthMode() {
  babyMeterCont.style.display = "flex";
  babyMeterCont.style.position = "absolute";
  babyMeterCont.style.top = "auto";
  babyMeterCont.style.bottom = "4px";
  babyMeterCont.style.left = "50%";
  babyMeterCont.style.transform = "translateX(-50%)";
  babyMeterCont.style.width = "40%";
  babyMeterCont.style.opacity = "0.6";
  babyMeterCont.style.zIndex = "10";
  const wavesEl = document.getElementById("baby-waves");
  if (wavesEl) wavesEl.classList.add("active");
  if (!gameState.stealthListenerAdded) {
    gameState.stealthListenerAdded = true;
    document.addEventListener("mousemove", stealthMouseHandler);
    document.addEventListener("touchmove", stealthTouchHandler, { passive: true });
  }
}

function stealthTouchHandler(e) {
  if (!gameState.stealthActive) return;
  const touch = e.touches[0];
  if (!touch) return;
  stealthMouseHandler({ clientX: touch.clientX, clientY: touch.clientY });
}

function stealthMouseHandler(e) {
  if (!gameState.stealthActive) return;

  const now = Date.now();
  const dt  = now - lastTime;
  if (dt < 16) return;

  const dist  = Math.hypot(e.clientX - lastX, e.clientY - lastY);
  const speed = dist / dt;
  const s     = gameState.babyMeterSlowdown;

  if (gameState.lullabyPhase) {
    const overBaby = isMouseOverBaby(e);
    if (overBaby && speed < 0.8) {
      gameState.babyMeter = Math.max(0, gameState.babyMeter - 2.5);
      babyMeterFill.style.width = gameState.babyMeter + "%";
      updateBabyWaves();
      if (gameState.babyMeter <= 30) babyMeterFill.classList.remove("danger");
      if (gameState.babyMeter === 0) {
        SoundManager.lullabySuccess();
        gameState.lullabyPhase = false;
        // Baby is now asleep → stealth period begins. Must flip to true
        // BEFORE renderRoom(), otherwise renderItem(crib) sees the old
        // value and reverts the crib to the empty asset, hiding the baby.
        gameState.stealthActive = true;
        renderBaby("sleeping");
        renderRoom();
        const babyEl = document.getElementById("room-baby");
        if (babyEl) babyEl.style.pointerEvents = "none";
        if (babyEl) babyEl.style.cursor = "default";
        if (babyEl) babyEl.classList.remove("lullaby");
        document.getElementById("lullaby-hint")?.classList.add("hidden");

        // ── יום נגמר? בדיקה לפני קידום, כדי לא להגיע ל-cycle+1 ── //
        const isFinalSleep = gameState.sleepCycle + 1 >= gameState.totalCycles;
        gameState.sleepCycle++;
        updateHUD();
        updateTasksPanel();

        if (isFinalSleep) {
          // נועלים את המשחק מיידית כדי שום עכבר/לחיצה לא יוכלו
          // לפתוח עוד מחזור הרדמה לפני שהסיום מופיע.
          gameState.endingTriggered = true;
          gameState.stealthActive   = false;
          gameState.lullabyPhase    = false;
          clearSleepTimer();
          triggerEnding();
        } else {
          setTimeout(beginActionPhase, 800);
        }
      }
    } else if (speed > 1.5) {
      const readMod = gameState.readingMode ? 0.5 : 1;
      increaseBabyMeter(speed * 1.5 * (gameState.babyMeterSlowdown || 1.0) * readMod);
    }
  } else {
    if (speed > 1.5) {
      const readMod = gameState.readingMode ? 0.5 : 1;
      increaseBabyMeter(speed * 1.8 * s * readMod);
    }
    document.querySelectorAll(".noisy-sprite").forEach(sprite => {
      const r = sprite.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom) {
        const penalty = parseInt(sprite.dataset.noisy || "10", 10);
        increaseBabyMeter(penalty * s);
      }
    });
  }

  lastX = e.clientX;
  lastY = e.clientY;
  lastTime = now;
}

function updateBabyWaves() {
  const babyEl = document.getElementById("room-baby");
  const wavesEl = document.getElementById("baby-waves");
  if (!babyEl || !wavesEl) return;

  const container = document.getElementById("room-view");
  const cr = container.getBoundingClientRect();
  const br = babyEl.getBoundingClientRect();

  wavesEl.style.left = (br.left - cr.left + br.width / 2) + "px";
  wavesEl.style.top  = (br.top  - cr.top  + br.height / 2) + "px";

  const scale = 0.5 + (gameState.babyMeter / 100) * 1.5;
  const color = gameState.babyMeter > 70
    ? "rgba(201,80,80,0.7)"
    : "rgba(138,171,132,0.6)";
  wavesEl.querySelectorAll(".wave-ring").forEach(ring => {
    ring.style.transform = `translate(-50%, -50%) scale(${scale})`;
    ring.style.borderColor = color;
  });
}

function increaseBabyMeter(amount) {
  gameState.babyMeter = Math.min(100, gameState.babyMeter + amount);
  babyMeterFill.style.width = gameState.babyMeter + "%";
  if (gameState.act === 2) updateBabyWaves();

  if (gameState.babyMeter > 70) {
    babyMeterFill.classList.add("danger");
  }

  if (gameState.babyMeter >= 100) {
    gameState.babyMeter = 0;
    babyMeterFill.style.width = "0%";
    babyMeterFill.classList.remove("danger");
    triggerBabyCrying();
  }
}

function triggerBabyCrying() {
  if (gameState.endingTriggered) return;          // היום נגמר — בלי בכי חדש
  clearSleepTimer();
  runMinigameCleanup();      // אם רץ מיני־משחק, מנקים אותו — המשימה לא מסומנת כבוצעה
  SoundManager.babyCry();
  if (typeof gtag !== 'undefined') gtag('event', 'baby_cried');
  gameState.stealthActive = false;
  gameState.lullabyPhase = false;
  gameState.babyCried = true;

  renderBaby("crying");
  renderRoom();
  document.getElementById("room-crying-overlay")?.classList.add("active");
  document.getElementById("lullaby-hint")?.classList.add("hidden");
  $("room-view").style.pointerEvents = "none";
  drainSanity(15);

  narrate(`<strong>😭 התינוקת התעוררה!</strong><br>−15 שפיות.`);
  setChoices([{
    label: "הרגיעי אותה",
    primary: true,
    action: () => {
      gameState.babyMeter = 0;
      babyMeterFill.style.width = "0%";
      babyMeterFill.classList.remove("danger");
      document.getElementById("room-crying-overlay")?.classList.remove("active");
      $("room-view").style.pointerEvents = "";
      beginLullaby();
    }
  }]);
}

// ── סיומות ───────────────────────────────────────────────────────────────────
function triggerEnding() {
  if (gameState._endingRendered) return;          // idempotent
  gameState._endingRendered = true;
  gameState.endingTriggered = true;
  clearSleepTimer();
  runMinigameCleanup();
  // עונש על משימות שלא בוצעו — לפני חישוב טקסט הסיום
  const undoneLines = [];
  if (!gameState.tasksDone.pump) {
    drainSanity(10);
    undoneLines.push("לא הספקת לשאוב. זה ילווה אותך.");
  }
  if (!gameState.tasksDone.laundry) {
    drainSanity(5);
    undoneLines.push("הכביסה מחכה. גם זה בסדר.");
  }

  if (typeof gtag !== 'undefined') { gtag('event', 'act_complete', { act: 2 }); gtag('event', 'game_end', { outcome: 'good' }); }
  closePhone();
  setChoices([]);
  actFade.style.zIndex = "9999";
  document.removeEventListener("mousemove", stealthMouseHandler);
  document.removeEventListener("touchmove", stealthTouchHandler);
  gameState.stealthActive = false;
  gameState.lullabyPhase = false;
  babyMeterCont.style.display = "none";
  renderBaby("hidden");

  const lullabyHint = document.getElementById("lullaby-hint");
  if (lullabyHint) lullabyHint.classList.add("hidden");

  const wavesEl = document.getElementById("baby-waves");
  if (wavesEl) wavesEl.classList.remove("active");

  const itemsBought = gameState.items.filter(i => i.isSecured).length;
  const usedItems   = gameState.items.filter(i => i._worn).length;
  const savedBudget = gameState.budget;

  let mainText, subText;
  if (gameState.sanity >= 70) {
    mainText = "את עייפה. אבל את בסדר.";
    subText  = "ממש בסדר.";
  } else if (gameState.sanity >= 40) {
    mainText = "שרדת.";
    subText  = "יום אחד כל פעם.";
  } else {
    mainText = "זה היה קשה.";
    subText  = "זה מותר להיות קשה.";
  }

  const contextLine = gameState.superstition
    ? "חיכית. וזה הגיע."
    : "היא הגיעה בלי הוראות הפעלה, אבל את מגלה לאט לאט שאת לא צריכה לקרוא שום דבר. את פשוט לומדת להקשיב. וזה מספיק.";

  const undoneBlock = undoneLines.length
    ? `<div style="font-size:0.9rem;opacity:0.75;margin-bottom:1.3rem;
                   line-height:1.7;">
         ${undoneLines.map(l => `<div>${l}</div>`).join("")}
       </div>`
    : "";

  actFadeText.innerHTML = `
    <div style="max-width:400px;margin:0 auto;text-align:center;
                line-height:2;direction:rtl;color:var(--cream);">
      <div style="font-size:2.5rem;margin-bottom:1.2rem;">👶</div>
      <div style="font-size:1.6rem;font-weight:600;margin-bottom:0.3rem;">
        ${mainText}
      </div>
      <div style="font-size:1.2rem;font-style:italic;
                  margin-bottom:1.5rem;opacity:0.85;">
        ${subText}
      </div>
      ${undoneBlock}
      <div style="font-size:0.95rem;opacity:0.7;margin-bottom:2rem;">
        ${contextLine}
      </div>
      <div style="font-size:0.78rem;opacity:0.45;
                  border-top:1px solid rgba(255,255,255,0.2);
                  padding-top:1rem;">
        תקציב: ${savedBudget.toLocaleString()} ₪
        &nbsp;·&nbsp;
        שפיות: ${gameState.sanity}%
        &nbsp;·&nbsp;
        ציוד: ${itemsBought}/5
      </div>
      <div style="font-size:0.75rem;font-style:italic;
                  margin-top:1.2rem;opacity:0.35;">
        מקום למישהי חדשה — ולך.
      </div>
    </div>
  `;

  actFade.style.pointerEvents = "all";

  setTimeout(() => {
    actFade.classList.add("active");
  }, 500);

  setTimeout(() => {
    setChoices([{
      label: "שחקי שוב",
      primary: true,
      action: () => location.reload()
    }]);
  }, 4000);
}

function triggerBadEnding() {
  if (typeof gtag !== 'undefined') gtag('event', 'game_end', { outcome: 'bad' });
  closePhone();
  setChoices([]);
  actFade.style.zIndex = "9999";
  document.removeEventListener("mousemove", stealthMouseHandler);
  document.removeEventListener("touchmove", stealthTouchHandler);
  gameState.stealthActive = false;
  const wavesEl = document.getElementById("baby-waves");
  if (wavesEl) wavesEl.classList.remove("active");
  actFade.classList.add("active");
  actFadeText.innerHTML = `
    שפיות: 0%<br><br>
    <span style="font-size:0.9rem;font-style:italic;">
      ישבת על הרצפה של חדר התינוקת הריק.<br>
      התקשרת לאמא. היא ענתה בצלצול הראשון.
    </span>
  `;
  setTimeout(() => {
    setChoices([{ label: "נסי שוב", primary: true, action: () => location.reload() }]);
    actFade.style.pointerEvents = "none";
    actFade.classList.remove("active");
  }, 4500);
}

// ── אתחול ────────────────────────────────────────────────────────────────────
function init() {
  gameState.items = ITEMS_DATA.map(d =>
    new GameItem(d.id, d.name, d.emoji, d.costNew, d.costUsed, d.allowWhatsapp)
  );
  updateHUD();
  renderRoom();

  document.addEventListener("click", () => SoundManager.resume(), { once: true });
  document.addEventListener("touchstart", () => SoundManager.resume(), { once: true });

  // Phone icon opens home screen
  const phoneIconWrapper = document.getElementById("phone-icon-wrapper");
  if (phoneIconWrapper) {
    phoneIconWrapper.addEventListener("click", openPhoneHome);
    phoneIconWrapper.style.opacity = "0.4";
    phoneIconWrapper.style.cursor = "not-allowed";
  }

  // Close button
  document.getElementById("phone-close-btn").addEventListener("click", closePhone);

  // Contact rows — unified handler
  document.querySelectorAll(".contact-row").forEach(el => {
    el.addEventListener("click", () => {
      const contact = el.dataset.contact;
      const disabled = ["maya", "shira", "noa", "dana"];
      if (disabled.includes(contact)) {
        showToast("בקרוב... 🌸");
        return;
      }
      const badge = el.querySelector(".contact-badge");
      if (badge) badge.classList.add("hidden");
      document.getElementById("phone-home").classList.add("hidden");
      if (contact === "group") {
        if (gameState.act === 2) {
          showToast("הקבוצה יכולה לחכות — התינוקת לא. 👶");
          return;
        }
        document.getElementById("phone-home").classList.add("hidden");
        openWhatsAppGroup(null);
        return;
      } else if (contact === "ronit") {
        const dresser = gameState.items.find(i => i.id === "dresser");
        openRonitNegotiation(dresser, { fromContact: true });
      } else if (contact === "hadar") {
        openHadarNegotiation({ fromContact: true });
      } else {
        openContactChat(contact);
      }
    });
  });

  startOpeningScene();
}

window.addEventListener("DOMContentLoaded", init);