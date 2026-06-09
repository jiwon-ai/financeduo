# FinanceDuo — and DRAWDOWN

> A playable web prototype **and** the design bible for **DRAWDOWN**, a psychological
> trading-horror game. **No real money, ever.** Built on real historical market data.
> Designed & built by **Jiwon**.

This repo is two things at once:

1. **A playable web app** (`/frontend` + `/backend`) — modes that drop you into real
   market crises and score you on *how you handle fear*, not how much you make.
2. **The proof-of-concept + "feel" reference** for **DRAWDOWN**, a Silent-Hill-inspired
   first-person trading-horror game in Unreal Engine 5 (see [`GAME_DESIGN.md`](GAME_DESIGN.md)).

---

## The three modes

### 🕰 Time Machine
Dropped **blind** into a real moment in market history — no year, no asset, just the
price moving bar by bar, the real headlines as they broke, and your money on the line.
Buy / sell / hold as it unfolds. At the end we reveal where you were and score you
risk-adjusted: drawdown survived, composure, whether you held your nerve at the bottom.
First scenario: the **2008 GFC** (S&P 500, peak ~1565 → trough ~676, about −57%).

### 🔀 Crossroads
**One real moment, one decision.** Soak in the crowd's mood (real news + a recreated
community feed), set your orders (market, or pre-set buy/sell limits), then history
shows you **every road you didn't take** — your path vs hold vs the crowd vs hindsight.
Process over outcome: a good call with a bad break is honored; reckless luck is not.

### 🩸 The Abyss — the horror slice
**~65 seconds. COVID, March 2020, free-falling.** You wake already deep underwater; the
feed screams in credible expert voices; the world blurs around the only thing still
sharp — the crashing chart. You decide on **March 16, 2020 — the worst single day since
1987 (−12%, circuit-breaker day)**. Then the chart **plays forward to the recovery** and
the counterfactual reveals every road from that moment:

| Choice | Outcome (15 months later) |
|---|---|
| **Hold** | $10,000 → **$12,675 (+27%)** — the dawn |
| **Sell** | locked **$7,047 (−30%)**, watched the rebound from the shore |
| **Leverage 3×** | **$0 — LIQUIDATED** before the recovery you'd have owned |

Built into the slice: a wake cold-open · expert/community feed + **news as TV-broadcast
cut-ins** · tunnel-vision dread (the world dims, the chart stays sharp) · a forward
**aftermath replay** to the recovery · the **counterfactual reveal** · live English chart
dates · wrong choices **bleed**, holding earns the sunrise.

---

## Why this exists

Almost every "learn to invest" app scores you on raw return — which rewards luck and
quietly teaches gambling. FinanceDuo scores **risk-adjusted behavior**: the thing that
actually separates skill from luck. The reveal always shows the *counterfactual* and
separates decision quality from outcome.

## The bigger vision — DRAWDOWN

This web app is the cheap, playable **teaser + design bible** for a full game where
**your drawdown is the Otherworld**: a trader alone in a dim room, the world rotting
around them as the account bleeds, surviving only by composure under fear. See:

- [`GAME_DESIGN.md`](GAME_DESIGN.md) — the DRAWDOWN game-design document (vision).
- [`SLICE_SPEC.md`](SLICE_SPEC.md) — "The Abyss" vertical-slice spec.
- [`BUILD_VERTICAL_SLICE.md`](BUILD_VERTICAL_SLICE.md) — how to build the slice in Unreal Engine 5.

---

## Stack

- **Backend** — FastAPI. Serves scenarios bar-by-bar + the risk-adjusted scorecard
  (`backend/app/scoring.py`); assembles The Abyss timeline (`backend/app/scenarios.py`).
- **Frontend** — React + Vite + lightweight-charts (TradingView OSS); a synthesized
  Web Audio dread engine (`frontend/src/audio.js`).
- **Data** — real historical OHLC in `backend/app/data/scenarios/` (`backend/fetch_data.py`
  pulls from Yahoo). Prices and news quotes are real; community/expert voices are
  recreated fictional personas.

## Run it

**Backend**
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

> Note: the committed `vite.config.js` proxies `/api` to port **8000**. If you run the
> backend on another port (e.g. 8001), change the proxy locally — don't commit it.

## Art & media

- **Footage / music / art are local, gitignored placeholders** — drop your own in
  `frontend/public/` (see [`frontend/public/README.md`](frontend/public/README.md)).
  Currently supported: `world.mp4` (atmospheric background), `music.mp3` (ambient bed),
  `blood-drip.png` (the reveal drip overlay).
- **Art pipeline:** AI 2D now → 3D later. Stills/key art via Midjourney/Flux/Firefly,
  motion via Kling/Veo (image-to-video from a chosen still); composite the game's real
  UI onto generated screens (screen replacement). Move to Unreal 3D assets for the game.

## Principles (read before shipping)

- **English only.**
- **No copyrighted assets ship.** Silent Hill OST, real news clips, etc. = local dev
  placeholders only. Ship royalty-free or original (or AI you have commercial rights to).
- **Community/expert feed = recreated fictional personas**, never real people.
- **News items = real quotes; prices = real historical data.** Authenticity is the fear.

---

*Designed & built by **Jiwon**. The playable web app is the ground truth for "the feel" —
DRAWDOWN exists to make that minute unbearable in 3D.*
