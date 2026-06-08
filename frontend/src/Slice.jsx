import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getSlice } from './api'
import { createAudio } from './audio'

const SLICE_ID = 'abyss_covid2020'
const TICK_MS = 100 // clock granularity

const fmtMoney = (x) => '$' + Math.max(0, Math.round(x ?? 0)).toLocaleString('en-US')
const fmtPct = (x) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x ?? 0)) + '%'
const toCandle = (b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

// A self-contained "news studio" still: anchor + a video wall showing a crashing
// chart. Pure SVG (no external assets, fictional channel) so it ships legally clean.
function NewsStudio() {
  return (
    <svg className="bc-svg" viewBox="0 0 320 118" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="bcStudio" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20304e" /><stop offset="1" stopColor="#070b14" />
        </linearGradient>
        <linearGradient id="bcSuit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c3a59" /><stop offset="1" stopColor="#161f33" />
        </linearGradient>
      </defs>
      <rect width="320" height="118" fill="url(#bcStudio)" />
      <ellipse cx="74" cy="4" rx="124" ry="46" fill="#2c416a" opacity="0.28" />
      {/* news desk */}
      <rect x="0" y="96" width="320" height="22" fill="#0c1322" />
      <rect x="0" y="95" width="320" height="3" fill="#2c3e64" />
      {/* over-the-shoulder crash graphic (upper right) */}
      <rect x="170" y="11" width="140" height="61" rx="6" fill="#0a1322" stroke="#22324f" />
      <text x="180" y="27" fill="#9fb0c8" fontSize="9" fontWeight="700" fontFamily="ui-monospace, monospace">S&amp;P 500</text>
      <text x="180" y="45" fill="#e3486b" fontSize="13" fontWeight="900" fontFamily="ui-monospace, monospace">▼</text>
      <polyline points="180,53 200,58 216,54 232,63 250,59 268,68 286,63 302,71"
        fill="none" stroke="#e3486b" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {/* anchor (left, head clears the lower-third) */}
      <path d="M32,118 L32,100 Q88,68 144,100 L144,118 Z" fill="url(#bcSuit)" />
      <path d="M76,99 L88,118 L100,99 L90,93 L86,93 Z" fill="#d7deec" />
      <path d="M85,99 L91,99 L89,118 L87,118 Z" fill="#bb3b34" />
      <rect x="80" y="63" width="16" height="19" rx="3" fill="#c8a387" />
      <ellipse cx="88" cy="45" rx="18" ry="19" fill="#ddb896" />
      <path d="M69,47 Q69,23 88,23 Q107,23 107,47 Q102,34 88,33 Q74,34 69,47 Z" fill="#241c17" />
    </svg>
  )
}

function Counterfactual({ data, chosen }) {
  const d = data.data
  const start = (data.player && data.player.startingValue) || 10000
  const held = start * d.recoveryPrice / d.entryPrice
  const sold = start * d.decisionPrice / d.entryPrice
  const rows = [
    { id: 'leverage', label: 'You leveraged up', val: 0, tag: 'LIQUIDATED', pos: false },
    { id: 'hold', label: 'Had you just held', val: held, pos: true },
    { id: 'cut', label: 'Had you sold', val: sold, pos: false },
  ]
  const heldPct = (held / start - 1) * 100
  return (
    <div style={{ marginTop: 16 }}>
      <div className="panel-title">EVERY ROAD FROM THAT MOMENT · {d.recoveryLabel}</div>
      <div className="cr-outcomes">
        {rows.map((r) => {
          const yours = r.id === chosen
          const pct = (r.val / start - 1) * 100
          return (
            <div key={r.id} className={'cr-outcome' + (yours ? ' yours' : '')}>
              <span className="dot" style={{ background: r.pos ? '#26a17b' : '#e3486b' }} />
              <span className="lab">{r.label}{yours ? ' · YOU' : ''}</span>
              <b style={{ color: yours ? (r.pos ? '#26a17b' : '#e3486b') : undefined }}>{r.val <= 0 ? '$0' : fmtMoney(r.val)}</b>
              <span className="chg">{r.tag || fmtPct(pct)}</span>
            </div>
          )
        })}
      </div>
      <p className="cr-verdict" style={{ marginTop: 12 }}>
        {chosen === 'leverage'
          ? `Leverage erased you — right before simply holding would have made +${heldPct.toFixed(0)}%.`
          : chosen === 'hold'
            ? 'You held through the terror. It all came back, and then some.'
            : 'You sold into the panic and locked the loss — then watched the entire recovery happen without you.'}
      </p>
    </div>
  )
}

export default function Slice({ onExit, onRetry }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | wake | playing | decision | end
  const [feed, setFeed] = useState([])
  const [scene, setScene] = useState('')
  const [hud, setHud] = useState({ equity: 10000, ddPct: 0 })
  const [dread, setDread] = useState(0)
  const [marginCall, setMarginCall] = useState(false)
  const [liquidated, setLiquidated] = useState(false)
  const [buzz, setBuzz] = useState(0)
  const [branch, setBranch] = useState(null) // 'cut' | 'hold' | 'leverage'
  const [after, setAfter] = useState(null)    // aftermath goal chip { branch, target, label }

  const priceElRef = useRef(null)
  const R = useRef({})
  const clockRef = useRef(null)
  const musicRef = useRef(null)

  useEffect(() => {
    getSlice(SLICE_ID)
      .then((d) => { setData(d); setPhase('wake') })
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

    const decisionIndex = data.decisionIndex != null ? data.decisionIndex : bars.length - 1
    const bottomIndex = data.bottomIndex != null ? data.bottomIndex : bars.length - 1
    const recoveryIndex = data.recoveryIndex != null ? data.recoveryIndex : bars.length - 1
    R.current = { pc, candle, audio, bars, entry, arrive, decisionIndex, bottomIndex, recoveryIndex, barPtr: arrive, evtPtr: 0, leveraged: false, forcedDread: 0, lastClose: bars[arrive].c }

    const promptAt = data.decision.promptAtSec || 30
    let t = 0
    clockRef.current = setInterval(() => {
      t += TICK_MS / 1000
      R.current.t = t

      // free-fall: arrive -> decisionIndex across t in [2, promptAt]
      const span = Math.max(1, R.current.decisionIndex - arrive)
      const target = arrive + Math.floor(clamp((t - 2) / (promptAt - 2), 0, 1) * span)
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
        setFeed((f) => [{ ...ev, _id: (R.current.feedSeq = (R.current.feedSeq || 0) + 1) }, ...f])
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
    setBranch(id)
    setPhase('playing') // hide the decision overlay; the chart keeps playing forward
    if (id === 'leverage') {
      R.current.leveraged = true
      setScene('You go 3x. "Make it all back."')
      R.current.audio && R.current.audio.sting()
      runAbyss()
    } else {
      runRecovery(id)
    }
  }

  // LEVERAGE branch: creep decision -> bottom while the scripted horror events fire.
  function runAbyss() {
    const { bars, entry } = R.current
    const audio = R.current.audio
    const promptAt = data.decision.promptAtSec || 30
    const endT = 63 // liquidation lands ~t63 via the timeline
    clockRef.current = setInterval(() => {
      const t = (R.current.t = (R.current.t || promptAt) + TICK_MS / 1000)
      const span = Math.max(1, R.current.bottomIndex - R.current.decisionIndex)
      const target = R.current.decisionIndex + Math.floor(clamp((t - promptAt) / (endT - promptAt), 0, 1) * span)
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

  // CUT / HOLD branch: play the chart forward through the recovery so you SEE the outcome.
  function runRecovery(br) {
    const { bars, entry, decisionIndex, recoveryIndex, candle } = R.current
    const audio = R.current.audio
    const soldPrice = bars[decisionIndex].c
    const soldEquity = 10000 * soldPrice / entry
    const recPrice = bars[recoveryIndex].c
    const recEquity = 10000 * recPrice / entry
    const startBar = R.current.barPtr
    const totalBars = Math.max(1, recoveryIndex - startBar)
    const durTicks = 95 // ~9.5s of forward play (months compressed)
    let tick = 0

    // mark the moment on the chart
    try {
      R.current.markLine = br === 'cut'
        ? candle.createPriceLine({ price: soldPrice, color: '#e3486b', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'you sold' })
        : candle.createPriceLine({ price: recPrice, color: '#26a17b', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'recovery' })
    } catch (e) { /* price-line API optional */ }

    setMarginCall(false)
    R.current.forcedDread = 0
    setScene(br === 'hold'
      ? 'You touch nothing. You let it ride. Months pass in seconds…'
      : 'You are in cash now. Safe. You watch the rest from the shore…')
    setAfter({
      branch: br,
      target: br === 'hold' ? recEquity : soldEquity,
      label: br === 'hold' ? 'IF YOU HOLD TO RECOVERY' : 'YOUR CASH · LOCKED',
    })

    clockRef.current = setInterval(() => {
      tick++
      const p = clamp(tick / durTicks, 0, 1)
      const target = startBar + Math.floor(p * totalBars)
      while (R.current.barPtr < target) {
        R.current.barPtr++
        R.current.candle.update(toCandle(bars[R.current.barPtr]))
        R.current.pc.timeScale().fitContent()
      }
      const price = bars[R.current.barPtr].c
      const mktDD = (entry - price) / entry
      // dread releases as the market climbs back out of the hole
      const ease = clamp(mktDD / 0.34, 0, 1) * (br === 'cut' ? 0.45 : 0.3)
      setDread(ease)
      audio && audio.update(ease * 0.8)
      if (br === 'hold') setHud({ equity: 10000 * price / entry, ddPct: mktDD * 100 })
      else setHud({ equity: soldEquity, ddPct: (1 - soldPrice / entry) * 100 })

      if (p >= 1) {
        clearInterval(clockRef.current); clockRef.current = null
        R.current.outcomeEquity = br === 'hold' ? recEquity : soldEquity
        setDread(br === 'hold' ? 0 : 0.18)
        setTimeout(() => setPhase('end'), 1500)
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

  if (phase === 'wake')
    return (
      <div className="screen slice-wake">
        <div className="wake-glow" />
        <div className="wake-lines">
          <p style={{ animationDelay: '0.4s' }}>9:07 AM, New York. Twenty-three minutes to the opening bell.</p>
          <p style={{ animationDelay: '2.0s' }}>You couldn't sleep. You already know what you're going to see.</p>
          <p style={{ animationDelay: '3.8s' }}>You reach for your phone before your eyes are even open.</p>
          <p className="red" style={{ animationDelay: '5.6s' }}>The market hasn't opened yet — and the futures are already limit-down. Frozen. All red.</p>
        </div>
        <button className="btn-primary big wake-btn" onClick={begin}>Look at it →</button>
        <div className="dim small wake-hint">sound on · headphones 🎧</div>
      </div>
    )

  if (phase === 'end') {
    const rv = data.reveal
    const ch = R.current.chosen || 'leverage'
    const good = ch === 'hold'      // the only right call — sunrise
    const heavy = ch === 'leverage' // liquidation — the screen drowns in it
    return (
      <div className={'screen end ' + (good ? 'reveal-good' : 'reveal-bad') + (heavy ? ' bad-heavy' : '')}>
        {!good && <div className="blood-flow"><div className="bsheet" /><div className="bdrips" /></div>}
        <div className="end-card">
          <div className="kicker">THE REVEAL</div>
          <h1>{rv.headline}</h1>
          <div className="reveal-sub">{data.revealTitle}</div>
          <Counterfactual data={data} chosen={ch} />
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
      </div>

      <aside
        className={'slice-phone' + (buzz % 2 ? ' buzz' : '')}
        style={{ filter: `blur(${Math.max(0, (dread - 0.72) * 28)}px)`, opacity: clamp(1 - voidOp, 0.06, 1) }}
      >
        <div className="phone-top">📱 <span className="dim">{buzz} notifications</span></div>
        <ul className="phone-feed">
          {feed.map((it) => (
            <li key={it._id} className={'feed-item ' + (it.type === 'news' ? 'broadcast' : 'post ' + (it.tone || ''))}>
              {it.type === 'news' ? (
                <div className="bc">
                  <div className="bc-top">
                    <span className="bc-live"><i />LIVE</span>
                    <span className="bc-logo"><span className="bc-logo-mark">M24</span>MARKETS 24</span>
                  </div>
                  <div className="bc-screen">
                    <NewsStudio />
                    <div className="bc-bug">M<span>24</span></div>
                    <div className="bc-lower">
                      <div className="bc-tag">BREAKING NEWS</div>
                      <div className="bc-headline">{it.text.replace(/^["“”]+|["“”]+$/g, '')}</div>
                    </div>
                  </div>
                  <div className="bc-ticker"><span>S&amp;P 500 ▼9.5%　DOW ▼12.9%　NASDAQ ▼9.4%　VIX ▲40　CRUDE ▼6.0%　GOLD ▼3.1%　S&amp;P 500 ▼9.5%　DOW ▼12.9%　NASDAQ ▼9.4%　VIX ▲40　CRUDE ▼6.0%　GOLD ▼3.1%　</span></div>
                </div>
              ) : (
                <>
                  <div className="feed-handle">@{it.handle}{it.verified && <span className="feed-verified">✓</span>}{it.title && <span className="feed-title"> · {it.title}</span>}</div>
                  {it.text}
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="slice-chart" style={{ transform: `scale(${1 + dread * 0.06})`, boxShadow: `0 0 ${dread * 140}px rgba(227,72,107,${dread * 0.9})` }}>
        {!after && <div className="chart-tag">S&amp;P 500 · LIVE</div>}
        <div ref={priceElRef} className="chart" />
        <div className="slice-hud">
          <div className={'equity ' + (hud.equity >= 10000 ? 'pos' : 'neg')}>{fmtMoney(hud.equity)}</div>
          <div className={'dd ' + (hud.ddPct > 0 ? 'neg' : 'pos')}>
            {hud.ddPct > 0 ? '-' : '+'}{Math.abs(hud.ddPct).toFixed(0)}%
            {R.current.leveraged ? ' · 3× MARGIN' : branch === 'cut' ? ' · IN CASH' : ''}
          </div>
        </div>
        {after && (
          <div className={'slice-goal ' + after.branch}>
            <span className="g-label">{after.label}</span>
            <b>{fmtMoney(after.target)}</b>
            <span className="g-sub">{(after.target / 10000 - 1) >= 0 ? '+' : ''}{Math.round((after.target / 10000 - 1) * 100)}%</span>
          </div>
        )}
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
