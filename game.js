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
  tasksCompleted: {
    pump:     false,
    laundry:  false,
    selfcare: false,
  },
  loanFromMom: false,
  loanFromDad: false,
};

// ── מצב טלפון ───────────────────────────────────────────────────────────────
const phoneState = {
  notifications: 0,
};
let _groupActive = false;
let _groupVisitCount = 0;

// ── נתוני איש קשר ───────────────────────────────────────────────────────────
const chatHistories = {
  oriel: [], mom: [], dad: [], maya: [], shira: [], noa: [], dana: [],
};

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
      if (valEl) valEl.textContent = `${gameState.sleepCycle + 1} / ${gameState.totalCycles}`;
    } else {
      cycleEl.style.display = "none";
    }
  }
}

// ── עדכוני תקציב / שפיות ────────────────────────────────────────────────────
function spendBudget(amount) {
  gameState.budget = Math.max(0, gameState.budget - amount);
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
function secureItem(item, cost, fromRonitL = false) {
  item.isSecured = true;
  item._worn = (cost < item.costNew && cost > 0);
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

  const choices = [
    {
      label: `קנייה חדשה — ${item.costNew.toLocaleString()} ₪${gameState.budget < item.costNew ? " (אין תקציב)" : ""}`,
      action: () => {
        if (gameState.budget < item.costNew) return;
        if (gameState.budget < 300 && item.costNew > 400) {
          drainSanity(3);
          showToast("זה מחוץ להישג יד עכשיו. −3 שפיות 💸");
          narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>עמדת מול המחיר ולא יכולת. אולי יד שנייה? אולי הקבוצה?</em>`);
          return;
        }
        narrate(`הזמנת <em>${item.name}</em> ${item.gender === "f" ? "חדשה לגמרי. יקרה." : "חדש לגמרי. טרי. יקר."} שווה את זה.`);
        secureItem(item, item.costNew);
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
        } else if (item.id === "stroller") {
          openWhatsAppGroup(null);
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
      scheduleHusbandCall();
      scheduleMotherSupportCall();
    }, 1000);
  } else {
    narrate(`פתחת את רשימת הקניות. חמישה פריטים. את יכולה לעשות את זה.`);
    setTimeout(() => {
      showMainItemList();
      scheduleHusbandCall();
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

  const lines = [
    "\"מאמי, מה שלומך? הכל בסדר?\"",
    "\"כמה שהייתי רוצה לחזור הביתה להיות איתך ולעזור בהכנות.\"",
    "\"החברים כאן שולחים דרישת שלום. כולנו חושבים עלייך.\"",
    "\"אחזור הביתה בקרוב. יכולה לדאוג שיהיה דוריטוס חמוץ חריף?\""
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];

  phoneAppName.textContent = "📞 אוריאל";
  $("phone-status-bar").classList.add("call-mode");
  $("phone-status-bar").style.background = "#3a3a3a";
  phoneContent.innerHTML = `
    <div class="wa-bubble incoming" style="font-style:italic;margin-top:auto;">${line}</div>
    <div class="wa-bubble incoming" style="font-size:0.78rem;color:#888;">הקו רועש, ואז שקט.</div>
  `;
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
function openRonitNegotiation(item) {
  console.log("[openRonitNegotiation] called");
  gameState.negotiating = true;
  gameState.roniConvoHistory = [];

  phoneAppName.textContent = "🛋️ רונית (שידה)";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneInputArea.classList.remove("hidden");
  phoneOverlay.classList.remove("hidden");

  addChatBubble("רונית", "שלום! השידה עולה 500 שקל. מצב מעולה, כמעט לא הייתה בשימוש. מעניין אותך?", "ronit");

  phoneCloseBtn.onclick = () => {
    gameState.negotiating = false;
    closePhone();
    showItemMenu(item);
  };

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
function openHadarNegotiation() {
  // מוצא את פריט העגלה
  const item = gameState.items.find(i => i.id === "stroller");
  if (!item || item.isSecured) {
    narrate("העגלה כבר טופלה.");
    return;
  }

  gameState.negotiating = true;
  const history = [];

  phoneAppName.textContent = "🛒 הדר (עגלה)";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneInputArea.classList.remove("hidden");
  phoneOverlay.classList.remove("hidden");

  addChatBubble("הדר", "היי! ראיתי שפנית בנוגע לעגלה. 700 שקל, מצב מצוין, הבת שלי השתמשה בה בקושי. מעניין אותך?", "ronit");

  phoneCloseBtn.onclick = () => {
    gameState.negotiating = false;
    closePhone();
  };

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
}

function clearPhoneNotifications() {
  phoneState.notifications = 0;
  const dot  = document.getElementById("phone-notification-dot");
  const icon = document.getElementById("phone-icon");
  if (dot)  dot.classList.add("hidden");
  if (icon) icon.classList.remove("ringing");
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
    const greeting = greetings[contactId];
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
  updateHUD();
  setRoomMood("night");
  const sidePanel = document.getElementById("side-panel");
  if (sidePanel) {
    sidePanel.style.borderLeft = "2px solid var(--rose-dark)";
    sidePanel.style.background = "rgba(253,240,232,0.98)";
  }
  const tasksPanel = document.getElementById("panel-tasks");
  tasksPanel.style.display = "flex";
  tasksPanel.classList.add("highlight");
  setTimeout(() => tasksPanel.classList.remove("highlight"), 3500);

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
  gameState.lullabyPhase = true;
  gameState.stealthActive = true;
  gameState.babyMeter = 80;
  babyMeterFill.style.width = "80%";
  babyMeterFill.classList.add("danger");

  const cycleNum = gameState.sleepCycle + 1;

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
  showSelfCareMenu();
}

function showSelfCareMenu() {
  narrate("התינוקת ישנה 😴 בחרי מה לעשות עכשיו:");

  const actions = [
    {
      id: "coffee",
      img: "assets/ActionCoffee.png",
      label: "☕ קפה",
      sub: "+8 שפיות",
      quiet: true,
      action: () => { restoreSanity(8); showToast("+8 שפיות — חמימות בכפות הידיים."); completeTask("selfcare"); endActionPhase(); }
    },
    {
      id: "book",
      img: "assets/ActionBook.png",
      label: "📖 לקרוא",
      sub: "+5 שפיות",
      quiet: true,
      action: () => { restoreSanity(5); showToast("+5 שפיות — נזכרת מי את."); completeTask("selfcare"); endActionPhase(); }
    },
    {
      id: "pump",
      img: "assets/ActionPump.png",
      label: "🍼 שאיבה",
      sub: "לוגיסטיקה, שקט",
      quiet: true,
      action: () => { restoreSanity(2); showToast("שאיבה הסתיימה."); completeTask("pump"); endActionPhase(); }
    },
    {
      id: "laundry",
      img: "assets/ActionLaundry.png",
      label: "🧺 כביסה",
      sub: "לוגיסטיקה, רועש!",
      quiet: false,
      action: () => { increaseBabyMeter(20); showToast("מחזור הכביסה. כמובן שדווקא עכשיו."); completeTask("laundry"); endActionPhase(); }
    },
  ];

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
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      background: white;
      border: 2px solid ${a.quiet ? "var(--sage)" : "var(--rose)"};
      border-radius: 16px;
      padding: 0.6rem 0.8rem;
      cursor: pointer;
      width: 80px;
      transition: transform 0.15s, box-shadow 0.15s;
      direction: rtl;
    `;
    card.innerHTML = `
      <img src="${a.img}" style="width:48px;height:48px;object-fit:contain;" alt="${a.label}"/>
      <span style="font-size:0.75rem;font-weight:700;color:var(--charcoal);text-align:center;">${a.label}</span>
      <span style="font-size:0.65rem;color:var(--muted);text-align:center;">${a.sub}</span>
    `;
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
    grid.appendChild(card);
  });

  choiceButtons.appendChild(grid);
}

// ── סימון משימה כבוצעה ───────────────────────────────────────────────────────
function completeTask(taskId) {
  if (gameState.tasksCompleted[taskId]) return;
  gameState.tasksCompleted[taskId] = true;

  const el = document.getElementById("task-" + taskId);
  if (el) {
    el.classList.add("done");
    el.querySelector(".task-check").textContent = "✓";
  }

  const allDone = Object.values(gameState.tasksCompleted).every(v => v);
  if (allDone) {
    showToast("כל משימות היום הושלמו! 🌟");
    setTimeout(triggerEnding, 1500);
  }
}

// ── סיום שלב פעולה ────────────────────────────────────────────────────────────
function endActionPhase() {
  gameState.sleepCycle++;
  updateHUD();

  narrate("התינוקת מתעוררת... 👶");
  setTimeout(() => {
    drainSanity(2);
    beginLullaby();
  }, 1500);
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
        gameState.lullabyPhase = false;
        gameState.stealthActive = false;
        renderBaby("sleeping");
        renderRoom();
        const babyEl = document.getElementById("room-baby");
        if (babyEl) babyEl.style.pointerEvents = "none";
        if (babyEl) babyEl.style.cursor = "default";
        if (babyEl) babyEl.classList.remove("lullaby");
        document.getElementById("lullaby-hint")?.classList.add("hidden");
        setTimeout(beginActionPhase, 800);
      }
    } else if (speed > 1.5) {
      increaseBabyMeter(speed * 1.5 * (gameState.babyMeterSlowdown || 1.0));
    }
  } else {
    if (speed > 1.5) {
      increaseBabyMeter(speed * 1.8 * s);
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
      } else {
        openContactChat(contact);
      }
    });
  });

  startOpeningScene();
}

window.addEventListener("DOMContentLoaded", init);