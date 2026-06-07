// Synthesized "dread engine" — no audio files. The drone deepens and grows
// dissonant as drawdown widens, a heartbeat quickens with fear, stings hit on
// shock days, and the mix ducks to near-silence right before a crash so the
// next bar lands like a slam. All driven from the replay loop.
export function createAudio() {
  let ctx = null
  let master = null
  let drone = null
  let muted = false
  let intensity = 0 // 0..1, drawdown-driven
  let beatTimer = null
  let disposed = false

  const VOL = 0.85

  function ensure() {
    if (ctx || disposed) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : VOL
    master.connect(ctx.destination)

    const g = ctx.createGain()
    g.gain.value = 0
    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.value = 55
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = 55.4
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    o1.connect(g)
    o2.connect(g)
    g.connect(lp)
    lp.connect(master)
    o1.start()
    o2.start()
    drone = { o1, o2, gain: g }
    scheduleBeat()
  }

  function resume() {
    ensure()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  function setMuted(m) {
    muted = m
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.05)
  }

  // dd: 0..1 drawdown, vol: recent mean |return|
  function update(dd) {
    intensity = Math.max(0, Math.min(1, dd / 0.5)) // full intensity near -50%
    if (!drone || !ctx) return
    const t = ctx.currentTime
    drone.gain.gain.setTargetAtTime(intensity * 0.5, t, 0.3)
    drone.o2.frequency.setTargetAtTime(55.4 + intensity * 6.5, t, 0.3) // more beating = unease
  }

  function thump(freq, gainv, dur) {
    if (!ctx || muted) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gainv, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  function scheduleBeat() {
    if (disposed) return
    const bpm = 50 + intensity * 80 // 50..130
    if (intensity > 0.12) {
      thump(58, 0.45 + intensity * 0.4, 0.16)
      setTimeout(() => thump(50, 0.3 + intensity * 0.3, 0.14), 150)
    }
    beatTimer = setTimeout(scheduleBeat, 60000 / bpm)
  }

  // dissonant shock hit on a brutal down day
  function sting() {
    if (!ctx || muted) return
    const t = ctx.currentTime
    ;[150, 159, 201].forEach((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1100
      o.connect(g)
      g.connect(lp)
      lp.connect(master)
      o.start(t)
      o.stop(t + 0.55)
    })
  }

  // drop to near-silence, then swell back — the calm before the slam
  function duck(ms) {
    if (!ctx || !master) return
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(muted ? 0 : 0.04, t, 0.04)
    master.gain.setTargetAtTime(muted ? 0 : VOL, t + ms / 1000, 0.15)
  }

  function dispose() {
    disposed = true
    if (beatTimer) clearTimeout(beatTimer)
    try {
      if (ctx) ctx.close()
    } catch (e) {
      /* ignore */
    }
    ctx = null
    drone = null
  }

  return { resume, setMuted, update, sting, duck, dispose }
}
