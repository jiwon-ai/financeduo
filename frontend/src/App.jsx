import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getScenario, scoreRun } from './api'
import { createAudio } from './audio'

const SCENARIO_ID = 'gfc2008'
const SPEEDS = { 1: 240, 2: 120, 4: 50 } // base ms per bar

// the voices of panic — your own mind is the monster
const THOUGHTS = [
  'sell it all',
  "it'll bounce back",
  "you're going to lose everything",
  'get out now',
  'this is only the beginning',
  'you should have seen this coming',
  "don't look at the number",
  'everyone is selling',
]

const r2 = (x) => Math.round(x * 100) / 100
const fmtMoney = (x) =>
  '$' + (x ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmtPct = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`

export default function App() {
  const [phase, setPhase] = useState('loading') // loading | start | playing | ended
  const [scenario, setScenario] = useState(null)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    getScenario(SCENARIO_ID)
      .then((s) => {
        setScenario(s)
        setPhase('start')
      })
      .catch((e) => setErr(String(e)))
  }, [])

  if (err)
    return (
      <div className="screen">
        <p className="err">Error: {err}</p>
        <p className="dim">Is the backend running on :8000?</p>
      </div>
    )
  if (phase === 'loading' || !scenario)
    return (
      <div className="screen">
        <p className="dim">Loading history…</p>
      </div>
    )
  if (phase === 'start')
    return <StartScreen onStart={() => setPhase('playing')} />
  if (phase === 'playing')
    return (
      <Game
        scenario={scenario}
        onFinish={(res) => {
          setResult(res)
          setPhase('ended')
        }}
      />
    )
  return (
    <EndScreen
      scenario={scenario}
      result={result}
      onReplay={() => {
        setResult(null)
        setPhase('start')
      }}
    />
  )
}

function StartScreen({ onStart }) {
  return (
    <div className="screen start">
      <div className="start-card">
        <div className="kicker">TIME MACHINE</div>
        <h1>You are about to be dropped into a real moment in market history.</h1>
        <p className="lead">
          You won't be told the year. You won't be told the asset. You'll see only
          the price, the headlines as they broke, and your money on the line.
        </p>
        <p className="lead">
          Buy, sell, or hold as it unfolds bar by bar. Then we'll reveal where you
          were — and score not how much you made, but <em>how you handled it.</em>
        </p>
        <button className="btn-primary big" onClick={onStart}>
          Enter the machine →
        </button>
        <div className="dim small">No real money. Ever. · Sound on, headphones for the full descent 🎧</div>
      </div>
    </div>
  )
}

function Game({ scenario, onFinish }) {
  const bars = scenario.bars
  const start = scenario.startingCash

  const priceElRef = useRef(null)
  const eqElRef = useRef(null)
  const candleRef = useRef(null)
  const eqLineRef = useRef(null)
  const chartsRef = useRef([])
  const audioRef = useRef(null)

  const iRef = useRef(0)
  const cashRef = useRef(start)
  const sharesRef = useRef(0)
  const equityArrRef = useRef([])
  const expoArrRef = useRef([])
  const peakRef = useRef(start)
  const shownRef = useRef(0)
  const finishedRef = useRef(false)
  const volArrRef = useRef([])
  const volRef = useRef(0.008)
  const shakeToRef = useRef(null)
  const prevTierRef = useRef(0)
  const thoughtNRef = useRef(0)

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [flashN, setFlashN] = useState(0)
  const [owFlash, setOwFlash] = useState(0)
  const [interference, setInterference] = useState(0)
  const [thought, setThought] = useState(null)
  const [hud, setHud] = useState({
    day: 1, total: bars.length, price: bars[0].c,
    cash: start, posValue: 0, equity: start, expoPct: 0, pnlPct: 0, ddPct: 0,
  })
  const [news, setNews] = useState([])

  const toCandle = (b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })

  function triggerShake() {
    setShaking(true)
    if (shakeToRef.current) clearTimeout(shakeToRef.current)
    shakeToRef.current = setTimeout(() => setShaking(false), 430)
  }

  function recordBar(i) {
    const price = bars[i].c
    const prev = i > 0 ? bars[i - 1].c : price
    const move = prev ? price / prev - 1 : 0

    const va = volArrRef.current
    va.push(Math.abs(move))
    if (va.length > 5) va.shift()
    volRef.current = va.reduce((a, b) => a + b, 0) / va.length

    const equity = cashRef.current + sharesRef.current * price
    const expo = equity > 0 ? (sharesRef.current * price) / equity : 0
    equityArrRef.current[i] = r2(equity)
    expoArrRef.current[i] = Math.round(expo * 1000) / 1000
    if (equity > peakRef.current) peakRef.current = equity
    const dd = peakRef.current > 0 ? (peakRef.current - equity) / peakRef.current : 0
    const ddp = dd * 100
    const tier = ddp >= 38 ? 3 : ddp >= 20 ? 2 : ddp >= 8 ? 1 : 0

    // the environment descends with fear
    if (audioRef.current) audioRef.current.update(dd)
    if (tier > prevTierRef.current && tier >= 3) {
      if (audioRef.current) audioRef.current.siren()
      setOwFlash((n) => n + 1)
    }
    prevTierRef.current = tier

    if (move <= -0.025) {
      triggerShake()
      setFlashN((n) => n + 1)
      if (audioRef.current) audioRef.current.sting()
      if (tier >= 2 && Math.random() < 0.6) {
        setThought({ text: THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)], n: thoughtNRef.current++ })
      }
    }

    eqLineRef.current.update({ time: bars[i].date, value: r2(equity) })

    const d = bars[i].date
    const fresh = []
    while (
      shownRef.current < scenario.headlines.length &&
      scenario.headlines[shownRef.current].date <= d
    ) {
      fresh.push(scenario.headlines[shownRef.current])
      shownRef.current++
    }
    if (fresh.length) setNews((n) => [...fresh.reverse(), ...n])

    setHud({
      day: i + 1, total: bars.length, price,
      cash: cashRef.current, posValue: sharesRef.current * price, equity,
      expoPct: expo * 100, pnlPct: (equity / start - 1) * 100, ddPct: ddp,
    })
  }

  function step() {
    const next = iRef.current + 1
    if (next >= bars.length) return
    iRef.current = next
    candleRef.current.update(toCandle(bars[next]))
    recordBar(next)
    chartsRef.current[0].timeScale().fitContent()
    chartsRef.current[1].timeScale().fitContent()
  }

  // init charts + audio once
  useEffect(() => {
    const common = {
      layout: {
        background: { color: 'transparent' },
        textColor: '#8a93a6',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { visible: false, borderVisible: false },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 0 },
    }
    const pc = createChart(priceElRef.current, {
      ...common, width: priceElRef.current.clientWidth, height: 360,
    })
    const candle = pc.addCandlestickSeries({
      upColor: '#26a17b', downColor: '#e3486b',
      wickUpColor: '#26a17b', wickDownColor: '#e3486b', borderVisible: false,
    })
    const ec = createChart(eqElRef.current, {
      ...common, width: eqElRef.current.clientWidth, height: 120,
    })
    const line = ec.addLineSeries({ color: '#5b8def', lineWidth: 2 })
    candleRef.current = candle
    eqLineRef.current = line
    chartsRef.current = [pc, ec]

    audioRef.current = createAudio()
    audioRef.current.resume()

    candle.update(toCandle(bars[0]))
    recordBar(0)
    pc.timeScale().fitContent()
    ec.timeScale().fitContent()

    const onResize = () => {
      pc.applyOptions({ width: priceElRef.current.clientWidth })
      ec.applyOptions({ width: eqElRef.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (shakeToRef.current) clearTimeout(shakeToRef.current)
      if (audioRef.current) audioRef.current.dispose()
      pc.remove()
      ec.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // playback scheduler — volatility tempo + radio-static dread before a crash
  useEffect(() => {
    if (!playing) return
    let cancelled = false
    let to = null

    function tick() {
      if (cancelled) return
      const base = SPEEDS[speed]
      let mult = 1 - (volRef.current - 0.008) * 12
      mult = Math.max(0.4, Math.min(1.15, mult))
      let delay = base * mult

      const next = iRef.current + 1
      let dramatic = false
      if (next < bars.length) {
        const nm = bars[next].c / bars[next - 1].c - 1
        if (nm <= -0.03) {
          dramatic = true
          delay = base * 2.6
        }
      }
      // the dread builds DURING the pause: static swells, screen crackles
      if (dramatic && audioRef.current) {
        audioRef.current.radioStatic(delay)
        setInterference((n) => n + 1)
      }

      to = setTimeout(() => {
        if (cancelled) return
        step()
        if (iRef.current + 1 >= bars.length) {
          finish()
          return
        }
        tick()
      }, delay)
    }
    tick()
    return () => {
      cancelled = true
      if (to) clearTimeout(to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed])

  function toggleMute() {
    setMuted((m) => {
      const nm = !m
      if (audioRef.current) {
        audioRef.current.resume()
        audioRef.current.setMuted(nm)
      }
      return nm
    })
  }

  function trade(side, frac) {
    if (audioRef.current) audioRef.current.resume()
    const price = bars[iRef.current].c
    const equity = cashRef.current + sharesRef.current * price
    if (side === 'buy') {
      const amount = frac >= 1 ? cashRef.current : Math.min(cashRef.current, frac * equity)
      if (amount <= 0) return
      sharesRef.current += amount / price
      cashRef.current -= amount
    } else {
      const value =
        frac >= 1 ? sharesRef.current * price : Math.min(sharesRef.current * price, frac * equity)
      const sh = value / price
      if (sh <= 0) return
      sharesRef.current -= sh
      cashRef.current += sh * price
    }
    recordBar(iRef.current)
  }

  async function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    setPlaying(false)
    const n = iRef.current + 1
    const equity = equityArrRef.current.slice(0, n)
    const exposure = expoArrRef.current.slice(0, n)
    let scorecard
    try {
      scorecard = await scoreRun(SCENARIO_ID, equity, exposure)
    } catch (e) {
      scorecard = { error: String(e) }
    }
    onFinish({ scorecard, finalEquity: equity[n - 1], days: n })
  }

  const down = hud.pnlPct < 0
  const dd = hud.ddPct
  const tier = dd >= 38 ? 3 : dd >= 20 ? 2 : dd >= 8 ? 1 : 0
  const vignette = Math.min(0.78, dd / 68)
  const desat = Math.min(0.55, dd / 130)
  const grainOp = Math.min(0.2, dd / 220)
  const rustOp = dd >= 18 ? Math.min(0.45, (dd - 18) / 70) : 0
  const scanOp = dd >= 36 ? 0.1 : 0
  const fogOp = Math.min(0.5, dd / 95)

  return (
    <div className={'game' + (shaking ? ' shake' : '') + (tier >= 3 ? ' otherworld' : '')}>
      <div className="crash-vignette" style={{ opacity: vignette }} />
      <div className="rust" style={{ opacity: rustOp }} />
      <div className="grain" style={{ opacity: grainOp }} />
      {scanOp > 0 && <div className="scanlines" style={{ opacity: scanOp }} />}
      {flashN > 0 && <div key={flashN} className="newlow-flash" />}
      {owFlash > 0 && <div key={'ow' + owFlash} className="ow-flash" />}
      {interference > 0 && <div key={'if' + interference} className="interference" />}
      {thought && <div key={thought.n} className="intrusive">{thought.text}</div>}

      <header className="topbar">
        <div className="brand">TIME MACHINE</div>
        <div className="day">
          DAY {hud.day} <span className="dim">/ {hud.total}</span>
        </div>
        <div className="controls">
          <button className="btn" onClick={toggleMute} title="Sound">
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              className={'btn speed' + (speed === s ? ' on' : '')}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
          <button className="btn end" onClick={finish}>
            End run
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="charts" style={{ filter: `grayscale(${desat}) contrast(${1 + desat * 0.3})` }}>
          <div className="chart-wrap">
            <div className="chart-tag">PRICE · symbol hidden</div>
            <div ref={priceElRef} className="chart" />
            <div className="fog" style={{ opacity: fogOp }} />
          </div>
          <div className="chart-wrap small">
            <div className="chart-tag">YOUR EQUITY</div>
            <div ref={eqElRef} className="chart" />
          </div>
        </main>

        <aside className="sidebar">
          <div className="panel portfolio">
            <div className={'equity ' + (down ? 'neg' : 'pos') + (tier >= 3 ? ' glitch' : '')}>
              {fmtMoney(hud.equity)}
            </div>
            <div className={'pnl ' + (down ? 'neg' : 'pos')}>{fmtPct(hud.pnlPct)}</div>
            <div className="stats">
              <div>
                <span className="dim">Price</span>
                <b>{hud.price.toFixed(2)}</b>
              </div>
              <div>
                <span className="dim">Invested</span>
                <b>{hud.expoPct.toFixed(0)}%</b>
              </div>
              <div>
                <span className="dim">Cash</span>
                <b>{fmtMoney(hud.cash)}</b>
              </div>
              <div>
                <span className="dim">Drawdown</span>
                <b className="neg">-{hud.ddPct.toFixed(1)}%</b>
              </div>
            </div>
          </div>

          <div className="panel trade">
            <div className="trade-row">
              <button className="btn buy" onClick={() => trade('buy', 0.25)}>Buy 25%</button>
              <button className="btn buy" onClick={() => trade('buy', 1)}>All in</button>
            </div>
            <div className="trade-row">
              <button className="btn sell" onClick={() => trade('sell', 0.25)}>Sell 25%</button>
              <button className="btn sell" onClick={() => trade('sell', 1)}>All out</button>
            </div>
          </div>

          <div className="panel news">
            <div className="panel-title">THE TAPE</div>
            {news.length === 0 && <div className="dim small">Quiet so far. It won't last.</div>}
            <ul>
              {news.map((h, k) => (
                <li key={k} className={'head ' + h.tone}>{h.text}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function EndScreen({ scenario, result, onReplay }) {
  const sc = result?.scorecard || {}
  const reveal = scenario.reveal
  const failed = sc.error
  return (
    <div className="screen end">
      <div className="end-card">
        <div className="kicker">THE REVEAL</div>
        <h1>{reveal.headline}</h1>
        <div className="reveal-sub">{scenario.revealTitle}</div>

        {failed ? (
          <p className="err">Could not score this run: {sc.error}</p>
        ) : (
          <>
            <div className="scoreline">
              <div className={'grade g-' + sc.grade}>{sc.grade}</div>
              <div className="score-meta">
                <div className="risk">
                  Risk score <b>{sc.riskScore}</b>/100
                </div>
                <div className="verdict">{sc.verdict}</div>
              </div>
            </div>

            <div className="scoregrid">
              <Stat label="Your return" value={fmtPct(sc.returnPct)} cls={sc.returnPct >= 0 ? 'pos' : 'neg'} />
              <Stat label="Buy & hold" value={fmtPct(sc.buyHoldReturnPct)} cls={sc.buyHoldReturnPct >= 0 ? 'pos' : 'neg'} />
              <Stat label="Max drawdown" value={`-${sc.maxDrawdownPct}%`} cls="neg" />
              <Stat label="Sharpe" value={sc.sharpe} />
              <Stat label="Calmar" value={sc.calmar} />
              <Stat label="Final" value={fmtMoney(sc.finalEquity)} />
            </div>

            <div className="badges">
              {sc.capitulated && <span className="badge bad">Panic-sold the bottom</span>}
              {sc.boughtDip && <span className="badge good">Bought the fear</span>}
            </div>

            <ul className="lessons">
              {(sc.lessons || []).map((l, k) => (
                <li key={k}>{l}</li>
              ))}
            </ul>
          </>
        )}

        <div className="facts">
          <div className="panel-title">WHAT REALLY HAPPENED</div>
          <ul>
            {reveal.facts.map((f, k) => (
              <li key={k}>{f}</li>
            ))}
          </ul>
        </div>

        <button className="btn-primary big" onClick={onReplay}>
          Play again →
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, cls }) {
  return (
    <div className="stat">
      <span className="dim">{label}</span>
      <b className={cls}>{value}</b>
    </div>
  )
}
