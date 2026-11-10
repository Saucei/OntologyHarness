// Tier-4 usability fix (F1): nav Move up/down must operate on the VISIBLE order.
// The rendered nav is partitioned favorites-first (see App.tsx orderedNav), so a raw
// swap in the hidden navOrderLocal array can cross the partition boundary and look
// like a silent no-op. This helper swaps in visible space, then rebuilds the hidden
// order as [favourites in new visible order, rest in new visible order] — every move
// either changes what the user sees or is a true boundary no-op (already at top/bottom).

export function moveVisibleOrder(
  visible: string[],
  favIds: string[],
  target: string,
  dir: 1 | -1,
): string[] | null {
  const i = visible.indexOf(target)
  if (i === -1) return null
  const j = Math.min(visible.length - 1, Math.max(0, i + dir))
  if (i === j) return null
  const nextVis = [...visible]
  const [item] = nextVis.splice(i, 1)
  nextVis.splice(j, 0, item)
  const faved = nextVis.filter(id => favIds.includes(id))
  const rest = nextVis.filter(id => !favIds.includes(id))
  return [...faved, ...rest]
}
