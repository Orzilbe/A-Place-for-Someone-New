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
  budget:              4000,
  sanity:              100,
  superstition:        false,
  superstitionFate:    null,   // "good" | "neutral" | "bad" — נקבע בסתר בעת הבחירה
  babyMeterSlowdown:   1.0,    // 0.6 במסלול מזל טוב
  act:                 1,
  items:               [],
  callPending:         false,
  callTimer:           null,
  act2Logistics:       0,
  babyMeter:           0,
  wakeWindows:         0,
  stealthActive:       false,
  negotiating:         false,
  roniConvoHistory:    [],
  itemPositions:       {},
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

const hudBudget      = $("hud-budget");
const hudSanity      = $("hud-sanity");
const hudItems       = $("hud-items");
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

// ── עדכון סרגל הסטטיסטיקות ─────────────────────────────────────────────────
function updateHUD() {
  hudBudget.innerHTML = `תקציב: <strong>${gameState.budget.toLocaleString("he-IL")} ₪</strong>`;
  hudSanity.innerHTML = `שפיות: <strong>${gameState.sanity}%</strong>`;
  const secured = gameState.items.filter(i => i.isSecured).length;
  hudItems.innerHTML  = `פריטים: <strong>${secured} / 5</strong>`;
}

// ── עדכוני תקציב / שפיות ────────────────────────────────────────────────────
function spendBudget(amount) {
  gameState.budget = Math.max(0, gameState.budget - amount);
  updateHUD();
  if (gameState.budget === 0) {
    narrate("נגמר הכסף. החדר ישאר ריק קצת יותר.");
  }
}

function drainSanity(amount) {
  gameState.sanity = Math.max(0, gameState.sanity - amount);
  updateHUD();
  if (gameState.sanity <= 0) triggerBadEnding();
}

function restoreSanity(amount) {
  gameState.sanity = Math.min(100, gameState.sanity + amount);
  updateHUD();
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
function showToast(msg, duration = 2600) {
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
    btn.addEventListener("click", action);
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

  if (item.allowWhatsapp) {
    choices.push({
      label: "קבוצת ווטסאפ — חינם (מצאי את ההודעה של סיגל!)",
      primary: true,
      action: () => openWhatsAppGroup(item)
    });
  }

  choices.push({ label: "← חזרה", action: showMainItemList });

  narrate(`<strong>${item.emoji} ${item.name}</strong><br><em>חדש עולה ${item.costNew.toLocaleString()} ₪. איך תטפלי בזה?</em>`);
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
      label: "כן — אשאיר הכל בחוץ עד שהתינוקת תגיע.",
      action: () => {
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
      label: "לא — אני מסדרת את החדר עכשיו.",
      action: () => {
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
    phoneInputArea.classList.add("hidden");
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
        showToast("השיחה של אוריאל נפלה לתא קולי. −3 שפיות 💙");
      }, 3500);
    } else {
      showCallBanner();
    }
  }, delay);
}

function showCallBanner() {
  gameState.callPending = true;
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

function openPhoneCall() {
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
  phoneInputArea.classList.add("hidden");
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
  phoneAppName.textContent = "👶 קבוצת אמהות";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneInputArea.classList.add("hidden");
  phoneOverlay.classList.remove("hidden");

  const fakeMessages = [
    { sender: "מיכל כ.",       text: "מישהי ניסתה את בית המרקחת החדש ברחוב הרצל? ליד תחנת האוטובוס?", time: "09:12" },
    { sender: "נועה ט.",        text: "תזכורת: אסיפת בניין יום חמישי 20:00 בנושא החניות 🚗", time: "09:15" },
    { sender: "יעל ר.",         text: "מישהי מכירה יועצת הנקה טובה באזור? שלי פרשה 😭", time: "09:18" },
    { sender: "מנהלת 📌",       text: "תזכורת: אין פרסומות בקבוצה. למודעות יש את קבוצת האחות.", time: "09:19" },
    { sender: "רונית ל.",       text: "הבת שלי מוכרת עגלה ישנה, כמעט חדשה, שלחי הודעה 👇", time: "09:22", ronitL: true },
    { sender: "סיגל (4ב) 🌸",  text: "מתנה בחינם 🎁 בגדי תינוקת 0-3 חודשים, בקושי בשימוש, הכל כבוס. הראשונה שמגיבה מקבלת! כתבי למטה!", time: "09:25", giveaway: true },
    { sender: "מיכל כ.",       text: "וואו סיגל כמה שזה נחמד ממך!", time: "09:26" },
    { sender: "דינה מ.",        text: "מישהי ראתה חתול אפור מפוספס ליד בניין 7? הוא ברח אתמול בלילה 🐱", time: "09:28" },
    { sender: "נועה ט.",        text: "בנוגע לחתול — בדקתי בחניון, הוא לא שם", time: "09:29" },
    { sender: "רבקה ח.",        text: "בוקר טוב לכולן! יום יפה ☀️", time: "09:31" },
  ];

  let revealIndex = 0;
  let giveawayClickable = false;
  let giveawayEl = null;
  let scrollInterval;
  let missTimer;

  function addBubble(msg) {
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
        clearInterval(scrollInterval);
        clearTimeout(missTimer);
        closePhone();
        openRonitLNegotiation();
      });
    }
    if (msg.giveaway) {
      giveawayEl = div;
      giveawayClickable = true;
      div.addEventListener("click", () => {
        if (!giveawayClickable) return;
        clearInterval(scrollInterval);
        clearTimeout(missTimer);
        closePhone();
        narrate(`<strong>לחצת על ההודעה של סיגל בזמן!</strong> רגע אחר כך: "סבבה! בואי מתי שנוח לך." הבגדים שלך — חינם. 🎁`);
        secureItem(item, 0);
        setTimeout(showMainItemList, 1600);
      });
    }
    phoneContent.appendChild(div);
    phoneContent.scrollTop = phoneContent.scrollHeight;
    return div;
  }

  let revealDelay = 600;
  function tick() {
    revealNext();
    revealDelay = Math.max(200, revealDelay - 30);
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
        showItemMenu(item);
      };
      phoneContent.appendChild(closeNote);
      phoneContent.scrollTop = phoneContent.scrollHeight;
    }
  }, 7000);

  phoneCloseBtn.onclick = () => {
    clearInterval(scrollInterval);
    clearTimeout(missTimer);
    closePhone();
    showItemMenu(item);
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
        parsed = { text: raw, agreedPrice: null, leaveOutside: false, dealClosed: false };
      }

      gameState.roniConvoHistory.push({ role: "model", text: parsed.text });
      addChatBubble("רונית", parsed.text, "ronit");

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


// ── משא ומתן AI עם רונית ל. (עגלה) ──────────────────────────────────────────
function openRonitLNegotiation() {
  // מוצא את פריט העגלה
  const item = gameState.items.find(i => i.id === "stroller");
  if (!item || item.isSecured) {
    narrate("העגלה כבר טופלה.");
    return;
  }

  gameState.negotiating = true;
  const history = [];

  phoneAppName.textContent = "🛒 רונית ל. (עגלה)";
  $("phone-status-bar").style.background = "#25d366";
  phoneContent.innerHTML = "";
  phoneInputArea.classList.remove("hidden");
  phoneOverlay.classList.remove("hidden");

  addChatBubble("רונית ל.", "היי! ראיתי שפנית בנוגע לעגלה. 700 שקל, מצב מצוין, הבת שלי השתמשה בה בקושי. מעניין אותך?", "ronit");

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
        .map(m => `${m.role === "user" ? "משחקנית" : "רונית ל."}: ${m.text}`)
        .join("\n");
      const contextualMessage = fullHistory
        ? `שיחה קודמת:\n${fullHistory}\n\nהודעה אחרונה מהמשחקנית: ${msg}`
        : msg;

      history.push({ role: "user", text: msg });

      const raw = await callGemini(contextualMessage, RONIT_L_PROMPT);
      typingEl.remove();

      let parsed;
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { text: raw, agreedPrice: null, dealClosed: false };
      }

      history.push({ role: "model", text: parsed.text });
      addChatBubble("רונית ל.", parsed.text, "ronit");

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
  phoneOverlay.classList.add("hidden");
  phoneContent.innerHTML = "";
  phoneInputArea.classList.add("hidden");
  phoneSendBtn.onclick = null;
  phoneTextInput.onkeydown = null;
  phoneCloseBtn.onclick = null;
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
  hudAct.textContent = "מחזה ב׳ — השגרה";

  if (gameState.superstition) {
    applySuperstitionFate();
    spawnBoxes();
    setTimeout(beginStealthMode, 1200);
  } else {
    gameState.items.forEach(i => { i.inHouse = true; });
    renderRoom();
    narrate(`
      את בבית. חדר התינוקת מוכן. העריסה מורכבת, השידה מלאה.<br><br>
      התינוקת ישנה. הכל מושלם. הכל מפחיד.<br><br>
      <em>יש לך רגע לעצמך. מה את עושה?</em>
    `);
    setTimeout(showSelfCareMenu, 800);
    beginStealthMode();
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
    narrate("כל הקופסאות רוקנו. החדר נראה כמו חדר תינוקת. הגב כואב. התינוקת מתעוררת.");
    showSelfCareMenu();
  }
}

// ── תפריט טיפול עצמי / לוגיסטיקה — מחזה ב׳ ─────────────────────────────────
function showSelfCareMenu() {
  narrate("התינוקת ישנה. <strong>מד הערות</strong> עולה עם כל רעש. בחרי בחוכמה.");

  setChoices([
    {
      label: "📖 קראי עמוד (+5 שפיות, שקט)",
      action: () => {
        restoreSanity(5);
        gameState.wakeWindows++;
        showToast("+5 שפיות — נזכרת מי את.");
        showSelfCareMenu();
      }
    },
    {
      label: "☕ הכיני קפה (+8 שפיות, שקט)",
      action: () => {
        restoreSanity(8);
        gameState.wakeWindows++;
        showToast("+8 שפיות — חמימות בכפות הידיים.");
        showSelfCareMenu();
      }
    },
    {
      label: "🍼 שאבי חלב (לוגיסטיקה +1, שקט)",
      action: () => {
        gameState.act2Logistics++;
        gameState.wakeWindows++;
        showToast("שאיבה הסתיימה. לוגיסטיקה: " + gameState.act2Logistics);
        if (gameState.act2Logistics >= 3) checkAct2Complete();
        else showSelfCareMenu();
      }
    },
    {
      label: "🧺 כבסי (לוגיסטיקה +1, רועש!)",
      action: () => {
        gameState.act2Logistics++;
        gameState.wakeWindows++;
        increaseBabyMeter(20);
        showToast("מחזור הכביסה. כמובן שדווקא עכשיו. לוגיסטיקה: " + gameState.act2Logistics);
        if (gameState.act2Logistics >= 3) checkAct2Complete();
        else showSelfCareMenu();
      }
    }
  ]);
}

function checkAct2Complete() {
  if (gameState.act2Logistics >= 3) {
    setChoices([]);

    // הערה בסיום שמשקפת את הגורל — רק במסלול האמונות
    let fateNote = "";
    if (gameState.superstition) {
      const notes = {
        good:    `<br><br><em style="color:#8aab84">התינוקת ישנה טוב היום. אולי אמא שלך ידעה.</em>`,
        neutral: `<br><br><em style="color:#8a7070">קשה לדעת אם זה עזר. אבל שמרת על הקשר.</em>`,
        bad:     `<br><br><em style="color:#c98a8e">יום קשה. אולי זה לא קשור. אולי כן.</em>`,
      };
      fateNote = notes[gameState.superstitionFate] || "";
    }

    narrate(`שרדת את היום הראשון. הלוגיסטיקה מטופלת. התינוקת עדיין ישנה.<br><br><em>עשית את זה. יום אחד כל פעם.</em>${fateNote}`);
    setTimeout(triggerEnding, 2000);
  }
}

// ── מכניזם עכבר סמוי — מחזה ב׳ ─────────────────────────────────────────────
let lastX = 0, lastY = 0, lastTime = 0;

function beginStealthMode() {
  gameState.stealthActive = true;
  babyMeterCont.style.display = "flex";

  ["sprite-laundry", "sprite-keys", "sprite-dishes"].forEach(id => {
    const el = $(id);
    if (el) { el.style.display = "flex"; el.classList.add("visible"); }
  });

  document.addEventListener("mousemove", stealthMouseHandler);
}

function stealthMouseHandler(e) {
  if (!gameState.stealthActive) return;

  const now = Date.now();
  const dt  = now - lastTime;
  if (dt < 16) return;

  const dist  = Math.hypot(e.clientX - lastX, e.clientY - lastY);
  const speed = dist / dt;
  const s     = gameState.babyMeterSlowdown; // 0.6 במזל טוב, 1.0 אחרת

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
  gameState.stealthActive = false;
  $("room-view").style.pointerEvents = "none";
  drainSanity(15);
  narrate(`<strong>😭 התינוקת התעוררה.</strong><br>הבכי ממלא את החדר. עצמת עיניים לשתי שניות בדיוק, ואז הלכת אליה. −15 שפיות.`);
  setChoices([
    {
      label: "הרגיעי אותה והמשיכי",
      primary: true,
      action: () => {
        gameState.babyMeter = 0;
        babyMeterFill.style.width = "0%";
        $("room-view").style.pointerEvents = "";
        gameState.stealthActive = true;
        showSelfCareMenu();
      }
    }
  ]);
}

// ── סיומות ───────────────────────────────────────────────────────────────────
function triggerEnding() {
  document.removeEventListener("mousemove", stealthMouseHandler);
  gameState.stealthActive = false;
  babyMeterCont.style.display = "none";

  actFade.classList.add("active");
  actFadeText.innerHTML = `
    את אמא עכשיו.<br><br>
    <span style="font-size:1.1rem;">תקציב שנשאר: ${gameState.budget.toLocaleString()} ₪ &ensp;·&ensp; שפיות: ${gameState.sanity}%</span><br><br>
    <span style="font-size:0.9rem;font-style:italic;">מקום למישהי חדשה — ולך.</span>
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
  startOpeningScene();
}

window.addEventListener("DOMContentLoaded", init);