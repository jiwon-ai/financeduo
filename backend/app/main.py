"""Time Machine API — serves blind historical scenarios and scores a run
on risk-adjusted, anti-gambling metrics."""
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import scenarios, scoring

app = FastAPI(title="Time Machine API")

# Dev CORS: Vite dev server on :5173. Wide-open is fine for local MVP.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/scenarios")
def get_scenarios():
    return scenarios.list_scenarios()


@app.get("/api/scenarios/{scenario_id}")
def get_one(scenario_id: str):
    s = scenarios.get_scenario(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="scenario not found")
    return s


@app.get("/api/crossroads/{scenario_id}")
def get_crossroads(scenario_id: str):
    s = scenarios.get_crossroads(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="crossroads not found")
    return s


@app.get("/api/slice/{slice_id}")
def get_slice(slice_id: str):
    s = scenarios.get_slice(slice_id)
    if not s:
        raise HTTPException(status_code=404, detail="slice not found")
    return s


class ScoreReq(BaseModel):
    equity: list[float]
    exposure: Optional[list[float]] = None


@app.post("/api/scenarios/{scenario_id}/score")
def score(scenario_id: str, req: ScoreReq):
    s = scenarios.get_scenario(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="scenario not found")
    return scoring.compute_scorecard(req.equity, req.exposure, s["bars"], s["startingCash"])
