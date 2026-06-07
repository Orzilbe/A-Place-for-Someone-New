# מקום למישהי חדשה — A Place for Someone New

A narrative browser game in Hebrew about preparing for a new baby alone while your partner is away on reserve duty (*miluim*). The player manages a budget, secures baby gear, and navigates relationships through a simulated phone interface.

---

## Gameplay

**Act 1 — השבועות האחרונים (The Last Weeks)**

The game opens with a choice: follow a family superstition and keep the baby's room empty until the birth, or set up the room now. This decision shapes the act.

The player then works through a shopping list of five items:

| Item | New price | Used price |
|---|---|---|
| עריסה (crib) | ₪1,200 | ₪600 |
| שידה (dresser) | ₪800 | ₪500 |
| עגלה (stroller) | ₪1,500 | ₪700 |
| כיסא בטיחות (car seat) | ₪900 | ₪400 |
| בגדי תינוקת (baby clothes) | ₪300 | ₪80 |

Starting budget: ₪4,000. Each item can be bought new, negotiated second-hand, or found for free through the WhatsApp group.

**Sanity** is a secondary resource — drained by hard choices and social friction, restored by Oriel's calls and supportive friends.

**Act 2 — הלילה הראשון (The First Night)**

A sleep-management act with minigames (pumping, laundry, coffee, reading) and a stealth mechanic for not waking the baby.

---

## Phone System

A simulated smartphone UI is the main interaction layer.

- **Oriel (husband)** — WhatsApp chat and occasional phone calls. Powered by an AI via the Groq API (Llama 3.3 70B). Offers a one-time coupon for the most expensive unsecured item; the coupon gives 20% off the new price and must be explicitly claimed by the player.
- **Mom / Dad** — AI-powered family chats.
- **Friends** (Maya, Shira, Noa, Dana) — AI-powered, each with a distinct personality affecting sanity.
- **WhatsApp group** (קהילת משוערות ינואר 2026) — A scripted group chat with a time-sensitive free-clothes giveaway and a second-hand stroller lead.
- **Ronit** — Second-hand dresser negotiation (AI, JSON-structured responses, price range ₪350–₪500).
- **Hadar** — Second-hand stroller negotiation (AI, JSON-structured responses, price range ₪550–₪700).

---

## Architecture

```
index.html      — shell, HUD, phone overlay, room canvas
style.css       — all styling (RTL, WhatsApp-style bubbles, room rendering)
game.js         — all game logic, state, UI rendering, AI chat wiring
room.js         — room/item rendering
groq.js         — client-side API call wrapper + all NPC system prompts
api/groq.js     — serverless proxy function (Vercel) — forwards requests to Groq
```

The backend is a single serverless function that proxies the Groq API so the key stays server-side.

---

## Setup

1. Clone the repo
2. Get a Groq API key at https://console.groq.com/keys
3. Create `.env`:
   ```
   GROQ_API_KEY=your_key_here
   ```
4. Deploy to Vercel (the `api/` directory is picked up automatically) or run locally with the Vercel CLI:
   ```
   npx vercel dev
   ```

---

## NPC Prompts

All system prompts live in `groq.js`. Characters:

- **RONIT_PROMPT** — dresser seller, price-negotiation rules, JSON output schema
- **HADAR_PROMPT** — stroller seller, same structure
- **ORIEL_WHATSAPP_PROMPT** — husband at base; looks for deals online to feel useful; asks for Doritos exactly once
- **MOM_WHATSAPP_PROMPT** — loving but opinionated mother
- **DAD_CALL_PROMPT** — short, warm, minimal
- **MAYA / SHIRA / NOA / DANA** — four friends, varying sanity impact

All AI characters address the player in feminine Hebrew (*לשון נקבה*).
