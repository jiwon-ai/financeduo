import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getCrossroads } from './api'
import { createAudio } from './audio'

const COUNTDOWN = 15
const FWD_MS = 26

const fmtMoney = (x) => '$' + Math.round(x ?? 0).toLocaleString('en-US')
const fmtPct = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`

const COLORS = { sell: '#e3486b', hold: '#5b8def', buy: '#26a17b' }
const GHOST = 'rgba(138,147,166,0.32)'

export default function Crossroads({ onExit, onRetry }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | setup | forward | reveal
  const [choice, setChoice] = useState(null)
  const [secs, setSecs] = useState(COUNTDOWN)
  const [outcome, setOutcome] = useState(null)

  const priceElRef = useRef(null)
  const eqElRef = useRef(null)
  const R = useRef({})
  const fwdRef = useRef(null)

  useEffect(() => {
    getCrossroads('covid2020')
      .then((d) => { setData(d); setPhase('setup') })
      .catch((e) => setErr(String(e)))
  }, [])

  // init charts once, when data lands
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
    const pc = createChart(priceElRef.current, { ...common, width: priceElRef.current.clientWidth, height: 320 })
    const candle = pc.addCandlestickSeries({
      upColor: '#26a17b', downColor: '#e3486b',
      wickUpColor: '#26a17b', wickDownColor: '#e3486b', borderVisible: false,
    })
    const ec = createChart(eqElRef.current, { ...common, width: eqElRef.current.clientWidth, height: 150 })
    const lineSell = ec.addLineSeries({ color: GHOST, lineWidth: 1 })
    const lineHold = ec.addLineSeries({ color: GHOST, lineWidth: 1 })
    const lineBuy = ec.addLineSeries({ color: GHOST, lineWidth: 1 })

    const di = data.decisionIndex
    const entryPrice = data.bars[data.entryIndex].c
    const shares0 = data.initialInvest / entryPrice
    const holdEq = (i) => shares0 * data.bars[i].c + data.reserve

    candle.setData(
      data.bars.slice(0, di + 1).map((b) => ({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c }))
    )
    const setupLine = data.bars.slice(0, di + 1).map((b, i) => ({ time: b.date, value: holdEq(i) }))
    lineSell.setData(setupLine)
    lineHold.setData(setupLine)
    lineBuy.setData(setupLine)
    pc.timeScale().fitContent()
    ec.timeScale().fitContent()

    const audio = createAudio()
    audio.resume()
    audio.update(0.2) // a low unease under the decision

    R.current = { pc, candle, ec, lineSell, lineHold, lineBuy, shares0, entryPrice, audio }

    const onResize = () => {
      pc.applyOptions({ width: priceElRef.current.clientWidth })
      ec.applyOptions({ width: eqElRef.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (fwdRef.current) clearInterval(fwdRef.current)
      try { audio.dispose() } catch (e) { /* noop */ }
      pc.remove()
      ec.remove()
    }
  }, [data])

  // countdown — indecision is itself a choice (you hold)
  useEffect(() => {
    if (phase !== 'setup') return
    if (secs <= 0) { lock('hold'); return }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secs])

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
      s.applyOptions({
        color: k === id ? COLORS[k] : GHOST,
        lineWidth: k === id ? 3 : 1,
        lineStyle: k === id ? 0 : 2,
      })
    )

    let i = di
    fwdRef.current = setInterval(() => {
      i++
      if (i >= data.bars.length) {
        clearInterval(fwdRef.current)
        finishForward(id, eqAt)
        return
      }
      const b = data.bars[i]
      R.current.candle.update({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })
      R.current.lineSell.update({ time: b.date, value: eqAt('sell', i) })
      R.current.lineHold.update({ time: b.date, value: eqAt('hold', i) })
      R.current.lineBuy.update({ time: b.date, value: eqAt('buy', i) })
      R.current.pc.timeScale().fitContent()
      R.current.ec.timeScale().fitContent()
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

  const ch = choice && data ? data.choices.find((c) => c.id === choice) : null

  return (
    <div className="game crossroads">
      <header className="topbar">
        <div className="brand">CROSSROADS</div>
        <div className="day dim">a real decision · real consequences</div>
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
          {phase === 'setup' && data && (
            <SetupPanel data={data} secs={secs} onChoose={lock} />
          )}
          {phase === 'forward' && (
            <div className="panel cr-forward">
              <div className="cr-stamp" style={{ color: COLORS[choice] }}>{ch?.stamp}</div>
              <div className="dim">The record is being written…</div>
              <button className="btn end" style={{ marginTop: 14 }} onClick={() => {
                if (fwdRef.current) clearInterval(fwdRef.current)
                // jump to the end
                const last = data.bars.length - 1
                const b = data.bars[last]
                R.current.candle.update({ time: b.date, open: b.o, high: b.h, low: b.l, close: b.c })
                ;['sell', 'hold', 'buy'].forEach((k) => {
                  for (let j = data.decisionIndex + 1; j <= last; j++) {
                    const bb = data.bars[j]
                    R.current['line' + k[0].toUpperCase() + k.slice(1)].update({ time: bb.date, value: R.current.eqAt(k, j) })
                  }
                })
                R.current.pc.timeScale().fitContent(); R.current.ec.timeScale().fitContent()
                finishForward(choice, R.current.eqAt)
              }}>Skip ▶▶</button>
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

function SetupPanel({ data, secs, onChoose }) {
  const di = data.decisionIndex
  const entryPrice = data.bars[data.entryIndex].c
  const dp = data.bars[di].c
  const posNow = (data.initialInvest / entryPrice) * dp
  const downPct = (dp / entryPrice - 1) * 100
  return (
    <>
      <div className="panel cr-situation">
        <div className="panel-title">THE SITUATION</div>
        <p className="cr-context">{data.context}</p>
        <div className="cr-standing">
          <div><span className="dim">Your position</span><b className="neg">{fmtMoney(posNow)}</b></div>
          <div><span className="dim">Down</span><b className="neg">{fmtPct(downPct)}</b></div>
          <div><span className="dim">Cash reserve</span><b>{fmtMoney(data.reserve)}</b></div>
        </div>
        <p className="cr-question">{data.question}</p>
      </div>

      <div className="panel cr-choices">
        <div className={'cr-timer' + (secs <= 5 ? ' urgent' : '')}>
          DECIDE · 0:{String(secs).padStart(2, '0')}
        </div>
        {data.choices.map((c) => (
          <button key={c.id} className={'cr-choice ' + c.id} onClick={() => onChoose(c.id)}>
            <b>{c.label}</b>
            <span>{c.sub}</span>
          </button>
        ))}
        <div className="dim small">Once you choose, it's locked. Indecision counts as holding.</div>
      </div>
    </>
  )
}

function RevealPanel({ data, choice, outcome, onExit, onRetry }) {
  const { finals, startEq, best } = outcome
  const order = ['sell', 'hold', 'buy']
  const yourFinal = finals[choice]
  const bestFinal = finals[best]
  const gap = bestFinal - yourFinal
  const ch = data.choices.find((c) => c.id === choice)

  const verdicts = {
    buy: 'You bought the fear. The boldest call — and history rewarded it.',
    hold: 'You held through the terror. The hardest "do nothing" there is.',
    sell: 'You capitulated near the bottom. The safe-feeling move that locked the loss.',
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
        <p className="cr-gap">The path not taken: <b>{data.choices.find((c) => c.id === best).label}</b> would have left you {fmtMoney(gap)} richer.</p>
      )}
      <p className="cr-honest dim small">
        But standing there, in the fear, no one knew. You own the decision — history owns the dice.
      </p>

      <ul className="facts-list">
        {data.reveal.facts.map((f, k) => (
          <li key={k}>{f}</li>
        ))}
      </ul>

      <div className="cr-actions">
        <button className="btn-primary" onClick={onRetry}>Try again →</button>
        <button className="btn" onClick={onExit}>← Menu</button>
      </div>
    </div>
  )
}
