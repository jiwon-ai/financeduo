# DRAWDOWN — Game Design Document

> *Working title. A psychological trading-horror game in the vein of Silent Hill.*
> Engine: **Unreal Engine 5**. Status: design / pre-vertical-slice.
> The playable web prototype in this repo (`/frontend`, `/backend`) is the proof-of-concept and the "feel" reference for everything below.

---

## 1. High concept

**Your drawdown is the Otherworld.**

You are a trader, alone, at night, in a single dim room. You trade real market history at a desk. As your portfolio bleeds, the room rots around you — lights die, fog seeps in, the walls rust and bleed — until a deep enough loss tips the world fully into a rusted hellscape where *Ruin* hunts you. You cannot fight it. You survive only by keeping your nerve and managing your risk: pull the loss back, and the world recedes. Panic, over-leverage, or capitulate at the bottom, and you are consumed.

The discipline that keeps real traders alive — composure under drawdown — *is* the survival mechanic.

**Genre:** first-person psychological survival horror + trading sim.
**Inspirations:** Silent Hill 2 (psychological/internal horror, Otherworld, Akira Yamaoka's sound), *The Big Short* (the dread of being right too early / the crowd losing its mind), real financial crises.
**Platform:** PC first (Steam / itch), controller-friendly.

---

## 2. Design pillars

1. **The market is the monster.** No invented creatures-of-the-week. The horror is financial ruin — your own greed, panic, and liquidation, made manifest.
2. **Dread, not jump-scares.** Slow, anticipatory, sound-led (Yamaoka school). The radio crackles before the crash. Silence before the slam.
3. **Discipline = survival.** Risk management isn't a menu; it's how you stay alive. The game rewards composure, punishes panic — honestly (a good decision can still hurt; see §9).
4. **Real history is the level.** Every episode is a real crisis (2008, COVID, …), with the real prices, headlines, and the crowd's real mood. Authenticity is the fear.

---

## 3. Premise & setting

A cramped apartment / home-office at night. A desk, a chair, a wall of monitors, a window to a city that grows wrong. Claustrophobic, lit only by screen-glow and a failing desk lamp. Silent Hill's power was confinement and fog — lean into it (also a gift for a small team: darkness and fog hide a modest art budget).

The player is unnamed. Minimal exposition. The story is told environmentally and through the market itself: notes, the radio, intrusive thoughts, and the slow ruin of the room as the account dies.

---

## 4. Core loop

```
ARRIVE at the desk for an "episode" (a real crisis)
   ↓
SOAK in the mood — radio/news + the crowd's voices set the tone (calm... or panic)
   ↓
TRADE the unfolding market — buy / sell / hold / set buy & sell prices (limit/stop)
   ↓
THE ROOM REACTS to your drawdown — the deeper you bleed, the further the Otherworld descends
   ↓
SURVIVE the crisis (reach the end of the scenario) without being wiped out
   ↓
REVEAL — where/when you were, your path vs "do nothing", and how you handled the fear
```

Moment-to-moment: you sit, you watch the tape, you feel the room. You act (or don't). The environment is a live readout of your psychology.

---

## 5. The trading system (the game you actually play)

Ported from the web prototype — the logic already exists and is validated.

- **Replay:** real historical OHLC plays forward bar by bar on the in-world terminal. Date/symbol hidden ("blind") until the reveal.
- **Orders:** market Buy / Sell, plus **set a buy-limit and a sell price** (take-profit above / stop below) that render as lines on the chart and **fill automatically** when price crosses them. Pre-setting your exits *before* the fear hits is the core discipline.
- **The journey:** a crisis has several **decision beats**. At each you act, then **Hold** (ride) or **Watch** (stay alert) to the next beat. Position carries across beats.
- **Scoring is risk-adjusted, not raw return.** Survival + composure (drawdown endured, not panic-selling the bottom) drive the ending — never just "how much did you make." A good decision with a bad outcome is honored; reckless luck is not.

(Reference implementations: `backend/app/scoring.py`, `frontend/src/Crossroads.jsx`, scenario JSON in `backend/app/data/scenarios/`.)

---

## 6. The horror system — the Otherworld descent

A single director reads your **drawdown** and drives everything. Same tiers as the web prototype, now *environmental* in 3D.

| Tier | Drawdown | The room |
|---|---|---|
| **0 · Calm** | < 8% | Normal. Warm screen-glow, quiet hum. |
| **1 · Unease** | 8–20% | Lamp flickers, a low drone enters, fog seeps at the edges, color drains (post-process desaturation), the air goes cold. |
| **2 · Dread** | 20–38% | Rust and decay creep across surfaces, the radio crackles with static, shadows deepen, a heartbeat rises, intrusive whispers ("sell it all", "you're going to lose everything"), something moves out of sight. |
| **3 · Otherworld** | ≥ 38% | The world *peels* — siren wail, blood-rust palette, geometry distorts, walls bleed, lights die. **Ruin becomes active and hunts** (see §8). |

**Recovery runs in reverse:** cut the loss and the world slowly heals — *except* on a false bottom, where it brightens, then plunges deeper. (2008's real torture: the dead-cat bounces.)

**Implementation (Unreal):** one `DreadDirector` actor holds a `DreadLevel` (0–1) and `Tier`, computed from `MarketSim` drawdown, and drives:
- a `PostProcessVolume` (desaturation, vignette, film grain, chromatic aberration, color-grade toward rust/red),
- `ExponentialHeightFog` density/color,
- light intensity/flicker (kill them as dread rises),
- material parameter collections (rust/blood blend on surfaces),
- MetaSound parameters (drone, heartbeat, static, siren),
- Ruin's activation.

This is a near-direct port of the web tier logic (`frontend/src/App.jsx` Otherworld layer) — just driving lighting/post-process/audio instead of CSS.

---

## 7. Sound design (the most important system)

Silent Hill is ~70% audio. Use **MetaSounds** (UE5) — far more capable than the prototype's Web Audio synthesis, which already proves the concept.

- **Industrial drone** that deepens and grows dissonant with drawdown.
- **Heartbeat** that quickens with fear.
- **The radio = the tape/news.** Market headlines crackle through static; the static *swells before a known crash* (we have the data — foreshadow the drop). Dread, not surprise.
- **Silence as a weapon** — cut to dead air right before a slam.
- **Siren** on the tip into the Otherworld.
- Monster audio: wet, metallic, wrong.

---

## 8. The antagonist — *Ruin*

Not a roster of monsters. **One stalking presence: financial ruin / the margin call.** Pyramid-Head logic — you cannot kill it, only endure and flee. It becomes active at Tier 3 and closes in the deeper you sink. Its proximity = how close you are to wipeout.

You push it back by **managing the trade** — reducing drawdown (cutting risk, or holding nerve until the market recovers) literally drives the Otherworld (and Ruin) back. Survival is risk discipline, embodied.

Optional later: manifestations of *specific* mistakes — leverage as a tightening noose, the bottom-tick capitulation as a door that locks behind you.

---

## 9. Win / lose — survival is composure

- **Survive an episode:** reach the end of the real crisis without a wipeout (account-zero or Ruin reaching you).
- **Wipeout:** drawdown hits the death threshold, or you over-leverage into a margin call, or you capitulate at the exact bottom and lock the loss.
- **Endings are tiered by composure**, scored risk-adjusted (not by raw profit). Holding nerve through a −40% drawdown and surviving beats getting lucky on a reckless punt.
- **Honesty rule:** the reveal shows the *counterfactual* (what holding / the crowd / perfect hindsight would have done) and separates **decision quality from luck** — "good call, unlucky" vs "bad call, bailed out by luck." The game teaches process over outcome, or it's just a slot machine with fog.

---

## 10. Structure — episodes

Each real crisis is an episode / level, escalating:

1. **COVID, March 2020** — the fastest crash in history, then a V-recovery. Teaches: don't panic-sell the bottom. (Data + mood feed already built.)
2. **2008 GFC** — the long bleed, the false bottoms, Lehman. Teaches: survive the marathon. (Data + headlines already built.)
3. Later: **1987 Black Monday**, **dot-com 2000** (a *euphoria* horror — the monster is greed, not fear), **a position that went to zero** (the lesson that "just hold" can be fatal — for honesty).

A meta-layer can stitch episodes into one descent (your psyche across crises) for a campaign.

---

## 11. The vertical slice (build this FIRST)

Smallest thing that proves the feel. **No monster, no combat, one scenario.**

- One room (dim apartment/office), first-person, a flashlight, an interactable desk.
- A **terminal** that replays ONE scenario (reuse the COVID or 2008 JSON) — price + your equity, market/limit orders, drawdown computed.
- The **`DreadDirector`** driving post-process + fog + lights + a drone/heartbeat from your live drawdown, with **one scripted Otherworld flip** at the threshold (lights red, siren, fog max).
- Goal: *sit at that desk, watch the market bleed, and feel the room descend around you.* If that one minute is frightening, the game works. If not, fix it before building anything else.

---

## 12. Technical architecture (Unreal)

**Blueprint-first; C++ for the heavy/logic systems.**

| System | Type | Role |
|---|---|---|
| `UMarketSim` | C++ | Load scenario JSON, step bars, hold position, execute market/limit/stop orders, compute equity + drawdown. (Port of the web backtest/order logic.) |
| `ADreadDirector` | C++/BP | Read drawdown → `DreadLevel`/`Tier` → drive PostProcess, fog, lights, MaterialParameterCollection, MetaSound params, Ruin activation. |
| `ATradingTerminal` | BP + UMG | In-world screen (WidgetComponent / render target): chart + order UI. Calls into `MarketSim`. |
| `ARuinStalker` | BP + AI | The antagonist (phase 1+). Behavior tree, activates by tier, can't be killed. |
| `APlayerCharacter` | BP | First-person, flashlight, interact. |
| MetaSounds | Audio | Procedural drone / heartbeat / static / siren, parameterized by `DreadLevel`. |

**Data pipeline (reuse Python):** keep `backend/fetch_data.py` as the data tool — export scenario JSON (prices, headlines, feed, beats) → import to `Content/Data/` → `UMarketSim` parses it (Unreal `FJsonSerializer` or a DataTable). Real history stays the source of truth.

**Chart in-engine:** for the slice, a simple price + equity line is enough (UMG, or draw to a render target). Full candlesticks later.

---

## 13. What carries over from the prototype

- **All of the design** — this document.
- **The data** — real scenario JSON (prices, headlines, mood feed, beats) from the Python pipeline. Reused as-is.
- **The mechanics logic** — order execution, risk-adjusted scoring, drawdown→tier mapping. Simple, validated, documented in the JS/Python source; port to C++/Blueprint.
- **The web app itself** — the playable design bible + a marketing demo / itch.io teaser / pitch piece. Not thrown away.

What gets rebuilt: the *presentation* — DOM/CSS/Web Audio become Unreal lighting, post-process, materials, and MetaSounds.

---

## 14. Roadmap

- **Phase 0 — Vertical slice** (§11): room + terminal + dread environment, one scenario, no monster. Prove the feel.
- **Phase 1 — The horror loop:** Ruin (stalker AI), the full Otherworld flip, win/lose, the reveal.
- **Phase 2 — Content:** more episodes (2008, 1987, dot-com), the radio/news + crowd-mood feed in-world, sound polish.
- **Phase 3 — Production:** art pass, environment detail, full Yamaoka-grade audio, narrative framing, Steam page + demo.

---

## 15. Honest risks & scope

- **Unreal solo is a large undertaking.** Art, sound, level design, and AI are real disciplines. Budget for the learning curve (Blueprints first; C++ where needed). Expect this to be measured in months, not weeks.
- **Keep the slice tiny.** The #1 killer is scope creep. One room, one scenario, the dread environment. Prove the minute of fear before building a game around it.
- **Lean into the aesthetic of limitation.** Darkness + fog + sound do the heavy lifting and hide a modest art budget — Silent Hill made a hardware limit into an icon. Do the same.
- **Different business than the app.** This is a horror *game* (Steam/itch, gamers, one-time purchase, passion-grade niche) — not the mass-market daily app. Most indie games don't sell; make it because the game deserves to exist, and let the web prototype be the cheap teaser that tests appetite first.
- **The real test is fun.** Trading + dread must be *tense*, not tedious. The vertical slice answers this. If the minute at the desk isn't gripping, redesign before scaling.

---

*Reference: the playable prototype (this repo) implements the trading replay, limit/stop orders, the multi-beat journey, risk-adjusted scoring, the atmosphere feed, and the Otherworld dread tiers in the browser. It is the ground truth for "the feel" — build DRAWDOWN to make that minute unbearable in 3D.*
