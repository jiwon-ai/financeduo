import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getCrossroads } from './api'
import { createAudio } from './audio'

const IMMERSION_MS = 150 // slow — let the mood build
const FWD_MS = 24

const fmtMoney = (x) => '$' + Math.round(x ?? 0).toLocaleString('en-US')
const fmtPct = (x) => (x == null || Number.isNaN(x) ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`)

const COLORS = { sell: '#e3486b', hold: '#5b8def', buy: '#26a17b' }
const GHOST = 'rgba(138,147,166,0.32)'

const toCandle = (b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })

export default function Crossroads({ onExit, onRetry }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | immersion | decision | forward | reveal
  const [choice, setChoice] = useState(null)
  const [feed, setFeed] = useState([])
  const [outcome, setOutcome] = useState(null)

  const priceElRef = useRef(null)
  const eqElRef = useRef(null)
  const feedScrollRef = useRef(null)
  const R = useRef({})
  const timerRef = useRef(null)

  useEffect(() => {
    getCrossroads('covid2020')
      .then((d) => { setData(d); setPhase('immersion') })
      .catch((e) => setErr(String(e)))
  }, [])

  useEffect(() => {
    if (feedScrollRef.current) feedScrollRef.current.scrollTop = feedScrollRef.current.scrollHeight
  }, [feed])

  function pushFeedUpTo(date) {
    const f = data.feed || []
    const add = []
    while (R.current.feedPtr < f.length && f[R.current.feedPtr].date <= date) {
      add.push(f[R.current.feedPtr])
      R.current.feedPtr++
    }
    if (add.length) setFeed((prev) => [...prev, ...add])
  }

  // init charts + run the slow immersion act, once
  useEffect(() => {
    if (!data || R.current.pc) return
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
    const pc = createChart(priceElRef.current, { ...common, width: priceElRef.current.clientWidth, height: 300 })
    const candle = pc.addCandlestickSeries({
      upColor: '#26a17b', downColor: '#e3486b',
      wickUpColor: '#26a17b', wickDownColor: '#e3486b', borderVisible: false,
    })
    const ec = createChart(eqElRef.current, { ...common, width: eqElRef.current.clientWidth, height: 120 })
    const lineSell = ec.addLineSeries({ color: GHOST, lineWidth: 1 })
    const lineHold = ec.addLineSeries({ color: GHOST, lineWidth: 1 })
    const lineBuy = ec.addLineSeries({ color: GHOST, lineWidth: 1 })

    const di = data.decisionIndex
    const entryPrice = data.bars[data.entryIndex].c
    const shares0 = data.initialInvest / entryPrice
    const holdEq = (i) => shares0 * data.bars[i].c + data.reserve

    const audio = createAudio()
    audio.resume()
    R.current = { pc, candle, ec, lineSell, lineHold, lineBuy, shares0, entryPrice, audio, peak: entryPrice, feedPtr: 0 }

    candle.update(toCandle(data.bars[0]))
    const eq0 = holdEq(0)
    lineSell.update({ time: data.bars[0].date, value: eq0 })
    lineHold.update({ time: data.bars[0].date, value: eq0 })
    lineBuy.update({ time: data.bars[0].date, value: eq0 })
    pc.timeScale().fitContent(); ec.timeScale().fitContent()
    pushFeedUpTo(data.bars[0].date)

    let i = 0
    timerRef.current = setInterval(() => {
      if (i >= di) { clearInterval(timerRef.current); setPhase('decision'); return }
      i++
      const b = data.bars[i]
      candle.update(toCandle(b))
      const eq = holdEq(i)
      lineSell.update({ time: b.date, value: eq })
      lineHold.update({ time: b.date, value: eq })
      lineBuy.update({ time: b.date, value: eq })
      pc.timeScale().fitContent(); ec.timeScale().fitContent()
      if (b.c > R.current.peak) R.current.peak = b.c
      audio.update(R.current.peak > 0 ? (R.current.peak - b.c) / R.current.peak : 0)
      pushFeedUpTo(b.date)
    }, IMMERSION_MS)

    const onResize = () => {
      pc.applyOptions({ width: priceElRef.current.clientWidth })
      ec.applyOptions({ width: eqElRef.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timerRef.current) clearInterval(timerRef.current)
      try { audio.dispose() } catch (e) { /* noop */ }
      pc.remove(); ec.remove()
    }
  }, [data])

  function skipImmersion() {
    if (timerRef.current) clearInterval(timerRef.current)
    const di = data.decisionIndex
    const { candle, lineSell, lineHold, lineBuy, shares0 } = R.current
    const holdEq = (i) => shares0 * data.bars[i].c + data.reserve
    candle.setData(data.bars.slice(0, di + 1).map(toCandle))
    const eqLine = data.bars.slice(0, di + 1).map((b, i) => ({ time: b.date, value: holdEq(i) }))
    lineSell.setData(eqLine); lineHold.setData(eqLine); lineBuy.setData(eqLine)
    R.current.pc.timeScale().fitContent(); R.current.ec.timeScale().fitContent()
    let pk = data.bars[0].c
    for (let i = 0; i <= di; i++) pk = Math.max(pk, data.bars[i].c)
    R.current.peak = pk
    R.current.audio?.update((pk - data.bars[di].c) / pk)
    pushFeedUpTo(data.bars[di].date)
    setPhase('decision')
  }

  function lock(id) {
    if (R.current.locked) return
    R.current.locked = true
    setChoice(id)
    setPhase('forward')

    const { shares0, audio } = R.current
    const di = data.decisionIndex
    const dp = data.bars[di].c
    const sellCash = shares0 * dp + data.reserve
    const buyShares = shares0 + data.reserve / dp
    const eqAt = (cid, i) => {
      if (i <= di) return shares0 * data.bars[i].c + data.reserve
      if (cid === 'sell') return sellCash
      if (cid === 'buy') return buyShares * data.bars[i].c
      return shares0 * data.bars[i].c + data.reserve
    }
    R.current.eqAt = eqAt
    if (audio) { audio.sting(); audio.update(0.34) }

    const ch = data.choices.find((c) => c.id === id)
    R.current.candle.setMarkers([
      { time: data.bars[di].date, position: 'aboveBar', color: COLORS[id], shape: 'arrowDown', text: ch.stamp },
    ])
    const lines = { sell: R.current.lineSell, hold: R.current.lineHold, buy: R.current.lineBuy }
    Object.entries(lines).forEach(([k, s]) =>
      s.applyOptions({ color: k === id ? COLORS[k] : GHOST, lineWidth: k === id ? 3 : 1, lineStyle: k === id ? 0 : 2 })
    )

    let i = di
    timerRef.current = setInterval(() => {
      i++
      if (i >= data.bars.length) { clearInterval(timerRef.current); finishForward(id, eqAt); return }
      const b = data.bars[i]
      R.current.candle.update(toCandle(b))
      R.current.lineSell.update({ time: b.date, value: eqAt('sell', i) })
      R.current.lineHold.update({ time: b.date, value: eqAt('hold', i) })
      R.current.lineBuy.update({ time: b.date, value: eqAt('buy', i) })
      R.current.pc.timeScale().fitContent(); R.current.ec.timeScale().fitContent()
    }, FWD_MS)
  }

  function finishForward(id, eqAt) {
    const last = data.bars.length - 1
    const di = data.decisionIndex
    const startEq = R.current.shares0 * data.bars[di].c + data.reserve
    const finals = { sell: eqAt('sell', last), hold: eqAt('hold', last), buy: eqAt('buy', last) }
    const best = Object.keys(finals).reduce((a, b) => (finals[b] > finals[a] ? b : a), 'sell')
    setOutcome({ finals, startEq, best })
    if (R.current.audio) { R.current.audio.update(0); R.current.audio.sting() }
    setPhase('reveal')
  }

  if (err)
    return (
      <div className="screen">
        <p className="err">Error: {err}</p>
        <button className="btn" onClick={onExit}>← Menu</button>
      </div>
    )

  const showFeed = phase === 'immersion' || phase === 'decision'

  return (
    <div className="game crossroads">
      <header className="topbar">
        <div className="brand">CROSSROADS</div>
        <div className="day dim">
          {phase === 'immersion' && 'feel the moment…'}
          {phase === 'decision' && 'everyone is panicking. what do you do?'}
          {(phase === 'forward' || phase === 'reveal') && 'a real decision · real consequences'}
        </div>
        <div className="controls">
          <button className="btn" onClick={onExit}>← Menu</button>
        </div>
      </header>

      <div className="layout">
        <main className="charts">
          <div className="chart-wrap">
            <div className="chart-tag">PRICE · symbol hidden</div>
            <div ref={priceElRef} className="chart" />
          </div>
          <div className="chart-wrap small">
            <div className="chart-tag">THE PATHS · where your choice diverges</div>
            <div ref={eqElRef} className="chart" />
          </div>
        </main>

        <aside className="sidebar">
          {showFeed && data && (
            <div className="panel cr-feed-panel">
              <div className="panel-title">{phase === 'immersion' ? 'THE MOOD' : 'THE MOOD · right now'}</div>
              <div className="cr-feed" ref={feedScrollRef}>
                {feed.map((it, k) => <FeedItem key={k} item={it} />)}
              </div>
            </div>
          )}

          {phase === 'immersion' && (
            <button className="btn" onClick={skipImmersion}>Skip ahead ▶</button>
          )}

          {phase === 'decision' && data && (
            <div className="panel cr-decide">
              <Standing data={data} />
              <p className="cr-question">{data.question}</p>
              {data.choices.map((c) => (
                <button key={c.id} className={'cr-choice ' + c.id} onClick={() => lock(c.id)}>
                  <b>{c.label}</b>
                  <span>{c.sub}</span>
                </button>
              ))}
              <div className="dim small">Once you choose, it's locked.</div>
            </div>
          )}

          {phase === 'forward' && (
            <div className="panel cr-forward">
              <div className="cr-stamp" style={{ color: COLORS[choice] }}>
                {data.choices.find((c) => c.id === choice)?.stamp}
              </div>
              <div className="dim">The record is being written…</div>
            </div>
          )}

          {phase === 'reveal' && outcome && (
            <RevealPanel data={data} choice={choice} outcome={outcome} onExit={onExit} onRetry={onRetry} />
          )}
        </aside>
      </div>
    </div>
  )
}

function FeedItem({ item }) {
  if (item.kind === 'news')
    return (
      <div className="feed-item news">
        <span className="feed-tag">NEWS</span>
        {item.text}
      </div>
    )
  return (
    <div className={'feed-item post ' + (item.tone || '')}>
      <div className="feed-handle">@{item.handle}</div>
      <div>{item.text}</div>
    </div>
  )
}

function Standing({ data }) {
  const entryPrice = data.bars[data.entryIndex].c
  const dp = data.bars[data.decisionIndex].c
  const posNow = (data.initialInvest / entryPrice) * dp
  const downPct = (dp / entryPrice - 1) * 100
  return (
    <div className="cr-standing">
      <div><span className="dim">Your position</span><b className="neg">{fmtMoney(posNow)}</b></div>
      <div><span className="dim">Down</span><b className="neg">{fmtPct(downPct)}</b></div>
      <div><span className="dim">Cash reserve</span><b>{fmtMoney(data.reserve)}</b></div>
    </div>
  )
}

function RevealPanel({ data, choice, outcome, onExit, onRetry }) {
  const { finals, startEq, best } = outcome
  const order = ['sell', 'hold', 'buy']
  const gap = finals[best] - finals[choice]

  const verdicts = {
    buy: 'You bought while the feed begged you to run. Fifteen months later it was called the trade of the decade — but in that moment it felt insane.',
    hold: 'You did nothing while everyone screamed to sell. The hardest act in investing — and exactly why you recovered.',
    sell: 'You joined the crowd and sold. It felt safe; everyone agreed. You locked the loss and watched the recovery from the sidelines.',
  }

  return (
    <div className="panel cr-reveal">
      <div className="kicker">THE REVEAL</div>
      <h2>{data.reveal.headline}</h2>
      <div className="reveal-sub">{data.revealTitle}</div>

      <div className="cr-outcomes">
        {order.map((k) => {
          const c = data.choices.find((x) => x.id === k)
          const yours = k === choice
          return (
            <div key={k} className={'cr-outcome' + (yours ? ' yours' : '') + (k === best ? ' best' : '')}>
              <span className="dot" style={{ background: COLORS[k] }} />
              <span className="lab">{c.label}{yours ? ' · YOU' : ''}</span>
              <b style={{ color: yours ? COLORS[k] : undefined }}>{fmtMoney(finals[k])}</b>
              <span className="chg">{fmtPct((finals[k] / startEq - 1) * 100)}</span>
            </div>
          )
        })}
      </div>

      <p className="cr-verdict">{verdicts[choice]}</p>
      {choice !== best && (
        <p className="cr-gap">
          The path not taken: <b>{data.choices.find((c) => c.id === best).label}</b> would have left you {fmtMoney(gap)} richer.
        </p>
      )}
      <p className="cr-honest dim small">
        But standing there, in the fear, no one knew. You own the decision — history owns the dice.
      </p>

      <ul className="facts-list">
        {data.reveal.facts.map((f, k) => <li key={k}>{f}</li>)}
      </ul>

      <div className="cr-actions">
        <button className="btn-primary" onClick={onRetry}>Try again →</button>
        <button className="btn" onClick={onExit}>← Menu</button>
      </div>
    </div>
  )
}
