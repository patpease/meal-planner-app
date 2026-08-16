import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import StepTimer from '../components/StepTimer'
import { parseStepMinutes } from '../lib/duration'
import { getRecipe } from '../lib/repo'
import { usePhotoUrl } from '../lib/usePhotoUrl'
import { useWakeLock } from '../lib/useWakeLock'

const SWIPE_THRESHOLD = 50
const INTERACTIVE_SELECTOR = 'button, input, a, select, textarea'

export default function CookingMode() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const recipe = useLiveQuery(async () => (await getRecipe(recipeId)) ?? null, [recipeId])
  const photoUrl = usePhotoUrl(recipe?.photoIds[0])
  useWakeLock()

  const [stepIndex, setStepIndex] = useState(0)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  if (recipe === undefined) return null
  if (recipe === null) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sage-600">Recipe not found.</p>
        <Link to="/recipes" className="text-sage-700 underline">
          Back to recipes
        </Link>
      </div>
    )
  }

  const steps = recipe.steps
  const step = steps[stepIndex]
  const suggestedMinutes = step ? parseStepMinutes(step) : undefined

  function goNext() {
    setStepIndex((i) => Math.min(steps.length - 1, i + 1))
  }
  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function toggleIngredient(index: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta > SWIPE_THRESHOLD) goPrev()
    else if (delta < -SWIPE_THRESHOLD) goNext()
  }

  function handleTapZone(e: React.MouseEvent<HTMLDivElement>, direction: 'prev' | 'next') {
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
    if (direction === 'prev') goPrev()
    else goNext()
  }

  const ingredientsList = (
    <ul className="space-y-2">
      {recipe.ingredients.map((ing, i) => (
        <li key={i}>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-sage-500"
              checked={checked.has(i)}
              onChange={() => toggleIngredient(i)}
            />
            <span className={checked.has(i) ? 'text-sage-400 line-through' : 'text-sage-800'}>
              {ing.qty ? `${ing.qty} ` : ''}
              {ing.unit ? `${ing.unit} ` : ''}
              {ing.name}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="flex h-svh flex-col bg-stone-50">
      <header className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <Link to={`/recipes/${recipeId}`} className="text-sage-600 hover:text-sage-800" aria-label="Exit cooking mode">
          ✕
        </Link>
        <h1 className="truncate text-center font-medium text-sage-800">{recipe.name}</h1>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-sage-700 md:hidden"
          onClick={() => setIngredientsOpen((v) => !v)}
        >
          Ingredients
        </button>
        <span className="hidden w-16 md:inline" />
      </header>

      <div className="relative flex flex-1 overflow-hidden md:flex-row">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-4 md:block">
          <h2 className="mb-2 font-semibold text-sage-800">Ingredients</h2>
          {photoUrl && <img src={photoUrl} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />}
          {ingredientsList}
        </aside>

        {ingredientsOpen && (
          <div className="absolute inset-0 z-10 flex flex-col bg-white p-4 md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-sage-800">Ingredients</h2>
              <button type="button" onClick={() => setIngredientsOpen(false)} className="text-sage-600" aria-label="Close ingredients">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto">{ingredientsList}</div>
          </div>
        )}

        <main
          className="relative flex flex-1 select-none flex-col items-center justify-center overflow-y-auto p-6 text-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-y-0 left-0 w-1/4" onClick={(e) => handleTapZone(e, 'prev')} />
          <div className="absolute inset-y-0 right-0 w-3/4" onClick={(e) => handleTapZone(e, 'next')} />

          <p className="relative text-sm font-medium text-sage-500">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <p className="relative mt-4 max-w-xl text-2xl leading-relaxed text-sage-900 md:text-3xl">{step}</p>

          {suggestedMinutes !== undefined && (
            <div className="relative mt-6">
              <StepTimer suggestedMinutes={suggestedMinutes} />
            </div>
          )}

          <div className="relative mt-8 flex items-center gap-2">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === stepIndex ? 'bg-sage-600' : 'bg-sage-200'}`}
              />
            ))}
          </div>

          <div className="relative mt-8 flex gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="rounded-lg border border-stone-300 px-5 py-2.5 font-medium text-sage-700 disabled:opacity-30"
            >
              Back
            </button>
            {stepIndex < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700"
              >
                Next
              </button>
            ) : (
              <Link
                to={`/recipes/${recipeId}`}
                className="rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700"
              >
                Done
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
