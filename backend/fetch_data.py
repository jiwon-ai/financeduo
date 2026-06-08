"""Dev script: fetch real daily OHLC for each scenario from Yahoo's public
chart API into scenario JSON files. Stdlib only — no third-party deps.

Scenarios:
  - gfc2008  : the 2008 Global Financial Crisis (peak 1565 -> trough 676)
  - covid2020: the COVID crash + V-recovery (the Crossroads decision point)
"""
import json
import os
import sys
import datetime as dt
import urllib.request
import urllib.parse
import urllib.error

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}
HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]

SCENARIOS = [
    {"symbol": "^GSPC", "p1": 1180656000, "p2": 1262217600, "out": "gfc2008_prices.json"},   # 2007-06..2009-12
    {"symbol": "^GSPC", "p1": 1577923200, "p2": 1625011200, "out": "covid2020_prices.json"},  # 2020-01..2021-06
]


def fetch(host, symbol, p1, p2):
    url = (
        f"https://{host}/v8/finance/chart/{urllib.parse.quote(symbol)}"
        f"?period1={p1}&period2={p2}&interval=1d"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def run_one(sc):
    data = None
    for h in HOSTS:
        try:
            data = fetch(h, sc["symbol"], sc["p1"], sc["p2"])
            break
        except Exception as e:  # noqa: BLE001
            print("ERR", h, repr(e), file=sys.stderr)
    if not data:
        sys.exit("FAILED " + sc["out"])

    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]["quote"][0]
    bars = []
    for i, t in enumerate(ts):
        o, hi, lo, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, hi, lo, c):
            continue
        bars.append({
            "date": dt.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"),
            "o": round(o, 2), "h": round(hi, 2),
            "l": round(lo, 2), "c": round(c, 2),
        })

    here = os.path.dirname(os.path.abspath(__file__))
    outpath = os.path.join(here, "app", "data", "scenarios", sc["out"])
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump({"symbol": sc["symbol"], "interval": "1d", "bars": bars}, f)

    closes = [b["c"] for b in bars]
    print(f"{sc['out']}: {len(bars)} bars  {bars[0]['date']}..{bars[-1]['date']}"
          f"  (low {min(closes)} / high {max(closes)})")


if __name__ == "__main__":
    for sc in SCENARIOS:
        run_one(sc)
