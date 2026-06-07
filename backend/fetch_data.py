"""Dev script: fetch real ^GSPC daily OHLC (2007-06..2009-12) from Yahoo's
public chart API into a scenario JSON. Stdlib only — no third-party deps.

The 2008 Global Financial Crisis arc: peak ~Oct 2007 (1565) -> trough
~Mar 2009 (676), about -57%. This is the authentic substrate the
"Time Machine" replays bar-by-bar (dates hidden until the reveal).
"""
import json
import os
import sys
import datetime as dt
import urllib.request
import urllib.parse
import urllib.error

SYMBOL = "^GSPC"
P1 = 1180656000  # 2007-06-01 UTC
P2 = 1262217600  # 2009-12-31 UTC
ENC = urllib.parse.quote(SYMBOL)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}
HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]


def fetch(host):
    url = (
        f"https://{host}/v8/finance/chart/{ENC}"
        f"?period1={P1}&period2={P2}&interval=1d"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def main():
    data = None
    for h in HOSTS:
        try:
            data = fetch(h)
            print("OK via", h)
            break
        except urllib.error.HTTPError as e:
            print("HTTPError", h, e.code, e.reason, file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print("ERR", h, repr(e), file=sys.stderr)

    if not data:
        sys.exit("FAILED to fetch from Yahoo")

    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]["quote"][0]
    bars = []
    for i, t in enumerate(ts):
        o, hi, lo, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, hi, lo, c):
            continue
        d = dt.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")
        bars.append({
            "date": d,
            "o": round(o, 2), "h": round(hi, 2),
            "l": round(lo, 2), "c": round(c, 2),
        })

    here = os.path.dirname(os.path.abspath(__file__))
    outpath = os.path.join(here, "app", "data", "scenarios", "gfc2008_prices.json")
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump({"symbol": SYMBOL, "interval": "1d", "bars": bars}, f)

    print(f"wrote {len(bars)} bars -> {outpath}")
    if bars:
        closes = [b["c"] for b in bars]
        print("first:", bars[0])
        print("last :", bars[-1])
        print("peak close:", max(closes), " trough close:", min(closes))


if __name__ == "__main__":
    main()
