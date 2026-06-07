"""Scenario loading. Assembles real price bars + curated headlines + the
end-of-run reveal into one payload the frontend replays bar-by-bar."""
import json
import os
import functools

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "scenarios")


@functools.lru_cache(maxsize=None)
def _load(name):
    with open(os.path.join(DATA_DIR, name), "r", encoding="utf-8") as f:
        return json.load(f)


def list_scenarios():
    meta = _load("gfc2008_meta.json")
    return [{"id": meta["id"], "blindTitle": meta["blindTitle"]}]


def get_scenario(scenario_id):
    if scenario_id != "gfc2008":
        return None
    meta = _load("gfc2008_meta.json")
    prices = _load("gfc2008_prices.json")
    headlines = _load("gfc2008_headlines.json")["headlines"]
    return {
        "id": meta["id"],
        "blindTitle": meta["blindTitle"],
        "revealTitle": meta["revealTitle"],
        "startingCash": meta["startingCash"],
        "bars": prices["bars"],
        "headlines": headlines,
        "reveal": meta["reveal"],
    }
