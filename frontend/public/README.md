# Local media placeholders — The Abyss slice

Drop these files **here** (`frontend/public/`) to feel the slice with footage, music,
and the reveal art. All are **gitignored** and load with a graceful fallback (if absent,
you still get the dark room, the synth audio, and an inline SVG blood drip).

- **`world.mp4`** — a dark, atmospheric background clip (e.g. empty 2020 lockdown
  streets, shuttered shops, an empty trading floor). It plays behind the chart and
  **blurs/dims with the tunnel vision** as your drawdown deepens.
- **`music.mp3`** — an ambient/dread music bed. When present, the synthesized dread
  engine automatically **ducks to a reactive accent layer** (heartbeat, stings, siren)
  so the music carries the mood.
- **`blood-drip.png`** (or `blood-drip.svg`) — the **blood overlay** for the reveal of a
  *wrong* choice (sell / leverage). Use a **transparent** PNG/SVG of red drips hanging
  from the top edge (transparent background — a white background will paint a white block
  over the dark screen). It pours down from the top on the reveal. Pre-crop it to a thin
  red band + the drips so the tips stay clean; if absent, an inline SVG drip is used.
  The code prefers `blood-drip.png`, then `blood-drip.svg`, then the inline fallback.

> `blood-test.html` (also here, gitignored) is a dev preview: open
> `http://localhost:5173/blood-test.html` to see just the blood overlay (status text tells
> you which asset it loaded; "↓ pour" plays the animation).

## ⚠️ Copyright — read this
Silent Hill OST, Klaus Schulze, real news broadcasts, stock drip art, etc. are
**copyrighted / stock-licensed**. Using them here is acceptable **only** as a private,
local, never-distributed dev placeholder to feel the vibe while building. For anything
public — this repo, an itch.io / Steam demo, the released game — you **must** use:

- **royalty-free / Creative Commons** footage and music, or
- **original** art/music you create, commission, or generate with **commercial rights**
  (e.g. Adobe Firefly for images — it ships with indemnification; check each AI tool's
  terms — see the art pipeline notes in the root `README.md`).

(That's the plan: placeholder now → original / licensed assets before shipping.)

## Royalty-free sources
- **Footage** (empty cities / lockdown b-roll): Pexels, Pixabay, Mixkit, Coverr.
- **Music / ambience**: Pixabay Music, Free Music Archive (check each license), or a commissioned score.
- **AI** (with commercial rights): Adobe Firefly (safest for shipping), Midjourney/Flux (stills), Kling/Veo (motion).
