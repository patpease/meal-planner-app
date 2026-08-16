import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import type { PantryLevel } from '../lib/db'
import { PANTRY_ICON_KEYS, PantryIcon, guessPantryIcon, isPantryIconKey, type PantryIconKey } from '../lib/pantryIcons'
import { getPantryItem, updatePantryItem, upsertPantryItem } from '../lib/repo'

const LEVELS: PantryLevel[] = ['full', 'half', 'low', 'empty']

type StockMode = 'level' | 'qty'

export default function PantryItemForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined
  const itemId = isEdit ? Number(id) : undefined
  const navigate = useNavigate()

  const existing = useLiveQuery(() => (itemId !== undefined ? getPantryItem(itemId) : undefined), [itemId])

  const [name, setName] = useState('')
  const [mode, setMode] = useState<StockMode>('level')
  const [level, setLevel] = useState<PantryLevel>('full')
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('')
  const [icon, setIcon] = useState<PantryIconKey>('grocery')
  const [iconTouched, setIconTouched] = useState(false)
  const [loaded, setLoaded] = useState(!isEdit)

  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setName(existing.name)
      setMode(existing.qty !== undefined ? 'qty' : 'level')
      setLevel(existing.level ?? 'full')
      setQty(existing.qty ?? 1)
      setUnit(existing.unit ?? '')
      setIcon(existing.icon && isPantryIconKey(existing.icon) ? existing.icon : guessPantryIcon(existing.name))
      setIconTouched(true)
      setLoaded(true)
    }
  }, [isEdit, existing, loaded])

  useEffect(() => {
    if (!iconTouched && name.trim()) setIcon(guessPantryIcon(name))
  }, [name, iconTouched])

  if (!loaded) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      icon,
      updatedDate: new Date().toISOString().slice(0, 10),
      ...(mode === 'level' ? { level, qty: undefined, unit: undefined } : { qty, unit: unit.trim() || undefined, level: undefined }),
    }

    if (isEdit && itemId !== undefined) {
      await updatePantryItem(itemId, payload)
    } else {
      await upsertPantryItem(payload)
    }
    navigate('/pantry')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-24">
      <h1 className="text-2xl font-semibold text-sage-800">{isEdit ? 'Edit pantry item' : 'Add pantry item'}</h1>

      <div className="mt-4 max-w-xl space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sage-700">Name</span>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <fieldset className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === 'level'} onChange={() => setMode('level')} />
            Stock level
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={mode === 'qty'} onChange={() => setMode('qty')} />
            Exact quantity
          </label>
        </fieldset>

        {mode === 'level' ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-sage-700">Level</span>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as PantryLevel)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-sage-700">Quantity</span>
              <input
                type="number"
                min={0}
                className="input"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-sage-700">Unit</span>
              <input className="input" placeholder="cans, lbs, ..." value={unit} onChange={(e) => setUnit(e.target.value)} />
            </label>
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm font-medium text-sage-700">Icon</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {PANTRY_ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                title={key}
                onClick={() => {
                  setIcon(key)
                  setIconTouched(true)
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  icon === key ? 'border-sage-500 bg-sage-100' : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <PantryIcon icon={key} className="h-5 w-5 text-sage-600 [&_svg]:h-5 [&_svg]:w-5" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700"
        >
          {isEdit ? 'Save changes' : 'Save item'}
        </button>
      </div>
    </form>
  )
}
