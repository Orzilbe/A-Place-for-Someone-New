// ═══════════════════════════════════════════════════════════════════════════
//  מקום למישהי חדשה — game.js
// ═══════════════════════════════════════════════════════════════════════════

// ── מחלקת פריט ─────────────────────────────────────────────────────────────
class GameItem {
  constructor(id, name, emoji, costNew, costUsed, allowWhatsapp = false) {
    this.id            = id;
    this.name          = name;
    this.emoji         = emoji;
    this.costNew       = costNew;
    this.costUsed      = costUsed;
    this.allowWhatsapp = allowWhatsapp;
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
  new GameItem("crib",     "עריסה",        "🛏️",  1200, 600),
  new GameItem("dresser",  "שידה",          "🗄️",   800, 500),
  new GameItem("stroller", "עגלה",          "🛒",  1500, 700),
  new GameItem("carseat",  "כיסא בטיחות",  "💺",   900, 400),
  new GameItem("clothes",  "בגדי תינוקת",  "👕",   300,  80, true),
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
  if (budgetVal) budgetVal.textContent = gameState.budget.toLocaleString("he-IL") + " ₪";

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
  if (gameState.budget === 0) {
    narrate("נגמר הכסף. החדר ישאר ריק קצת יותר.");
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

// ── החלת גורל האמונות בתחילת מחזה ב׳ ────────────────────────────────────────
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
  narrationText.style.opacity = "0";
  narrationText.style.transition = "opacity 0.4s ease";
  setTimeout(() => {
    narrationText.innerHTML = text;
    narrationText.style.opacity = "1";
  }, 350);
}

function setChoices(choices) {
  choiceButtons.innerHTML = "";
  choices.forEach(({ label, action, primary }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (primary) btn.classList.add("primary");
    btn.addEventListener("click", () => {
      choiceButtons.querySelectorAll("button").forEach(b => {
        b.disabled = true;
        b.style.opacity = "0.5";
        b.style.cursor = "not-allowed";
      });
      action();
    });
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
    showToast(`${item.name} מאובטח — ממתין בחוץ בקופסה. 📦`);
  }
  if (cost > 0) spendBudget(cost);
  updateHUD();
  checkAllSecured();
}

// ── תפריט קנייה לפריט בודד ──────────────────────────────────────────────────
function showItemMenu(item) {
  if (item.isSecured) {
    narrate(`<em>${item.name}</em> כבר טופל. ✓`);
    showMainItemList();
    return;
  }

  const choices = [
    {
      label: `קנייה חדשה — ${item.costNew.toLocaleString()} ₪`,
      action: () => {
        if (gameState.budget < item.costNew) {
          showToast("אין מספיק תקציב לזה. 😬");
          return;
        }
        narrate(`הזמנת <em>${item.name}</em> חדש לגמרי. טרי. יקר. שווה את זה.`);
        secureItem(item, item.costNew);
        setTimeout(showMainItemList, 1200);
      }
    },
    {
      label: `יד שנייה — מ-${item.costUsed.toLocaleString()} ₪`,
      action: () => {
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

// ── רשימת פריטים ראשית ──────────────────────────────────────────────────────
function showMainItemList() {
  const remaining = gameState.items.filter(i => !i.isSecured);
  if (remaining.length === 0) {
    narrate("הכל מסודר. לקחת נשימה עמוקה.");
    setChoices([]);
    return;
  }

  narrate(`נותרו לך <strong>${gameState.budget.toLocaleString()} ₪</strong> ועוד ${remaining.length} פריט${remaining.length > 1 ? "ים" : ""} להשיג. על מה עובדים?`);
  setChoices(remaining.map(item => ({
    label: `${item.emoji} ${item.name}`,
    primary: true,
    action: () => showItemMenu(item)
  })));
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

// ── מחזה א׳ ─────────────────────────────────────────────────────────────────
function beginAct1() {
  gameState.act = 1;
  hudAct.textContent = "מחזה א׳ — הקינון";
  renderBaby("hidden");
  setTimeout(() => {
    addPhoneNotification("group", 2);
  }, 25000);

  if (gameState.superstition) {
    narrate(`פתחת את רשימת הקניות. חמישה פריטים. הציוד יחכה בחוץ עד הלידה — אבל הכסף עדיין צריך לזוז.`);
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
    if (gameState.act !== 1 || gameState.negotiating) return;

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
      "\"הכל יהיה בסדר. תסמכי עלי - ותסמכי על עצמך.\""
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];

    phoneContent.innerHTML = `
      <div class="wa-bubble incoming" style="font-style:italic;margin-top:auto;">${line}</div>
      <div class="wa-bubble incoming" style="font-size:0.78rem;color:#888;">הקו חמים. היא ממתינה.</div>
    `;
    phoneOverlay.classList.remove("hidden");

    phoneCloseBtn.onclick = () => {
      closePhone();
      restoreSanity(10); // יותר מאוריאל — אמא ממש שם
      showToast("לשמוע את אמא עזר יותר ממה שציפית. +10 שפיות 💛");
      $("phone-status-bar").classList.remove("call-mode");
      $("phone-status-bar").style.background = "";
    };
  }, delay);
}

// ── מכניזם שיחת הבעל ────────────────────────────────────────────────────────
function scheduleHusbandCall() {
  if (gameState.act !== 1) return;
  const delay = 15000 + Math.random() * 30000;
  gameState.callTimer = setTimeout(() => {
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
      showCallBanner();
    }
  }, delay);
}

function showCallBanner() {
  gameState.callPending = true;

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
    "\"כמה שהייתי רוצה להיות שם. תגידי לי מה את צריכה.\"",
    "\"החברים כאן שולחים דרישת שלום. כולנו חושבים עלייך.\"",
    "\"אחזור הביתה בקרוב. תשמרי לי מאלה הביסקוויטים שאת אוהבת.\""
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

  let revealDelay = 1200;
  function tick() {
    revealNext();
    revealDelay = Math.max(600, revealDelay - 50);
    if (revealIndex < fakeMessages.length) scrollInterval = setTimeout(tick, revealDelay);
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
  }, 7000);

  phoneCloseBtn.onclick = () => 
    _groupActive = false;
    clearTimeout(scrollInterval);
    clearTimeout(missTimer);
    closePhone();
  };
}

// ── משא ומתן AI עם רונית (שידה) ──────────────────────────────────────────
function openRonitNegotiation(item) {
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
        const cleaned = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
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
        const cleaned = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
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
          narrate(`הסכימו ל-<strong>${reduced.toLocaleString()} ₪</strong>. לא רע.`);
          secureItem(item, reduced);
        } else {
          drainSanity(5);
          showToast("הן לא הסכימו. −5 שפיות");
          narrate(`הן עומדות על ${finalPrice.toLocaleString()} ₪. השתיקה המביכה עולה לך משהו.`);
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
  phoneOverlay.classList.add("hidden");
  phoneContent.innerHTML = "";
  phoneInputArea.classList.add("hidden");
  phoneSendBtn.onclick = null;
  phoneTextInput.onkeydown = null;
  phoneCloseBtn.onclick = null;
  document.getElementById("phone-home").classList.add("hidden");
  const chatBack = document.getElementById("chat-back-btn");
  if (chatBack) chatBack.classList.add("hidden");
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

// ── מחזה ב׳ ─────────────────────────────────────────────────────────────────
function beginAct2() {
  gameState.act = 2;
  gameState.sleepCycle = 0;
  gameState.lullabyPhase = false;
  hudAct.textContent = "מחזה ב׳ — השגרה";
  updateHUD();

  if (gameState.superstition) {
    applySuperstitionFate();
    spawnBoxes();
  } else {
    gameState.items.forEach(i => { i.inHouse = true; });
    renderRoom();
    renderBaby("sleeping");
    narrate(`את בבית. חדר התינוקת מוכן.<br><br>התינוקת ישנה רגע — אבל היא עומדת להתעורר.<br><em>מתחיל היום הראשון.</em>`);
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
  showToast(`${item.name} פוּרַק! 📦 ➡️ ${item.emoji}`);
  increaseBabyMeter(8);
  narrate(`פרקת את <strong>${item.name}</strong>. ${document.querySelectorAll("[id^='box-']").length} קופסאות נותרו.`);

  if (document.querySelectorAll("[id^='box-']").length === 0) {
    narrate("כל הקופסאות רוקנו. החדר נראה כמו חדר תינוקת. הגב כואב.");
    setTimeout(beginLullaby, 1200);
  }
}

// ── שלב הרדמה — מחזה ב׳ ─────────────────────────────────────────────────────
function beginLullaby() {
  gameState.lullabyPhase = true;
  gameState.stealthActive = true;
  gameState.babyMeter = 80;
  babyMeterFill.style.width = "80%";
  babyMeterFill.classList.add("danger");
  setChoices([]);
  renderBaby("sleeping");
  const babyEl = document.getElementById("room-baby");
  if (babyEl) babyEl.style.cursor = "pointer";
  if (babyEl) babyEl.style.pointerEvents = "auto";
  narrate("😴 התינוקת ערה ועצבנית. הזיזי את העכבר <strong>לאט מאוד</strong> עד שתירדם...");
  beginStealthMode();
}

// ── שלב פעולה — מחזה ב׳ ──────────────────────────────────────────────────────
function beginActionPhase() {
  gameState.lullabyPhase = false;
  gameState.stealthActive = true;
  gameState.babyCried = false;
  gameState.babyMeter = 0;
  babyMeterFill.classList.remove("danger");
  babyMeterFill.style.width = "0%";

  const cycleNum = gameState.sleepCycle + 1;
  narrate(`התינוקת נרדמה 😴  חלון ${cycleNum} מתוך ${gameState.totalCycles} — בחרי פעולה אחת:`);

  setChoices([
    {
      label: "🍼 שאבי חלב — הכנה לאחר כך (רועש!)",
      action: () => {
        increaseBabyMeter(25);
        restoreSanity(3);
        showToast("שאיבה הסתיימה. הכנת לאחר כך.");
        if (!gameState.babyCried) endActionPhase();
      }
    },
    {
      label: "🧺 כבסי — לוגיסטיקה (רועש!)",
      action: () => {
        increaseBabyMeter(20);
        restoreSanity(2);
        showToast("מחזור הכביסה רץ.");
        if (!gameState.babyCried) endActionPhase();
      }
    },
    {
      label: "☕ הכיני קפה — רגע לעצמך (שקט)",
      action: () => {
        restoreSanity(8);
        showToast("+8 שפיות — חמימות בכפות הידיים.");
        endActionPhase();
      }
    },
    {
      label: "📖 קראי עמוד — רגע לעצמך (שקט)",
      action: () => {
        restoreSanity(5);
        showToast("+5 שפיות — נזכרת מי את.");
        endActionPhase();
      }
    },
    {
      label: "📞 התקשרי לאוריאל",
      action: () => {
        openPhoneCall();
        const origClose = phoneCloseBtn.onclick;
        phoneCloseBtn.onclick = () => {
          if (origClose) origClose();
          endActionPhase();
        };
      }
    }
  ]);
}

// ── סיום שלב פעולה ────────────────────────────────────────────────────────────
function endActionPhase() {
  gameState.sleepCycle++;
  updateHUD();

  if (gameState.sleepCycle >= gameState.totalCycles) {
    triggerEnding();
  } else {
    narrate("התינוקת מתעוררת... 👶");
    setTimeout(() => {
      drainSanity(2);
      beginLullaby();
    }, 1500);
  }
}

// ── מכניזם עכבר סמוי — מחזה ב׳ ─────────────────────────────────────────────
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
  if (!gameState.stealthListenerAdded) {
    gameState.stealthListenerAdded = true;
    document.addEventListener("mousemove", stealthMouseHandler);
  }
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
      if (gameState.babyMeter <= 30) babyMeterFill.classList.remove("danger");
      if (gameState.babyMeter === 0) {
        gameState.lullabyPhase = false;
        gameState.stealthActive = false;
        renderBaby("sleeping");
        const babyEl = document.getElementById("room-baby");
        if (babyEl) babyEl.style.pointerEvents = "none";
        if (babyEl) babyEl.style.cursor = "default";
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

function increaseBabyMeter(amount) {
  gameState.babyMeter = Math.min(100, gameState.babyMeter + amount);
  babyMeterFill.style.width = gameState.babyMeter + "%";

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
  renderBaby("crying");
  gameState.babyCried = true;
  gameState.stealthActive = false;
  gameState.lullabyPhase = false;
  $("room-view").style.pointerEvents = "none";
  drainSanity(15);
  narrate(`<strong>😭 התינוקת התעוררה.</strong><br>הבכי ממלא את החדר. עצמת עיניים לשתי שניות בדיוק, ואז הלכת אליה. −15 שפיות.`);
  setChoices([
    {
      label: "הרגיעי אותה והמשיכי",
      primary: true,
      action: () => {
        renderBaby("sleeping");
        gameState.babyMeter = 0;
        babyMeterFill.style.width = "0%";
        $("room-view").style.pointerEvents = "";
        beginLullaby();
      }
    }
  ]);
}

// ── סיומות ───────────────────────────────────────────────────────────────────
function triggerEnding() {
  document.removeEventListener("mousemove", stealthMouseHandler);
  gameState.stealthActive = false;
  babyMeterCont.style.display = "none";

  const sanityLine = gameState.sanity >= 70
    ? "את עייפה. אבל את בסדר. ממש בסדר."
    : gameState.sanity >= 40
      ? "שרדת. יום אחד כל פעם."
      : "זה היה קשה. זה מותר להיות קשה.";

  actFade.classList.add("active");
  actFadeText.innerHTML = `
    שרדת את היום הראשון.<br><br>
    <span style="font-size:1.1rem;">${sanityLine}</span><br><br>
    <span style="font-size:0.9rem;font-style:italic;">תקציב שנשאר: ${gameState.budget.toLocaleString()} ₪ &ensp;·&ensp; שפיות: ${gameState.sanity}%</span>
  `;

  setTimeout(() => {
    setChoices([{
      label: "שחקי שוב",
      primary: true,
      action: () => location.reload()
    }]);
    actFade.style.pointerEvents = "none";
    actFade.classList.remove("active");
  }, 5000);
}

function triggerBadEnding() {
  document.removeEventListener("mousemove", stealthMouseHandler);
  gameState.stealthActive = false;
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
        openWhatsAppGroup(null);
      } else if (contact === "dad") {
        openDadCall();
      } else {
        openContactChat(contact);
      }
    });
  });

  startOpeningScene();
}

window.addEventListener("DOMContentLoaded", init);