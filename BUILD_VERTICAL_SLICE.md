# DRAWDOWN — Vertical Slice Build Plan (Unreal Engine 5)

> The smallest build that proves the feel: **one dark room, a trading terminal, and the room descending into the Otherworld as you bleed.** No monster, no combat, one scenario. If that single minute is frightening, the game works.
> Written for someone coming from **Python / web** — Unreal concepts are mapped to what you already know.

---

## 0. Mindset before you start

- **Do ONE editor tutorial first.** Before this plan, spend ~2 hours on the official *"Your First Hour in Unreal Engine 5"* (Epic Dev Community) or any "UE5 first-person horror starter" on YouTube. You need editor muscle memory (navigate viewport, place actors, open Blueprints). Don't skip this.
- **Blueprints first, C++ later.** You can build this entire slice with **zero C++**. C++ comes later (I'll write the `MarketSim` class for you when you want it).
- **Greybox + darkness.** Don't model art. Grey boxes + free assets + fog + dark = the Silent Hill look hides a zero art budget. Prove the feel, not the polish.

## 1. Install & create the project

1. Install **Epic Games Launcher** → **Unreal Engine 5** (latest stable, 5.4+). Big download (~30–50 GB); needs a decent GPU.
2. New project → **Games → First Person → Blueprint**. (This template hands you a working first-person player + movement + look + Enhanced Input. You'll delete the gun.) Name it `Drawdown`. Enable "Starter Content".
3. First run: hit Play, walk around. That's your player, for free.

## 2. Unreal for a Python/web dev (concept map)

| Unreal | You already know this as… |
|---|---|
| **Actor** | an object / a DOM element placed in the world |
| **Component** | a child part of an actor (mesh, light, audio, collision) |
| **Level** | the scene / the page |
| **Blueprint** | visual scripting — your JS logic, as nodes |
| **Event Graph: `BeginPlay` / `Tick`** | `onMount` / `requestAnimationFrame` (every frame) |
| **Pawn / Character / PlayerController** | the player setup |
| **UMG (Widgets)** | HTML/CSS for in-game UI (your terminal screen) |
| **Material** | a shader — CSS for surfaces, but node-based |
| **Post Process Volume** | a full-screen filter (your web `crash-vignette` + desaturation) |
| **Exponential Height Fog** | volumetric fog actor (atmosphere) |
| **DataTable** | a table/CSV you load (your scenario data) |
| **MetaSound** | procedural audio graph (your Web Audio synth, but stronger) |

## 3. Build steps

### Step 1 — The room (the mood)
- Greybox a small room: floor, 4 walls, ceiling, a desk + chair (Starter Content has props, or grab a free apartment/office from **Fab** — the Unreal asset store; lots of free assets, plus free Quixel Megascans inside UE).
- **Make it dark.** Delete or dim the template's Directional Light + Sky Light. Add **one desk lamp** (Point or Spot Light, warm, low intensity) + the monitor's glow. This is Tier 0 "calm".
- Add an **Exponential Height Fog** actor, low density (subtle haze).
- Add a **Post Process Volume**, set **Infinite Extent (Unbound) = true**. This is your global screen-effects controller — you'll drive it from the DreadDirector. Leave it neutral for now.

### Step 2 — Player: flashlight + interact
- Open `BP_FirstPersonCharacter`. **Delete the gun** logic + mesh (you're not shooting).
- **Flashlight:** add a **Spot Light** component under the camera. Add an Enhanced Input Action `IA_Flashlight` (bind to F in the Input Mapping Context) → in the graph, toggle the spot light's visibility.
- **Interact:** add Input Action `IA_Interact` (E). On press, do a **line trace** forward from the camera; if it hits the terminal (tag it `Interactable`), call the terminal's `Interact` event. (Search "UE5 interaction line trace" — it's a 10-minute standard pattern.)

### Step 3 — The terminal (the core)
- Put a **monitor mesh** on the desk. Add a **Widget Component** to it (this renders a UMG widget onto a 3D surface in the world).
- Create a **UMG Widget** `WBP_Terminal`: show **current price** (big), **equity / cash / position / drawdown**, a simple **price line** (a basic line/area — full candlesticks are a later upgrade; the horror is the room, not chart fidelity), and **Buy / Sell / Hold** buttons.
- Wire the buttons to the MarketSim (Step 4). For the slice, interacting with the terminal can just enable a **Widget Interaction Component** on the player (points a "cursor" at the 3D widget so buttons are clickable).

### Step 4 — Data → a simple MarketSim (Blueprint)
- Export **one scenario** from the existing Python pipeline (`backend/fetch_data.py`) to **CSV** (Date, Open, High, Low, Close). Use COVID or 2008.
- In Unreal: make a **Blueprint Struct** `S_Bar` (Date string + 4 floats) → **import the CSV as a DataTable** `DT_Scenario`. (No code — the import wizard does it.)
- `BP_MarketSim` actor:
  - vars: `Index`, `Cash`, `Shares`, `Peak`, current `Equity`, `Drawdown`.
  - a **Timer** (every ~0.2–0.5s) → advance `Index` → read the next `DT_Scenario` row → update equity (`Cash + Shares × Close`), update `Peak`, compute `Drawdown = (Peak − Equity) / Peak` → push values to `WBP_Terminal` → notify `DreadDirector`.
  - `Buy` / `Sell` from the terminal move Cash↔Shares at the current price.
- (This is the Blueprint version. The robust **C++ `MarketSim`** with limit/stop orders + risk-adjusted scoring is deliverable #2 — say the word and I'll write it to paste in.)

### Step 5 — DreadDirector (the payoff)
`BP_DreadDirector` actor with a `DreadLevel` (0–1) it computes from MarketSim's drawdown, mapped to tiers (8% / 20% / 38% like the web prototype). Every tick, drive the room from `DreadLevel`:
- **Post Process Volume:** raise **Vignette**, **Film Grain**, drop **Color Saturation**, push **Color Grading** toward rust/red (set the PPV's override flags + values from BP, or feed a **post-process Material** via a **Material Parameter Collection** for the rust — cleaner).
- **Fog:** increase **Exponential Height Fog** density with DreadLevel.
- **Lights:** lower the lamp intensity + add **flicker** (a Timeline / random) as it rises.
- **Audio:** a looping **drone** whose volume/pitch climbs with DreadLevel; a **heartbeat** that quickens. (Simple imported loops are fine for the slice; MetaSounds is the later upgrade.)
- **The Otherworld flip:** when `DreadLevel ≥ ~0.55` (Tier 3), fire a one-shot event — swap to a blood-red color grade, max fog, **kill the lamp**, play a **siren**. Reverse it if drawdown recovers (and on a "false bottom", brighten briefly, then slam deeper).

This is the whole slice: **trade → bleed → the room descends.**

### Step 6 — Tune the minute
Play it. Adjust thresholds, timing, audio levels until *sitting at that desk during the crash, with the room rotting around you,* is genuinely unsettling. That tuning **is** the work — don't add anything else until this minute lands.

## 4. Where to get assets (save weeks)
- **Fab** (fab.com, built into UE) — free room/office/apartment kits, props, horror audio. **Quixel Megascans** are free inside Unreal (surfaces, decals — rust, grime, blood).
- Free sound: drones / heartbeats / sirens from Fab or freesound.org (check licenses).

## 5. Milestones & honest pacing (new to UE)
1. **Editor literacy** (1 tutorial) — ½ day.
2. **Dark room + player + flashlight** — a day or two. *Goal: the mood.*
3. **Terminal showing a replaying price** (DataTable + widget) — a few days. *Goal: the trading core.*
4. **DreadDirector** driving post-process / fog / lights / audio from drawdown — a few days. *Goal: the descent.*
5. **The Otherworld flip + tuning** — a few days. *Goal: the minute of fear.*

Realistically **2–4 weeks** for a first slice if you're new to Unreal. That's normal. Each piece (interaction, 3D widget, post-process, fog) is a common pattern with good YouTube tutorials — follow one per piece.

## 6. What I'll deliver next (just ask)
- **`UMarketSim` in C++** — scenario load + market/limit/stop orders + risk-adjusted scoring + drawdown, ready to paste into the project (port of the validated JS/Python logic).
- **DreadDirector spec** — exact post-process / fog / light / MetaSound parameter curves per tier.
- **A post-process "Otherworld" material** breakdown (rust overlay, chromatic aberration, scanlines).
- **JSON→Unreal exporter** — a small Python script to emit the scenario CSV/JSON in the shape the DataTable wants.

---

*Build order in one line: dark room → player + flashlight → terminal replaying a price → DreadDirector descending the room from your drawdown → the Otherworld flip → tune until it's unbearable.*
