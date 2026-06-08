export async function getScenario(id) {
  const r = await fetch(`/api/scenarios/${id}`)
  if (!r.ok) throw new Error('failed to load scenario')
  return r.json()
}

export async function getCrossroads(id) {
  const r = await fetch(`/api/crossroads/${id}`)
  if (!r.ok) throw new Error('failed to load crossroads')
  return r.json()
}

export async function getSlice(id) {
  const r = await fetch(`/api/slice/${id}`)
  if (!r.ok) throw new Error('failed to load slice')
  return r.json()
}

export async function scoreRun(id, equity, exposure) {
  const r = await fetch(`/api/scenarios/${id}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equity, exposure }),
  })
  if (!r.ok) throw new Error('failed to score run')
  return r.json()
}
