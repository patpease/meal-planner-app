import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import type { MealType, Recipe, Store, WeeklyPlan } from '../lib/db'
import {
  buildShoppingList,
  generateDraftPlan,
  type DraftMeal,
  type DraftShoppingItem,
  type PlanRequest,
} from '../lib/planner'
import {
  addPlan,
  applyPantryUsage,
  getLatestPlan,
  listPantryItems,
  listRecipes,
  readSettings,
  setStorePreference,
  updatePlan,
} from '../lib/repo'

type EditablePlan = Omit<WeeklyPlan, 'id'> & { id?: number }

const MEAL_TYPE_LABEL_PLURAL: Record<MealType, string> = { breakfast: 'Breakfasts', lunch: 'Lunches', dinner: 'Dinners' }
const STORE_LABEL: Record<Store, string> = { 'trader-joes': "Trader Joe's", 'whole-foods': 'Whole Foods' }

function draftToEditable(meals: DraftMeal[], snacks: string[], shoppingList: DraftShoppingItem[], notes: string): EditablePlan {
  return {
    weekStart: new Date().toISOString().slice(0, 10),
    createdDate: new Date().toISOString().slice(0, 10),
    meals: meals.map((m) => ({ mealType: m.mealType, recipeId: m.recipe.id, servings: m.servings, repeated: m.repeated })),
    snacks,
    shoppingList,
    notes,
  }
}

export default function Planner() {
  const latest = useLiveQuery(async () => (await getLatestPlan()) ?? null, [], undefined)
  const recipes = useLiveQuery(() => listRecipes(), [])

  const [plan, setPlan] = useState<EditablePlan | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [autoNotes, setAutoNotes] = useState<string[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || latest === undefined) return
    initialized.current = true
    if (latest) {
      setPlan(latest)
    } else {
      setShowForm(true)
    }
  }, [latest])

  const recipeById = new Map((recipes ?? []).map((r) => [r.id, r]))

  async function handleGenerate(request: PlanRequest) {
    setGenerating(true)
    const draft = await generateDraftPlan(request)
    setPlan(draftToEditable(draft.meals, draft.snacks, draft.shoppingList, draft.notes))
    setAutoNotes(draft.autoNotes)
    setShowForm(false)
    setGenerating(false)
  }

  async function persist(next: EditablePlan, patch: Partial<Omit<WeeklyPlan, 'id'>>) {
    setPlan(next)
    if (next.id !== undefined) await updatePlan(next.id, patch)
  }

  async function recomputeShoppingList(meals: EditablePlan['meals'], previous: WeeklyPlan['shoppingList']) {
    const [pantryItems, settings] = await Promise.all([listPantryItems(), readSettings()])
    const draftMeals: DraftMeal[] = meals
      .map((m) => {
        const recipe = recipeById.get(m.recipeId)
        return recipe ? { mealType: m.mealType, recipe, servings: m.servings, repeated: !!m.repeated } : null
      })
      .filter((m): m is DraftMeal => m !== null)
    const { items } = buildShoppingList(draftMeals, pantryItems, settings)
    const prevChecked = new Map(previous.map((i) => [i.name.toLowerCase(), i.checked]))
    return items.map((i) => ({ ...i, checked: prevChecked.get(i.name.toLowerCase()) ?? false }))
  }

  async function handleServingsChange(index: number, servings: number) {
    if (!plan) return
    const meals = plan.meals.map((m, i) => (i === index ? { ...m, servings } : m))
    const shoppingList = await recomputeShoppingList(meals, plan.shoppingList)
    await persist({ ...plan, meals, shoppingList }, { meals, shoppingList })
  }

  async function handleSwapRecipe(index: number, recipeId: number) {
    if (!plan) return
    const meals = plan.meals.map((m, i) => (i === index ? { ...m, recipeId, repeated: false } : m))
    const shoppingList = await recomputeShoppingList(meals, plan.shoppingList)
    await persist({ ...plan, meals, shoppingList }, { meals, shoppingList })
  }

  async function handleStoreChange(itemIndex: number, store: Store, itemName: string) {
    if (!plan) return
    const shoppingList = plan.shoppingList.map((item, i) => (i === itemIndex ? { ...item, store } : item))
    await persist({ ...plan, shoppingList }, { shoppingList })
    await setStorePreference(itemName, store)
  }

  async function handleToggleChecked(itemIndex: number) {
    if (!plan) return
    const shoppingList = plan.shoppingList.map((item, i) => (i === itemIndex ? { ...item, checked: !item.checked } : item))
    await persist({ ...plan, shoppingList }, { shoppingList })
  }

  async function handleNotesChange(notes: string) {
    if (!plan) return
    await persist({ ...plan, notes }, { notes })
  }

  async function handleSnacksChange(snacksText: string) {
    if (!plan) return
    const snacks = snacksText.split(',').map((s) => s.trim()).filter(Boolean)
    await persist({ ...plan, snacks }, { snacks })
  }

  async function handleSave() {
    if (!plan || plan.id !== undefined) return
    const { id: _ignored, ...rest } = plan as WeeklyPlan
    const newId = (await addPlan(rest)) as number
    const usedNames = plan.meals.flatMap((m) => recipeById.get(m.recipeId)?.ingredients.map((i) => i.name) ?? [])
    await applyPantryUsage(usedNames)
    setPlan({ ...plan, id: newId })
  }

  function handlePlanNewWeek() {
    setPlan(null)
    setAutoNotes([])
    setShowForm(true)
  }

  if (latest === undefined || recipes === undefined) return null

  if (showForm) {
    return <PlanForm onGenerate={handleGenerate} generating={generating} onCancel={plan ? () => setShowForm(false) : undefined} />
  }

  if (!plan) return null

  return (
    <PlanView
      plan={plan}
      recipeById={recipeById}
      allRecipes={recipes}
      autoNotes={autoNotes}
      onServingsChange={handleServingsChange}
      onSwapRecipe={handleSwapRecipe}
      onStoreChange={handleStoreChange}
      onToggleChecked={handleToggleChecked}
      onNotesChange={handleNotesChange}
      onSnacksChange={handleSnacksChange}
      onSave={handleSave}
      onPlanNewWeek={handlePlanNewWeek}
    />
  )
}

function PlanForm({
  onGenerate,
  generating,
  onCancel,
}: {
  onGenerate: (request: PlanRequest) => void
  generating: boolean
  onCancel?: () => void
}) {
  const [breakfastCount, setBreakfastCount] = useState(0)
  const [lunchCount, setLunchCount] = useState(0)
  const [dinnerCount, setDinnerCount] = useState(0)
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onGenerate({ breakfastCount, lunchCount, dinnerCount, notes })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-24">
      <h1 className="text-2xl font-semibold text-sage-800">Plan this week</h1>
      <p className="mt-1 text-sm text-sage-600">
        How many of each meal do you need? This is always different week to week.
      </p>

      <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sage-700">Breakfasts</span>
          <input
            type="number"
            min={0}
            className="input"
            value={breakfastCount}
            onChange={(e) => setBreakfastCount(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sage-700">Lunches</span>
          <input
            type="number"
            min={0}
            className="input"
            value={lunchCount}
            onChange={(e) => setLunchCount(Number(e.target.value) || 0)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sage-700">Dinners</span>
          <input
            type="number"
            min={0}
            className="input"
            value={dinnerCount}
            onChange={(e) => setDinnerCount(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <label className="mt-4 block max-w-md">
        <span className="mb-1 block text-sm font-medium text-sage-700">This week's preferences (optional)</span>
        <textarea
          className="input"
          rows={3}
          placeholder="A cuisine theme, guests coming over, an ingredient to use up..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={generating || breakfastCount + lunchCount + dinnerCount === 0}
          className="rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700 disabled:opacity-50"
        >
          {generating ? 'Building your week...' : 'Generate plan'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-stone-200 px-5 py-2.5 font-medium text-sage-700">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function PlanView({
  plan,
  recipeById,
  allRecipes,
  autoNotes,
  onServingsChange,
  onSwapRecipe,
  onStoreChange,
  onToggleChecked,
  onNotesChange,
  onSnacksChange,
  onSave,
  onPlanNewWeek,
}: {
  plan: EditablePlan
  recipeById: Map<number, Recipe>
  allRecipes: Recipe[]
  autoNotes: string[]
  onServingsChange: (index: number, servings: number) => void
  onSwapRecipe: (index: number, recipeId: number) => void
  onStoreChange: (index: number, store: Store, itemName: string) => void
  onToggleChecked: (index: number) => void
  onNotesChange: (notes: string) => void
  onSnacksChange: (snacksText: string) => void
  onSave: () => void
  onPlanNewWeek: () => void
}) {
  const isSaved = plan.id !== undefined
  const byType = (type: MealType) => plan.meals.map((m, i) => ({ ...m, index: i })).filter((m) => m.mealType === type)
  const storeGroups: Store[] = ['trader-joes', 'whole-foods']

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-sage-800">
          {isSaved ? 'This week' : 'Draft plan'}
        </h1>
        <button
          type="button"
          onClick={onPlanNewWeek}
          className="rounded-lg border border-sage-300 px-3 py-2 text-sm font-medium text-sage-700 hover:bg-sage-50"
        >
          Plan a new week
        </button>
      </div>

      {autoNotes.length > 0 && (
        <div className="mt-3 space-y-1">
          {autoNotes.map((note, i) => (
            <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {note}
            </p>
          ))}
        </div>
      )}

      {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((type) => {
        const meals = byType(type)
        if (meals.length === 0) return null
        return (
          <section key={type} className="mt-6">
            <h2 className="font-semibold text-sage-800">
              {MEAL_TYPE_LABEL_PLURAL[type]} ({meals.length})
            </h2>
            <div className="mt-2 space-y-2">
              {meals.map(({ index, recipeId, servings, repeated }) => {
                const recipe = recipeById.get(recipeId)
                const options = allRecipes.filter((r) => r.mealType === type)
                return (
                  <div key={index} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      {recipe ? (
                        <Link to={`/recipes/${recipe.id}`} className="font-medium text-sage-800 hover:underline">
                          {recipe.name}
                        </Link>
                      ) : (
                        <span className="text-sage-400">Recipe removed</span>
                      )}
                      {repeated && <span className="shrink-0 text-xs text-amber-600">repeat</span>}
                    </div>
                    {recipe && (
                      <p className="mt-0.5 text-xs text-sage-500">
                        {recipe.prepMinutes} min · {recipe.pro || recipe.base || recipe.veg || recipe.engine}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-1.5">
                        Servings
                        <input
                          type="number"
                          min={1}
                          className="w-16 rounded-lg border border-stone-300 px-2 py-1"
                          value={servings}
                          onChange={(e) => onServingsChange(index, Number(e.target.value) || 1)}
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        Swap
                        <select
                          className="rounded-lg border border-stone-300 px-2 py-1"
                          value={recipeId}
                          onChange={(e) => onSwapRecipe(index, Number(e.target.value))}
                        >
                          {options.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="mt-6">
        <h2 className="font-semibold text-sage-800">Snacks</h2>
        <input
          className="input mt-2"
          defaultValue={plan.snacks.join(', ')}
          onBlur={(e) => onSnacksChange(e.target.value)}
        />
      </section>

      <section className="mt-6">
        <h2 className="font-semibold text-sage-800">Shopping list</h2>
        {storeGroups.map((store) => {
          const items = plan.shoppingList.map((item, i) => ({ ...item, index: i })).filter((i) => i.store === store)
          if (items.length === 0) return null
          return (
            <div key={store} className="mt-2">
              <h3 className="text-sm font-medium text-sage-600">{STORE_LABEL[store]}</h3>
              <ul className="mt-1 space-y-1">
                {items.map((item) => (
                  <li key={item.index} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!item.checked}
                      onChange={() => onToggleChecked(item.index)}
                      className="h-4 w-4 accent-sage-500"
                    />
                    <span className={`flex-1 text-sm ${item.checked ? 'text-sage-400 line-through' : 'text-sage-800'}`}>
                      {item.name}
                      {item.qty ? ` (${item.qty}${item.unit ? ` ${item.unit}` : ''})` : ''}
                      {item.restock ? ' · restock' : ''}
                    </span>
                    <select
                      value={item.store}
                      onChange={(e) => onStoreChange(item.index, e.target.value as Store, item.name)}
                      className="rounded-lg border border-stone-300 px-1.5 py-1 text-xs"
                    >
                      {storeGroups.map((s) => (
                        <option key={s} value={s}>
                          {STORE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {plan.shoppingList.length === 0 && <p className="mt-2 text-sm text-sage-500">Nothing needed — pantry has you covered.</p>}
      </section>

      <section className="mt-6 max-w-xl">
        <h2 className="font-semibold text-sage-800">Notes</h2>
        <textarea
          className="input mt-2"
          rows={3}
          defaultValue={plan.notes}
          onBlur={(e) => onNotesChange(e.target.value)}
        />
      </section>

      {!isSaved && (
        <button
          type="button"
          onClick={onSave}
          className="mt-6 rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700"
        >
          Save plan
        </button>
      )}
    </div>
  )
}
