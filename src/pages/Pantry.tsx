import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import type { PantryItem, PantryLevel } from '../lib/db'
import { PantryIcon, guessPantryIcon, isPantryIconKey } from '../lib/pantryIcons'
import { deletePantryItem, listPantryItems, updatePantryItem } from '../lib/repo'

const LEVEL_ORDER: PantryLevel[] = ['empty', 'low', 'half', 'full']
const LEVEL_LABEL: Record<PantryLevel, string> = { empty: 'Empty', low: 'Low', half: 'Half', full: 'Full' }
const LEVEL_COLOR: Record<PantryLevel, string> = {
  empty: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  half: 'bg-sage-100 text-sage-700',
  full: 'bg-sage-200 text-sage-800',
}

export default function Pantry() {
  const items = useLiveQuery(listPantryItems, [])

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-sage-800">Pantry</h1>
        <Link
          to="/pantry/new"
          className="rounded-lg bg-sage-500 px-3 py-2 text-sm font-medium text-white hover:bg-sage-600"
        >
          Add item
        </Link>
      </div>

      {items && items.length === 0 && (
        <p className="mt-6 text-sage-600">
          Nothing tracked yet.{' '}
          <Link to="/pantry/new" className="font-medium text-sage-700 underline">
            Add your first item
          </Link>{' '}
          or import from the old meal-planner skill in Settings.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {items?.map((item) => (
          <PantryRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}

function PantryRow({ item }: { item: PantryItem }) {
  const icon = item.icon && isPantryIconKey(item.icon) ? item.icon : guessPantryIcon(item.name)
  const isLevelBased = item.level !== undefined || item.qty === undefined

  async function stepLevel(direction: 1 | -1) {
    const current = item.level ?? 'full'
    const index = LEVEL_ORDER.indexOf(current)
    const next = LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, Math.max(0, index + direction))]
    await updatePantryItem(item.id, { level: next })
  }

  async function stepQty(delta: number) {
    const next = Math.max(0, (item.qty ?? 0) + delta)
    await updatePantryItem(item.id, { qty: next })
  }

  async function handleDelete() {
    if (!confirm(`Remove "${item.name}" from your pantry?`)) return
    await deletePantryItem(item.id)
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <PantryIcon icon={icon} className="h-8 w-8 shrink-0 text-sage-500 [&_svg]:h-8 [&_svg]:w-8" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sage-800">{item.name}</p>
        {isLevelBased ? (
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${LEVEL_COLOR[item.level ?? 'full']}`}>
            {LEVEL_LABEL[item.level ?? 'full']}
          </span>
        ) : (
          <span className="text-xs text-sage-500">
            {item.qty} {item.unit ?? ''}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => (isLevelBased ? stepLevel(-1) : stepQty(-1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 text-sage-600 hover:bg-sage-50"
          aria-label="Decrease"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => (isLevelBased ? stepLevel(1) : stepQty(1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 text-sage-600 hover:bg-sage-50"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      <Link
        to={`/pantry/${item.id}/edit`}
        className="shrink-0 rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-medium text-sage-600 hover:bg-sage-50"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </li>
  )
}
