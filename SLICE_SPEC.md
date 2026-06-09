# DRAWDOWN — Vertical Slice Spec: "The Abyss" (COVID, March 2020)

> The one minute that proves the game. **Seated** at a desk, you watch your ruin crater in real time, make one decision, and — on the worst choice — the world dissolves around the only thing left: the crashing chart. ~60–90 seconds, ending in `LIQUIDATED`.
> Companion to `GAME_DESIGN.md` (the vision) and `BUILD_VERTICAL_SLICE.md` (how to build it in Unreal).

---

## Scope (ruthlessly small)

- **Seated experience.** A near-fixed camera at the desk. **No walking, no flashlight, no room navigation, no interaction system.** You sit, you watch, you choose.
- **One crisis:** COVID, March 2020.
- **One branch built:** the WORST decision → the full horror. (The survive/regret branches are noted but NOT built yet.)
- **Minimal monster:** Ruin is a shadow + a sound from the void at the very end — no AI yet.
- **Goal:** if sitting at that desk for 90 seconds is genuinely frightening, the game is real. Build nothing else until it is.

## The setting (2020 desk)

A home-office at night during lockdown, lit only by screens. Period props (atmosphere + a blind "when am I?" clue):

- slim **dual monitors** (the chart lives here),
- a **smartphone face-up**, buzzing with panic notifications (Twitter/Reddit),
- **AirPods**, a **cold coffee**, an open **laptop**,
- a window to a dark, empty, locked-down city.

(No radio — wrong era. The "radio static" role is played by the **phone**: notifications scream, then glitch as danger nears.)

## The data

Real `^GSPC` daily, the COVID crash (already in the repo: `covid2020_prices.json`).
- You **arrive already deep underwater** — holding since the Feb peak (~3386), now down ~30% (~Mar 11, ~2740).
- The **live window** plays the free-fall: ~Mar 11 → Mar 23 (the bottom, ~2237). Fast red candles.
- The **decision lands on Mar 16, 2020** — the worst single day since 1987 (−12%, circuit-breaker day). Maximum fear, with room left for leverage to liquidate into the Mar 23 bottom.
- After the choice, the chart plays **forward to the recovery** (to 2021-06-29, ~4292) so the consequence is *seen*, not just summarized.

## The minute — beat by beat (build THIS branch)

```
0:00  SIT DOWN. Dim room. Monitors glow. Phone buzzing.
      The chart is already bleeding. You're down ~30%. Drone low (Tier 1).
      Phone posts crawl: "sold everything" · "this is the end" · "zero is coming".

0:15  The market craters further on screen (real candles falling).
      Drawdown deepens → the room starts to WEAKEN (tunnel vision begins):
      edges blur, color drains, the city outside fades, world sound recedes.

0:30  THE DECISION surfaces on the terminal — one weighty beat:
        [ Cut it — sell to cash ]   [ Hold — endure ]   [ Leverage up — buy the dip on margin ]
      (The slice showcases the worst: LEVERAGE UP. The tempting "make it all back".)

0:35  You leverage up (margin, ~3x). Position swells. Now every tick hurts 3x.

0:40  The final leg down plays (toward 2237). Drawdown EXPLODES.
      TUNNEL VISION peaks: the room is nearly gone — props swallowed by dark,
      world silent, only the chart sharp + bright + sickly red, filling your view.
      Heartbeat pounding. The phone glitches: MARGIN CALL.

0:55  The drop breaches maintenance margin. The room is GONE — black void,
      just you and the chart. The chart flares; RUIN stirs in the dark
      (a shadow, a wet metallic sound) / the chart becomes a maw.

1:05  Forced liquidation. Screen bursts red. LIQUIDATED.  → fade to black.
```

## Tunnel-vision dread mapping (the `DreadDirector`)

`DreadLevel` (0→1) from drawdown drives **subtraction**, not addition (cheaper to build, more isolating):

| Drawdown | The world | The chart |
|---|---|---|
| ~30% (start) | slight blur at edges, faint desat, low drone | sharp, normal glow |
| ~45% | room blurs + dims, props lose detail, world ambience fades, heartbeat in | brighter, glow shifts red |
| ~60% | room near-black, world **silent**, only market + heartbeat | the ONLY lit thing, large, blood-red |
| death | room GONE — void | chart = a maw; siren; Ruin from the dark; red burst → LIQUIDATED |

Implementation: Depth-of-Field/blur + post-process desaturation/darkening on the **world**; the chart screen stays an **emissive** material (immune to the dim); kill prop lights with DreadLevel; audio bus ducks the world while keeping chart + heartbeat; at threshold, fade room geometry to black (a closing sphere of darkness) and spawn the Ruin shadow + siren.

## All three branches — now built in the web reference
The web slice (`frontend/src/Slice.jsx`) plays the chart **forward to the recovery** after
*any* choice, then shows the **counterfactual reveal** — every road from that moment:

- **Leverage 3×** → the Otherworld + margin call + **LIQUIDATED ($0)**; the screen bleeds.
- **Hold** → the V-recovery animates, equity climbs to **$12,675 (+27%)** — the dawn.
- **Sell** → cash locked at **$7,047 (−30%)**; the market recovers without you (the regret-horror); the screen bleeds, lighter.

The Unreal slice should port all three: the **forward-aftermath replay** and the
**counterfactual** are the lesson (process over outcome), not just the leverage horror.
News arrives as **TV-broadcast cut-ins** and the feed speaks in recreated expert voices.

## Unreal systems for the slice (minimal)
| System | Type | Role in the slice |
|---|---|---|
| Seated camera | BP / level | Fixed-ish view of the desk. No movement. |
| `BP_MarketSim` | Blueprint | Play the COVID data, hold position, the leverage decision, compute drawdown + the margin-call trigger. |
| `BP_DreadDirector` | Blueprint | drawdown → tunnel-vision params (above). |
| `WBP_Terminal` | UMG | The monitor: a simple crashing price line + the 3-way decision + the MARGIN CALL flash. (Full candlesticks later.) |
| Ruin | BP (minimal) | A shadow + sound from the void at the end. No AI. |
| Phone | BP + widget/audio | Buzzing panic notifications; glitch → MARGIN CALL. |

## Success criterion
One thing: **is the 90 seconds frightening?** Sit a friend down cold. If the room dissolving onto the crashing chart, the margin call, and the liquidation make their stomach drop — the game is proven. If not, tune the timing / sound / tunnel-vision curve *before building anything else.*

---

*Build order: desk scene + props → chart replaying the COVID data on the monitor → the 3-way decision → the leverage→margin-call→liquidation logic → the DreadDirector tunnel-vision → the void + Ruin + LIQUIDATED → tune the 90 seconds until it hurts.*
