"""Risk-adjusted scorecard. This is the product's philosophical core: the
player is judged NOT on raw return but on HOW they earned it — drawdown
survived, risk-adjusted consistency, and whether they kept their nerve at
the bottom instead of panic-selling. This is what separates skill from
gambling, and what every competitor scores wrong (raw return = luck)."""
import math

TRADING_DAYS = 252


def _max_drawdown(equity):
    peak = float("-inf")
    mdd = 0.0
    for v in equity:
        if v > peak:
            peak = v
        if peak > 0:
            dd = (peak - v) / peak
            if dd > mdd:
                mdd = dd
    return mdd


def _daily_returns(equity):
    out = []
    for i in range(1, len(equity)):
        prev = equity[i - 1]
        if prev:
            out.append(equity[i] / prev - 1.0)
    return out


def _mean(x):
    return sum(x) / len(x) if x else 0.0


def _std(x):
    if len(x) < 2:
        return 0.0
    m = _mean(x)
    return math.sqrt(sum((v - m) ** 2 for v in x) / (len(x) - 1))


def compute_scorecard(equity, exposure, bars, starting_cash):
    if not equity or len(equity) < 2:
        return {"error": "not enough data to score"}

    n = len(equity)
    final_equity = equity[-1]
    total_ret = final_equity / starting_cash - 1.0

    rets = _daily_returns(equity)
    mu, sd = _mean(rets), _std(rets)
    sharpe = (mu / sd * math.sqrt(TRADING_DAYS)) if sd > 0 else 0.0
    mdd = _max_drawdown(equity)
    ann_ret = (final_equity / starting_cash) ** (TRADING_DAYS / max(n - 1, 1)) - 1.0
    calmar = (ann_ret / mdd) if mdd > 1e-9 else 0.0

    # Buy & hold benchmark from the real close prices.
    closes = [b["c"] for b in bars][:n]
    bh_ret = (closes[-1] / closes[0] - 1.0) if len(closes) >= 2 else 0.0
    trough_i = min(range(len(closes)), key=lambda i: closes[i]) if closes else 0

    # Did they capitulate at the bottom, or buy the dip?
    capitulated = False
    bought_dip = False
    if exposure and len(exposure) >= n and n > 6:
        w = 3
        before = exposure[: max(1, trough_i - w)]
        near = exposure[max(0, trough_i - w): min(n, trough_i + w + 1)]
        after = exposure[trough_i: min(n, trough_i + 10)]
        avg_before = _mean([abs(e) for e in before]) if before else 0.0
        avg_near = _mean(near) if near else 0.0
        avg_after = _mean(after) if after else 0.0
        if avg_before > 0.3 and avg_near < 0.1:
            capitulated = True
        if avg_after > 0.5 and avg_before < 0.5:
            bought_dip = True

    # Risk score (0..100): driven by risk-adjusted return, penalize deep
    # drawdowns and capitulation, reward buying fear.
    risk = 50.0 + 18.0 * sharpe - 45.0 * max(0.0, mdd - 0.20)
    if capitulated:
        risk -= 22.0
    if bought_dip:
        risk += 12.0
    risk = max(0.0, min(100.0, risk))

    grade = (
        "A" if risk >= 85 else
        "B" if risk >= 70 else
        "C" if risk >= 55 else
        "D" if risk >= 40 else "F"
    )

    lessons = []
    if capitulated:
        lessons.append(
            "You cut exposure right at the bottom — the classic panic-sell that "
            "turns a paper loss into a permanent one."
        )
    if bought_dip:
        lessons.append(
            "You added near the lows. Buying when others capitulate is where real "
            "returns are made — and it's terrifying in the moment."
        )
    if total_ret > bh_ret and mdd < 0.40:
        lessons.append(
            "You beat buy-and-hold with less pain. That's risk-adjusted skill, not luck."
        )
    if mdd >= 0.45:
        lessons.append(
            "Your drawdown topped 45%. Surviving a crash is about position size, "
            "not predicting the bottom."
        )
    if not lessons:
        lessons.append(
            "Returns matter less than HOW you earned them. Consistent survival — "
            "not the biggest number — is the real edge."
        )

    if grade in ("A", "B"):
        verdict = "Composed. You navigated a historic crash with genuine risk discipline."
    elif grade == "C":
        verdict = "You survived — but the ride was rougher than it needed to be."
    else:
        verdict = "The crash traded you. This is exactly what markets do to untrained nerves."

    return {
        "finalEquity": round(final_equity, 2),
        "returnPct": round(total_ret * 100, 1),
        "buyHoldReturnPct": round(bh_ret * 100, 1),
        "maxDrawdownPct": round(mdd * 100, 1),
        "sharpe": round(sharpe, 2),
        "calmar": round(calmar, 2),
        "capitulated": capitulated,
        "boughtDip": bought_dip,
        "riskScore": round(risk),
        "grade": grade,
        "verdict": verdict,
        "lessons": lessons,
    }
