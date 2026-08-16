import { useState } from 'react'
import type { MealType } from '../lib/db'
import { parsePantryText, parseRecipesText, type ParsedPantryItem, type ParsedRecipe } from '../lib/importParser'
import { bulkImportPantryItems, bulkImportRecipes } from '../lib/repo'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

function RecipeImportSection() {
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedRecipe[] | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  function handleParse() {
    setParsed(parseRecipesText(text, mealType))
    setStatus(null)
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return
    await bulkImportRecipes(parsed)
    setStatus(`Imported ${parsed.length} ${mealType} recipe${parsed.length === 1 ? '' : 's'}.`)
    setParsed(null)
    setText('')
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-sage-800">Recipes</h2>
      <p className="mt-1 text-sm text-sage-600">
        Paste the contents of one <code>favorite-recipes-*</code> memory file at a time.
      </p>

      <label className="mt-3 block text-sm font-medium text-sage-700">
        Meal type
        <select
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2"
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <textarea
        className="mt-3 h-40 w-full rounded-lg border border-stone-300 p-3 font-mono text-sm"
        placeholder="- Recipe name — source: ...&#10;  PRO: ... | BASE: ... | VEG: ... | ENGINE: ...&#10;  Prep: 15 min · Tags: dinner&#10;  Steps: ..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-sage-500 px-4 py-2 text-sm font-medium text-white hover:bg-sage-600 disabled:opacity-50"
          onClick={handleParse}
          disabled={!text.trim()}
        >
          Preview
        </button>
        {parsed && parsed.length > 0 && (
          <button
            type="button"
            className="rounded-lg bg-sage-700 px-4 py-2 text-sm font-medium text-white hover:bg-sage-800"
            onClick={handleImport}
          >
            Import {parsed.length} recipe{parsed.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {parsed && (
        <ul className="mt-3 space-y-1 text-sm text-sage-700">
          {parsed.length === 0 && <li>No recipes recognized in that text.</li>}
          {parsed.map((r, i) => (
            <li key={i} className="rounded bg-sage-50 px-2 py-1">
              {r.name} · {r.prepMinutes} min{r.tags.length > 0 ? ` · ${r.tags.join(', ')}` : ''}
            </li>
          ))}
        </ul>
      )}

      {status && <p className="mt-3 text-sm text-sage-600">{status}</p>}
    </section>
  )
}

function PantryImportSection() {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedPantryItem[] | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  function handleParse() {
    setParsed(parsePantryText(text))
    setStatus(null)
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return
    await bulkImportPantryItems(parsed)
    setStatus(`Imported ${parsed.length} pantry item${parsed.length === 1 ? '' : 's'}.`)
    setParsed(null)
    setText('')
  }

  return (
    <section className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-sage-800">Pantry</h2>
      <p className="mt-1 text-sm text-sage-600">
        Paste the contents of the <code>pantry-inventory</code> memory file.
      </p>

      <textarea
        className="mt-3 h-32 w-full rounded-lg border border-stone-300 p-3 font-mono text-sm"
        placeholder="- Item name — Full · updated 2026-08-01"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-sage-500 px-4 py-2 text-sm font-medium text-white hover:bg-sage-600 disabled:opacity-50"
          onClick={handleParse}
          disabled={!text.trim()}
        >
          Preview
        </button>
        {parsed && parsed.length > 0 && (
          <button
            type="button"
            className="rounded-lg bg-sage-700 px-4 py-2 text-sm font-medium text-white hover:bg-sage-800"
            onClick={handleImport}
          >
            Import {parsed.length} item{parsed.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {parsed && (
        <ul className="mt-3 space-y-1 text-sm text-sage-700">
          {parsed.length === 0 && <li>No pantry items recognized in that text.</li>}
          {parsed.map((p, i) => (
            <li key={i} className="rounded bg-sage-50 px-2 py-1">
              {p.name} · {p.level ?? `${p.qty ?? ''} ${p.unit ?? ''}`.trim()}
            </li>
          ))}
        </ul>
      )}

      {status && <p className="mt-3 text-sm text-sage-600">{status}</p>}
    </section>
  )
}

export default function Import() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-sage-800">Import existing data</h1>
      <p className="mt-2 text-sage-600">
        Bring over recipes and pantry stock saved through the old meal-planner Claude skill. In a
        claude.ai chat, ask it to print the contents of your <code>favorite-recipes-*</code> and{' '}
        <code>pantry-inventory</code> memory files, then paste each one below.
      </p>

      <div className="mt-4">
        <RecipeImportSection />
        <PantryImportSection />
      </div>
    </div>
  )
}
