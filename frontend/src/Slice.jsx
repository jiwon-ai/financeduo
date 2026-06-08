import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getSlice } from './api'
import { createAudio } from './audio'

const SLICE_ID = 'abyss_covid2020'
const TICK_MS = 100 // clock granularity

const fmtMoney = (x) => '$' + Math.max(0, Math.round(x ?? 0)).toLocaleString('en-US')
const toCandle = (b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

export default function Slice({ onExit, onRetry }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | intro | playing | decision | survive | end
  const [feed, setFeed] = useState([])
  const [scene, setScene] = useState('')
  const [hud, setHud] = useState({ equity: 10000, ddPct: 0 })
  const [dread, setDread] = useState(0)
  const [marginCall, setMarginCall] = useState(false)
  const [liquidated, setLiquidated] = useState(false)
  const [buzz, setBuzz] = useState(0)

  const priceElRef = useRef(null)
  const R = useRef({})
  const clockRef = useRef(null)
  const musicRef = useRef(null)

  useEffect(() => {
    getSlice(SLICE_ID)
      .then((d) => { setData(d); setPhase('intro') })
      .catch((e) => setErr(String(e)))
  }, [])

  // init chart + start the clock once we enter 'playing'
  function begin() {
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing' || !data || R.current.pc) return
    const pc = createChart(priceElRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#8a93a6', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { visible: false, borderVisible: false },
      handleScroll: false, handleScale: false, crosshair: { mode: 0 },
      width: priceElRef.current.clientWidth, height: 340,
    })
    const candle = pc.addCandlestickSeries({ upColor: '#26a17b', downColor: '#e3486b', wickUpColor: '#26a17b', wickDownColor: '#e3486b', borderVisible: false })

    const bars = data.bars
    const entry = data.data.entryPrice
    const arrive = data.arriveIndex
    const audio = createAudio(); audio.resume(); audio.update(0.15)
    // optional external music bed (local placeholder, gitignored). If present, duck the synth.
    if (musicRef.current) {
      musicRef.current.volume = 0.6
      musicRef.current.play().then(() => audio.setMusicMode(true)).catch(() => {})
    }

    // instant context: peak -> arrive (you're already underwater)
    candle.setData(bars.slice(0, arrive + 1).map(toCandle))
    pc.timeScale().fitContent()

    R.current = { pc, candle, audio, bars, entry, arrive, barPtr: arrive, evtPtr: 0, leveraged: false, forcedDread: 0, lastClose: bars[arrive].c }

    const promptAt = data.decision.promptAtSec || 30
    const dur = 60 // reveal window across ~60s
    let t = 0
    clockRef.current = setInterval(() => {
      t += TICK_MS / 1000
      R.current.t = t

      // reveal live bars (arrive -> end) across t in [2, dur]
      const live = bars.length - 1 - arrive
      const target = arrive + Math.floor(clamp((t - 2) / (dur - 2), 0, 1) * live)
      while (R.current.barPtr < target) {
        R.current.barPtr++
        const b = bars[R.current.barPtr]
        R.current.candle.update(toCandle(b))
        R.current.pc.timeScale().fitContent()
        if (b.c < R.current.lastClose && audio) audio.sting()
        R.current.lastClose = b.c
      }

      // current drawdown
      const price = bars[R.current.barPtr].c
      const baseDD = (entry - price) / entry
      const effDD = R.current.leveraged ? Math.min(1, baseDD * 2.4) : baseDD
      const dl = clamp(Math.max(effDD / 0.5, R.current.forcedDread), 0, 1)
      setDread(dl)
      audio && audio.update(dl)
      const eq = R.current.leveraged ? Math.max(0, 10000 * (1 - effDD)) : 10000 * (1 - baseDD)
      setHud({ equity: eq, ddPct: effDD * 100 })

      // timeline events
      const tl = data.timeline
      while (R.current.evtPtr < tl.length && tl[R.current.evtPtr].t <= t) {
        const ev = tl[R.current.evtPtr]
        R.current.evtPtr++
        if (ev.type === 'decision') {
          clearInterval(clockRef.current); clockRef.current = null
          setPhase('decision')
          return
        }
        // worst-branch events only fire if leveraged
        const worst = ev.t >= 35
        if (worst && !R.current.leveraged) continue
        fireEvent(ev)
      }
    }, TICK_MS)
  }, [phase, data])

  function fireEvent(ev) {
    const audio = R.current.audio
    switch (ev.type) {
      case 'news':
      case 'post':
        setFeed((f) => [{ ...ev }, ...f])
        setBuzz((b) => b + 1)
        break
      case 'phone':
        setBuzz((b) => b + 1)
        setScene(ev.text)
        break
      case 'scene':
        setScene(ev.text)
        break
      case 'action_leverage':
        setScene(ev.text)
        audio && audio.sting()
        break
      case 'tunnel':
        R.current.forcedDread = Math.max(R.current.forcedDread, ev.level || 0)
        setScene(ev.text)
        if ((ev.level || 0) >= 0.99 && audio) audio.siren()
        break
      case 'margincall':
        setMarginCall(true)
        setScene(ev.text)
        audio && audio.siren()
        break
      case 'liquidation':
        setScene(ev.text)
        audio && audio.sting()
        break
      case 'end':
        setLiquidated(true)
        if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null }
        setTimeout(() => setPhase('end'), 2200)
        break
      default:
        break
    }
  }

  function choose(id) {
    R.current.chosen = id
    if (id === 'leverage') {
      R.current.leveraged = true
      setScene('You go 3x. "Make it all back."')
      setPhase('playing')
      // resume the clock from where it paused
      resumeClock()
    } else {
      // survive / regret branches not built in this slice
      setPhase('survive')
    }
  }

  function resumeClock() {
    const { bars, entry, arrive } = R.current
    const dur = 60
    const audio = R.current.audio
    clockRef.current = setInterval(() => {
      const t = (R.current.t = (R.current.t || 30) + TICK_MS / 1000)
      const live = bars.length - 1 - arrive
      const target = arrive + Math.floor(clamp((t - 2) / (dur - 2), 0, 1) * live)
      while (R.current.barPtr < target) {
        R.current.barPtr++
        const b = bars[R.current.barPtr]
        R.current.candle.update(toCandle(b))
        R.current.pc.timeScale().fitContent()
        if (b.c < R.current.lastClose && audio) audio.sting()
        R.current.lastClose = b.c
      }
      const price = bars[R.current.barPtr].c
      const baseDD = (entry - price) / entry
      const effDD = Math.min(1, baseDD * 2.4)
      const dl = clamp(Math.max(effDD / 0.5, R.current.forcedDread), 0, 1)
      setDread(dl)
      audio && audio.update(dl)
      setHud({ equity: Math.max(0, 10000 * (1 - effDD)), ddPct: effDD * 100 })

      const tl = data.timeline
      while (R.current.evtPtr < tl.length && tl[R.current.evtPtr].t <= t) {
        const ev = tl[R.current.evtPtr]; R.current.evtPtr++
        fireEvent(ev)
      }
    }, TICK_MS)
  }

  useEffect(() => {
    return () => {
      if (clockRef.current) clearInterval(clockRef.current)
      if (musicRef.current) musicRef.current.pause()
      if (R.current.audio) try { R.current.audio.dispose() } catch (e) { /* noop */ }
      if (R.current.pc) R.current.pc.remove()
    }
  }, [])

  if (err) return <div className="screen"><p className="err">Error: {err}</p><button className="btn" onClick={onExit}>← Menu</button></div>
  if (phase === 'loading' || !data) return <div className="screen"><p className="dim">Loading…</p></div>

  if (phase === 'intro')
    return (
      <div className="screen slice-intro">
        <div className="start-card">
          <div className="kicker">THE ABYSS</div>
          <h1>You bought the top. You held. Now the floor is gone.</h1>
          <p className="lead">Three weeks ago this was your retirement. It's worth less every second you read this. Sit down. Headphones on. Whatever happens — don't look away from the number.</p>
          <button className="btn-primary big" onClick={begin}>Sit at the desk →</button>
          <div className="dim small">~60 seconds · sound on 🎧</div>
        </div>
      </div>
    )

  if (phase === 'end') {
    const rv = data.reveal
    return (
      <div className="screen end">
        <div className="end-card">
          <div className="kicker">THE REVEAL</div>
          <h1>{rv.headline}</h1>
          <div className="reveal-sub">{data.revealTitle}</div>
          <div className="cr-outcome yours" style={{ marginTop: 18 }}>
            <span className="lab">You were liquidated at</span>
            <b style={{ color: '#e3486b' }}>{fmtMoney(hud.equity)}</b>
          </div>
          <ul className="facts-list" style={{ marginTop: 18 }}>
            {rv.facts.map((f, k) => <li key={k}>{f}</li>)}
          </ul>
          <div className="cr-actions">
            <button className="btn-primary" onClick={onRetry}>Again →</button>
            <button className="btn" onClick={onExit}>← Menu</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'survive')
    return (
      <div className="screen end">
        <div className="end-card">
          <div className="kicker">THE REVEAL</div>
          <h1>You stepped back from the abyss.</h1>
          <p className="lead">{data.reveal.headline} {data.reveal.facts[1]}</p>
          <p className="dim small">(The survive / regret branch isn't built in this slice — this version showcases the worst decision.)</p>
          <div className="cr-actions">
            <button className="btn-primary" onClick={onRetry}>See the abyss →</button>
            <button className="btn" onClick={onExit}>← Menu</button>
          </div>
        </div>
      </div>
    )

  // playing / decision
  const blur = dread * 9
  const bright = 1 - dread * 0.85
  const sat = 1 - dread * 0.9
  const voidOp = clamp((dread - 0.55) / 0.45, 0, 1)

  return (
    <div className={'slice-root' + (liquidated ? ' liquidated' : '')}>
      <div className="slice-world" style={{ filter: `blur(${blur}px) brightness(${bright}) saturate(${sat})` }}>
        <video className="slice-bg" src="/world.mp4" autoPlay loop muted playsInline onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <div className="slice-room" />
        <aside className={'slice-phone' + (buzz % 2 ? ' buzz' : '')}>
          <div className="phone-top">📱 <span className="dim">{buzz} notifications</span></div>
          <ul className="phone-feed">
            {feed.map((it, k) => (
              <li key={k} className={'feed-item ' + (it.kind === 'news' ? 'news' : 'post ' + (it.tone || ''))}>
                {it.kind === 'news' ? <><span className="feed-tag">NEWS</span>{it.text}</> : <><div className="feed-handle">@{it.handle}</div>{it.text}</>}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="slice-chart" style={{ transform: `scale(${1 + dread * 0.06})`, boxShadow: `0 0 ${dread * 140}px rgba(227,72,107,${dread * 0.9})` }}>
        <div className="chart-tag">S&amp;P 500 · LIVE</div>
        <div ref={priceElRef} className="chart" />
        <div className="slice-hud">
          <div className={'equity ' + (hud.ddPct > 0 ? 'neg' : '')}>{fmtMoney(hud.equity)}</div>
          <div className="dd neg">-{hud.ddPct.toFixed(0)}%{R.current.leveraged ? ' · 3× MARGIN' : ''}</div>
        </div>
      </div>

      <div className="crash-vignette" style={{ opacity: clamp(dread * 0.9, 0, 0.85) }} />
      <div className="grain" style={{ opacity: clamp(dread * 0.18, 0, 0.18) }} />
      <div className="slice-void" style={{ opacity: voidOp }} />

      {scene && <div className="slice-scene">{scene}</div>}
      {marginCall && !liquidated && <div className="slice-margincall">⚠ MARGIN CALL</div>}
      {liquidated && <div className="slice-liquidated">LIQUIDATED</div>}

      {phase === 'decision' && (
        <div className="slice-decision">
          <div className="sd-q">{data.decision.question}</div>
          <div className="sd-opts">
            {data.decision.options.map((o) => (
              <button key={o.id} className={'cr-choice ' + (o.id === 'leverage' ? 'buy' : o.id === 'cut' ? 'sell' : '')} onClick={() => choose(o.id)}>
                <b>{o.label}</b>
                <span>{o.sub}</span>
              </button>
            ))}
          </div>
          <div className="dim small">The chart is still falling while you decide.</div>
        </div>
      )}

      <button className="btn slice-exit" onClick={onExit}>← Menu</button>
      <audio ref={musicRef} src="/music.mp3" loop preload="auto" />
    </div>
  )
}
