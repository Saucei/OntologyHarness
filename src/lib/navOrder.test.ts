import { describe, expect, it } from 'vitest'
import { moveVisibleOrder } from './navOrder'

const FAV = ['graph', 'workshop', 'swarms']

describe('moveVisibleOrder', () => {
  it('swaps two adjacent favourites and honours the visible result', () => {
    const visible = ['graph', 'workshop', 'swarms', 'studio', 'data']
    const next = moveVisibleOrder(visible, FAV, 'workshop', 1)
    // Rebuilt hidden order: favourites in new visible order, rest unchanged.
    expect(next).toEqual(['graph', 'swarms', 'workshop', 'studio', 'data'])
    // And re-partitioning reproduces the intended visible swap.
    const faved = next!.filter(id => FAV.includes(id))
    expect(faved).toEqual(['graph', 'swarms', 'workshop'])
  })

  it('moves an unpinned module to the top of the unpinned block when moved up across the boundary', () => {
    const visible = ['graph', 'workshop', 'swarms', 'studio', 'data']
    const next = moveVisibleOrder(visible, FAV, 'studio', -1)
    // 'studio' cannot enter the favourites block without pinning, but it does
    // become the first unpinned entry — a visible change, not a silent no-op.
    const rest = next!.filter(id => !FAV.includes(id))
    expect(rest[0]).toBe('studio')
    const faved = next!.filter(id => FAV.includes(id))
    expect(faved).toEqual(FAV)
  })

  it('keeps a favourite inside the favourites block when moved down across the boundary', () => {
    const visible = ['graph', 'workshop', 'swarms', 'studio', 'data']
    const next = moveVisibleOrder(visible, FAV, 'swarms', 1)
    const faved = next!.filter(id => FAV.includes(id))
    expect(faved).toEqual(FAV) // zone membership is governed by pin state, not moves
  })

  it('swaps two unpinned modules inside the unpinned block', () => {
    const visible = ['graph', 'workshop', 'swarms', 'studio', 'data']
    const next = moveVisibleOrder(visible, FAV, 'data', -1)
    const rest = next!.filter(id => !FAV.includes(id))
    expect(rest).toEqual(['data', 'studio'])
  })

  it('is a no-op at the very top', () => {
    const visible = ['graph', 'workshop', 'swarms', 'studio']
    expect(moveVisibleOrder(visible, FAV, 'graph', -1)).toBeNull()
  })

  it('returns null for an unknown target', () => {
    expect(moveVisibleOrder(['graph', 'studio'], FAV, 'nope', 1)).toBeNull()
  })
})
