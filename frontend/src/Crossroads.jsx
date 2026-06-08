import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getCrossroads } from './api'
import { createAudio } from './audio'

const IMMERSION_MS = 150
const FWD_MS = 22

const fmtMoney = (x) => '$' + Math.round(x ?? 0).toLocaleString('en-US')
const fmtPct = (x) => (x == null || Number.isNaN(x) ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`)
const toCandle = (b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })

export default function Crossroads({ onExit, onRetry }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | immersion | beat | between | reveal
  const [feed, setFeed] = useState([])
  const [beatIdx, setBeatIdx] = useState(0)
  const [hud, setHud] = useState({ price: 0, cash: 0, shares: 0, equity: 0, posPct: 0 })
  const [buyAt, setBuyAt] = useState('')
  const [sellAt, setSellAt] = useState('')
  const [orders, setOrders] = useState({ buy: null, sell: null }) // for display
  const [log, setLog] = useState([])
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
      add.push(f[R.current.feedPtr]); R.current.feedPtr++
    }
    if (add.length) setFeed((p) => [...p, ...add])
  }

  function pushLog(entry) { setLog((l) => [...l, entry]) }

  function refreshHud(i) {
    const price = data.bars[i].c
    const eq = R.current.cash + R.current.shares * price
    setHud({ price, cash: R.current.cash, shares: R.current.shares, equity: eq, posPct: eq > 0 ? (R.current.shares * price) / eq * 100 : 0 })
  }

  // init charts + run immersion to the first beat
  useEffect(() => {
    if (!data || R.current.pc) return
    const common = {
      layout: { background: { color: 'transparent' }, textColor: '#8a93a6', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { visible: false, borderVisible: false },
      handleScroll: false, handleScale: false, crosshair: { mode: 1 },
    }
    const pc = createChart(priceElRef.current, { ...common, width: priceElRef.current.clientWidth, height: 320 })
    const candle = pc.addCandlestickSeries({ upColor: '#26a17b', downColor: '#e3486b', wickUpColor: '#26a17b', wickDownColor: '#e3486b', borderVisible: false })
    const ec = createChart(eqElRef.current, { ...common, width: eqElRef.current.clientWidth, height: 120 })
    const lineBH = ec.addLineSeries({ color: 'rgba(138,147,166,0.45)', lineWidth: 1, lineStyle: 2 })
    const lineYou = ec.addLineSeries({ color: '#5b8def', lineWidth: 3 })

    const entryPrice = data.bars[data.entryIndex].c
    const shares0 = data.startingCash / entryPrice

    const audio = createAudio(); audio.resume()
    R.current = {
      pc, candle, ec, lineYou, lineBH, audio, shares0, entryPrice, peak: entryPrice,
      feedPtr: 0, cash: 0, shares: shares0, pendingBuy: null, pendingSell: null,
      buyLine: null, sellLine: null, markers: [],
    }

    const eq0 = shares0 * data.bars[0].c
    candle.update(toCandle(data.bars[0]))
    lineYou.update({ time: data.bars[0].date, value: eq0 })
    lineBH.update({ time: data.bars[0].date, value: eq0 })
    pc.timeScale().fitContent(); ec.timeScale().fitContent()
    pushFeedUpTo(data.bars[0].date)

    const firstBeat = data.beats[0]
    let i = 0
    timerRef.current = setInterval(() => {
      if (i >= firstBeat) { clearInterval(timerRef.current); enterBeat(0); return }
      i++
      const b = data.bars[i]
      candle.update(toCandle(b))
      const eq = R.current.cash + R.current.shares * b.c
      lineYou.update({ time: b.date, value: eq })
      lineBH.update({ time: b.date, value: shares0 * b.c })
      pc.timeScale().fitContent(); ec.timeScale().fitContent()
      if (b.c > R.current.peak) R.current.peak = b.c
      audio.update(R.current.peak > 0 ? (R.current.peak - b.c) / R.current.peak : 0)
      pushFeedUpTo(b.date)
    }, IMMERSION_MS)

    const onResize = () => { pc.applyOptions({ width: priceElRef.current.clientWidth }); ec.applyOptions({ width: eqElRef.current.clientWidth }) }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timerRef.current) clearInterval(timerRef.current)
      try { audio.dispose() } catch (e) { /* noop */ }
      pc.remove(); ec.remove()
    }
  }, [data])

  function enterBeat(k) {
    const idx = data.beats[k]
    const price = data.bars[idx].c
    setBeatIdx(k)
    setPhase('beat')
    refreshHud(idx)
    setBuyAt(String(Math.round(price * 0.95)))
    setSellAt(String(Math.round(price * 1.1)))
    pushFeedUpTo(data.bars[idx].date)
    R.current.audio?.update(R.current.peak > 0 ? (R.current.peak - price) / R.current.peak : 0)
  }

  function marketBuy() {
    const idx = data.beats[beatIdx]
    const price = data.bars[idx].c
    if (R.current.cash <= 0) return
    const amt = R.current.cash
    R.current.shares += amt / price
    R.current.cash = 0
    pushLog({ type: 'buy', text: `Bought at market — ${fmtMoney(amt)} @ ${price.toFixed(0)}` })
    if (R.current.audio) R.current.audio.sting()
    refreshHud(idx)
  }
  function marketSell() {
    const idx = data.beats[beatIdx]
    const price = data.bars[idx].c
    if (R.current.shares <= 0) return
    const val = R.current.shares * price
    R.current.cash += val
    R.current.shares = 0
    pushLog({ type: 'sell', text: `Sold at market — ${fmtMoney(val)} @ ${price.toFixed(0)}` })
    if (R.current.audio) R.current.audio.sting()
    refreshHud(idx)
  }

  function setBuyOrder() {
    const L = parseFloat(buyAt)
    if (!L || L <= 0) return
    R.current.pendingBuy = L
    if (R.current.buyLine) R.current.candle.removePriceLine(R.current.buyLine)
    R.current.buyLine = R.current.candle.createPriceLine({ price: L, color: '#26a17b', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'buy' })
    setOrders((o) => ({ ...o, buy: L }))
    pushLog({ type: 'order', text: `Buy order set @ ${L.toFixed(0)}` })
  }
  function setSellOrder() {
    const idx = data.beats[beatIdx]
    const price = data.bars[idx].c
    const S = parseFloat(sellAt)
    if (!S || S <= 0) return
    const kind = S >= price ? 'tp' : 'stop'
    R.current.pendingSell = { price: S, kind }
    if (R.current.sellLine) R.current.candle.removePriceLine(R.current.sellLine)
    R.current.sellLine = R.current.candle.createPriceLine({ price: S, color: '#e3486b', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: kind === 'tp' ? 'target' : 'stop' })
    setOrders((o) => ({ ...o, sell: { price: S, kind } }))
    pushLog({ type: 'order', text: `Sell ${kind === 'tp' ? 'target' : 'stop'} set @ ${S.toFixed(0)}` })
  }
  function cancelOrders() {
    R.current.pendingBuy = null
    R.current.pendingSell = null
    if (R.current.buyLine) { R.current.candle.removePriceLine(R.current.buyLine); R.current.buyLine = null }
    if (R.current.sellLine) { R.current.candle.removePriceLine(R.current.sellLine); R.current.sellLine = null }
    setOrders({ buy: null, sell: null })
  }

  function checkOrders(i) {
    const b = data.bars[i]
    // limit buy
    if (R.current.pendingBuy != null && R.current.cash > 0 && b.l <= R.current.pendingBuy) {
      const L = R.current.pendingBuy
      const amt = R.current.cash
      R.current.shares += amt / L
      R.current.cash = 0
      R.current.pendingBuy = null
      if (R.current.buyLine) { R.current.candle.removePriceLine(R.current.buyLine); R.current.buyLine = null }
      R.current.markers.push({ time: b.date, position: 'belowBar', color: '#26a17b', shape: 'arrowUp', text: `BUY ${L.toFixed(0)}` })
      R.current.candle.setMarkers(R.current.markers)
      setOrders((o) => ({ ...o, buy: null }))
      pushLog({ type: 'fill', text: `✓ Buy filled @ ${L.toFixed(0)} — ${fmtMoney(amt)} in` })
      if (R.current.audio) R.current.audio.sting()
    }
    // sell (tp or stop)
    if (R.current.pendingSell && R.current.shares > 0) {
      const { price: S, kind } = R.current.pendingSell
      const hit = kind === 'tp' ? b.h >= S : b.l <= S
      if (hit) {
        const val = R.current.shares * S
        R.current.cash += val
        R.current.shares = 0
        R.current.pendingSell = null
        if (R.current.sellLine) { R.current.candle.removePriceLine(R.current.sellLine); R.current.sellLine = null }
        R.current.markers.push({ time: b.date, position: 'aboveBar', color: '#e3486b', shape: 'arrowDown', text: `${kind === 'tp' ? 'TARGET' : 'STOP'} ${S.toFixed(0)}` })
        R.current.candle.setMarkers(R.current.markers)
        setOrders((o) => ({ ...o, sell: null }))
        pushLog({ type: 'fill', text: `✓ ${kind === 'tp' ? 'Target' : 'Stop'} hit @ ${S.toFixed(0)} — ${fmtMoney(val)} out` })
        if (R.current.audio) R.current.audio.sting()
      }
    }
  }

  function advance(stance) {
    const k = beatIdx
    const beats = data.beats
    const fromI = beats[k]
    const isLast = !(k + 1 < beats.length)
    const toI = isLast ? data.bars.length - 1 : beats[k + 1]
    pushLog({ type: 'stance', text: `${stance === 'hold' ? 'Held' : 'Watched'} through ${data.bars[fromI].date} → ${data.bars[toI].date}` })
    setPhase('between')
    let i = fromI
    timerRef.current = setInterval(() => {
      i++
      if (i > toI) {
        clearInterval(timerRef.current)
        if (isLast) finishJourney()
        else enterBeat(k + 1)
        return
      }
      const b = data.bars[i]
      R.current.candle.update(toCandle(b))
      checkOrders(i)
      R.current.lineYou.update({ time: b.date, value: R.current.cash + R.current.shares * b.c })
      R.current.lineBH.update({ time: b.date, value: R.current.shares0 * b.c })
      R.current.pc.timeScale().fitContent(); R.current.ec.timeScale().fitContent()
      if (b.c > R.current.peak) R.current.peak = b.c
      R.current.audio?.update(R.current.peak > 0 ? (R.current.peak - b.c) / R.current.peak : 0)
      pushFeedUpTo(b.date)
    }, FWD_MS)
  }

  function finishJourney() {
    const last = data.bars.length - 1
    const endPrice = data.bars[last].c
    const yourFinal = R.current.cash + R.current.shares * endPrice
    const bhFinal = R.current.shares0 * endPrice
    setOutcome({ yourFinal, bhFinal, startEq: data.startingCash })
    R.current.audio?.update(0)
    R.current.audio?.sting()
    setPhase('reveal')
  }

  if (err)
    return (
      <div className="screen"><p className="err">Error: {err}</p><button className="btn" onClick={onExit}>← Menu</button></div>
    )

  const showFeed = phase === 'immersion' || phase === 'beat' || phase === 'between'
  const note = data && phase === 'beat' ? (data.beatNotes || [])[beatIdx] : null

  return (
    <div className="game crossroads">
      <header className="topbar">
        <div className="brand">CROSSROADS</div>
        <div className="day dim">
          {phase === 'immersion' && 'feel the moment…'}
          {phase === 'beat' && `decision ${beatIdx + 1} of ${data.beats.length}`}
          {phase === 'between' && 'the market moves…'}
          {phase === 'reveal' && 'your journey · real consequences'}
        </div>
        <div className="controls"><button className="btn" onClick={onExit}>← Menu</button></div>
      </header>

      <div className="layout">
        <main className="charts">
          <div className="chart-wrap">
            <div className="chart-tag">PRICE · symbol hidden</div>
            <div ref={priceElRef} className="chart" />
          </div>
          <div className="chart-wrap small">
            <div className="chart-tag">YOU vs BUY &amp; HOLD</div>
            <div ref={eqElRef} className="chart" />
          </div>
        </main>

        <aside className="sidebar">
          {phase === 'beat' && data && (
            <div className="panel cr-beat">
              <div className="cr-beatnote">{note}</div>
              <div className="cr-pos">
                <div><span className="dim">Equity</span><b>{fmtMoney(hud.equity)}</b></div>
                <div><span className="dim">Invested</span><b>{hud.posPct.toFixed(0)}%</b></div>
                <div><span className="dim">Price</span><b>{hud.price.toFixed(0)}</b></div>
                <div><span className="dim">Cash</span><b>{fmtMoney(hud.cash)}</b></div>
              </div>

              <div className="cr-market">
                <button className="btn buy" onClick={marketBuy} disabled={hud.cash <= 0}>Buy now</button>
                <button className="btn sell" onClick={marketSell} disabled={hud.shares <= 0}>Sell now</button>
              </div>

              <div className="cr-orders">
                <div className="cr-order-row">
                  <label>Buy at</label>
                  <input type="number" value={buyAt} onChange={(e) => setBuyAt(e.target.value)} />
                  <button className="btn buy" onClick={setBuyOrder}>Set</button>
                </div>
                <div className="cr-order-row">
                  <label>Sell at</label>
                  <input type="number" value={sellAt} onChange={(e) => setSellAt(e.target.value)} />
                  <button className="btn sell" onClick={setSellOrder}>Set</button>
                </div>
                {(orders.buy || orders.sell) && (
                  <div className="cr-active">
                    {orders.buy && <span className="tag g">buy @ {orders.buy.toFixed(0)}</span>}
                    {orders.sell && <span className="tag r">{orders.sell.kind === 'tp' ? 'target' : 'stop'} @ {orders.sell.price.toFixed(0)}</span>}
                    <button className="linkbtn" onClick={cancelOrders}>clear</button>
                  </div>
                )}
              </div>

              <div className="cr-advance">
                <button className="btn" onClick={() => advance('hold')}>Hold ▶</button>
                <button className="btn" onClick={() => advance('watch')}>Watch ▶</button>
              </div>
              <div className="dim small">Buy/Sell &amp; set your orders, then Hold (ride) or Watch (stay alert) to move on.</div>
            </div>
          )}

          {phase === 'between' && (
            <div className="panel cr-forward">
              <div className="dim">The market moves. Your orders are live…</div>
              <LogList log={log} compact />
            </div>
          )}

          {phase === 'reveal' && outcome && (
            <RevealPanel data={data} outcome={outcome} log={log} onExit={onExit} onRetry={onRetry} />
          )}

          {showFeed && phase !== 'between' && data && (
            <div className="panel cr-feed-panel">
              <div className="panel-title">THE MOOD</div>
              <div className="cr-feed" ref={feedScrollRef}>
                {feed.map((it, k) => <FeedItem key={k} item={it} />)}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function FeedItem({ item }) {
  if (item.kind === 'news')
    return <div className="feed-item news"><span className="feed-tag">NEWS</span>{item.text}</div>
  return (
    <div className={'feed-item post ' + (item.tone || '')}>
      <div className="feed-handle">@{item.handle}</div>
      <div>{item.text}</div>
    </div>
  )
}

function LogList({ log, compact }) {
  return (
    <ul className={'cr-log' + (compact ? ' compact' : '')}>
      {log.map((e, k) => <li key={k} className={'log-' + e.type}>{e.text}</li>)}
    </ul>
  )
}

function RevealPanel({ data, outcome, log, onExit, onRetry }) {
  const { yourFinal, bhFinal, startEq } = outcome
  const youPct = (yourFinal / startEq - 1) * 100
  const bhPct = (bhFinal / startEq - 1) * 100
  const beatBH = yourFinal >= bhFinal
  const gap = Math.abs(yourFinal - bhFinal)

  return (
    <div className="panel cr-reveal">
      <div className="kicker">THE REVEAL</div>
      <h2>{data.reveal.headline}</h2>
      <div className="reveal-sub">{data.revealTitle}</div>

      <div className="cr-outcomes">
        <div className="cr-outcome yours">
          <span className="dot" style={{ background: '#5b8def' }} />
          <span className="lab">Your journey</span>
          <b style={{ color: '#5b8def' }}>{fmtMoney(yourFinal)}</b>
          <span className="chg">{fmtPct(youPct)}</span>
        </div>
        <div className="cr-outcome">
          <span className="dot" style={{ background: 'rgba(138,147,166,0.7)' }} />
          <span className="lab">If you'd done nothing (buy &amp; hold)</span>
          <b>{fmtMoney(bhFinal)}</b>
          <span className="chg">{fmtPct(bhPct)}</span>
        </div>
      </div>

      <p className="cr-verdict">
        {beatBH
          ? `Your decisions beat doing nothing by ${fmtMoney(gap)}. Active, and it paid — this time.`
          : `Doing nothing would have beaten you by ${fmtMoney(gap)}. All that activity cost you — the market's favorite lesson.`}
      </p>
      <p className="cr-honest dim small">But standing in it, no one knew. You own every decision — history owns the dice.</p>

      <div className="panel-title" style={{ marginTop: 14 }}>YOUR DECISIONS</div>
      <LogList log={log} />

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
