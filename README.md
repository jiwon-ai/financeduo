# FinanceDuo — Time Machine

A gamified investing simulator. **No real money, ever.**

The flagship mode — **Time Machine** — drops you, blind, into a real moment in
market history. You aren't told the year or the asset: just the price moving bar
by bar, the real headlines as they broke, and your own money on the line. Buy,
sell, or hold as it unfolds. At the end we reveal where you were — and score you
not on how much you made, but on *how you handled it*: drawdown survived,
risk-adjusted consistency, and whether you kept your nerve at the bottom instead
of panic-selling.

The first scenario is the **2008 Global Financial Crisis** (S&P 500, real daily
data: peak 1565 -> trough 676, about -57%).

## Why this exists

Almost every "learn to invest" app scores you on raw return — which rewards luck
and quietly teaches gambling. FinanceDuo scores risk-adjusted behavior: the
thing that actually separates skill from luck.

## Stack

- **Backend** — FastAPI. Serves scenarios bar-by-bar and computes the
  risk-adjusted scorecard (`backend/app/scoring.py`).
- **Frontend** — React + Vite + lightweight-charts (TradingView OSS).
- **Data** — real historical OHLC (`backend/fetch_data.py` pulls from Yahoo).

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

## Roadmap

- More scenarios (1987 Black Monday, dot-com 2000, COVID 2020, crypto 2022)
- Strategy builder + backtest — score your own rules through the crises
- Curriculum spine — daily lessons applied directly in the simulator
- Shareable result cards
