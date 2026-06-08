// Synthesized "dread engine" — Silent Hill flavored. A sub-bass drone with a
// gritty sawtooth edge, an industrial noise bed that grows like grinding
// machinery, a quickening heartbeat, shock stings, a duck-to-silence beat
// before a crash, swelling radio static as dread approaches, and an air-raid
// siren when you cross into the Otherworld. No audio files — all synthesized.
export function createAudio() {
  let ctx = null
  let master = null
  let drone = null
  let noiseBed = null
  let noiseBuf = null
  let muted = false
  let intensity = 0 // 0..1, drawdown-driven
  let beatTimer = null
  let disposed = false

  const VOL = 0.85

  function makeNoise() {
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  function ensure() {
    if (ctx || disposed) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : VOL
    master.connect(ctx.destination)
    noiseBuf = makeNoise()

    // sub-bass drone — sine for weight + sawtooth for grit
    const g = ctx.createGain()
    g.gain.value = 0
    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.value = 46
    const o2 = ctx.createOscillator()
    o2.type = 'sawtooth'
    o2.frequency.value = 46.4
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 170
    o1.connect(g)
    o2.connect(g)
    g.connect(lp)
    lp.connect(master)
    o1.start()
    o2.start()
    drone = { o1, o2, gain: g }

    // industrial noise bed — machine grind / radio hiss, grows with dread
    const ns = ctx.createBufferSource()
    ns.buffer = noiseBuf
    ns.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 700
    nf.Q.value = 0.7
    const ng = ctx.createGain()
    ng.gain.value = 0
    ns.connect(nf)
    nf.connect(ng)
    ng.connect(master)
    ns.start()
    noiseBed = { src: ns, filter: nf, gain: ng }

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

  function update(dd) {
    intensity = Math.max(0, Math.min(1, dd / 0.5)) // full near -50%
    if (!ctx) return
    const t = ctx.currentTime
    drone.gain.gain.setTargetAtTime(intensity * 0.5, t, 0.3)
    drone.o2.frequency.setTargetAtTime(46.4 + intensity * 5, t, 0.3)
    noiseBed.gain.gain.setTargetAtTime(intensity * 0.06, t, 0.4)
    noiseBed.filter.frequency.setTargetAtTime(500 + intensity * 1500, t, 0.4)
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
    const bpm = 50 + intensity * 80
    if (intensity > 0.12) {
      thump(58, 0.45 + intensity * 0.4, 0.16)
      setTimeout(() => thump(50, 0.3 + intensity * 0.3, 0.14), 150)
    }
    beatTimer = setTimeout(scheduleBeat, 60000 / bpm)
  }

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

  function duck(ms) {
    if (!ctx || !master) return
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(muted ? 0 : 0.04, t, 0.04)
    master.gain.setTargetAtTime(muted ? 0 : VOL, t + ms / 1000, 0.15)
  }

  // swelling band of static — the radio crackling as danger nears
  function radioStatic(ms) {
    if (!ctx || muted) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1700
    bp.Q.value = 0.5
    const g = ctx.createGain()
    const end = ms / 1000
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.13, t + end * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t + end + 0.15)
    src.connect(bp)
    bp.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + end + 0.2)
  }

  // air-raid siren — crossing into the Otherworld
  function siren() {
    if (!ctx || muted) return
    const t = ctx.currentTime
    const dur = 3.2
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    g.connect(lp)
    lp.connect(master)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.17, t + 0.4)
    g.gain.setValueAtTime(0.17, t + dur - 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    ;[0, 4].forEach((det) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      const pts = [300, 680, 320, 660, 300]
      o.frequency.setValueAtTime(pts[0] + det, t)
      o.frequency.linearRampToValueAtTime(pts[1] + det, t + 0.9)
      o.frequency.linearRampToValueAtTime(pts[2] + det, t + 1.8)
      o.frequency.linearRampToValueAtTime(pts[3] + det, t + 2.6)
      o.frequency.linearRampToValueAtTime(pts[4] + det, t + dur)
      o.connect(g)
      o.start(t)
      o.stop(t + dur + 0.1)
    })
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
    noiseBed = null
  }

  return { resume, setMuted, update, sting, duck, radioStatic, siren, dispose }
}
