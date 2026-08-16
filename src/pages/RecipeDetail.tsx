import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePhotoUrl } from '../lib/usePhotoUrl'
import { deleteRecipe, getRecipe, readSettings } from '../lib/repo'

const MEAL_TYPE_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' } as const
const STORE_LABEL = { 'trader-joes': "Trader Joe's", 'whole-foods': 'Whole Foods' } as const

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()

  const recipe = useLiveQuery(async () => (await getRecipe(recipeId)) ?? null, [recipeId])
  const settings = useLiveQuery(readSettings, [], undefined)
  const photoUrl = usePhotoUrl(recipe?.photoIds[0])

  if (recipe === undefined || !settings) return null
  if (recipe === null) {
    return (
      <div className="p-4">
        <p className="text-sage-600">Recipe not found.</p>
        <Link to="/recipes" className="text-sage-700 underline">
          Back to recipes
        </Link>
      </div>
    )
  }

  async function handleDelete() {
    if (!confirm(`Delete "${recipe!.name}"? This can't be undone.`)) return
    await deleteRecipe(recipeId)
    navigate('/recipes')
  }

  const pillars = [
    ['PRO', recipe.pro],
    ['BASE', recipe.base],
    ['VEG', recipe.veg],
    ['ENGINE', recipe.engine],
  ].filter(([, value]) => value)

  return (
    <div className="p-4 pb-24">
      <Link to="/recipes" className="text-sm text-sage-600 hover:underline">
        ← Recipes
      </Link>

      {photoUrl && (
        <img src={photoUrl} alt={recipe.name} className="mt-3 h-56 w-full rounded-xl object-cover" />
      )}

      <div className="mt-3 flex items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold text-sage-800">{recipe.name}</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            to={`/recipes/${recipeId}/edit`}
            className="rounded-lg border border-sage-300 px-3 py-1.5 text-sm font-medium text-sage-700 hover:bg-sage-50"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm text-sage-500">
        {MEAL_TYPE_LABEL[recipe.mealType]} · {recipe.prepMinutes} min · serves {recipe.servings}
        {recipe.source ? ` · from ${recipe.source}` : ''}
      </p>

      {settings.pregnancySafeMode && !recipe.pregnancySafe && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Flagged: check this recipe against pregnancy/breastfeeding-safety guidance before making it.
        </p>
      )}

      {pillars.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {pillars.map(([label, value]) => (
            <span key={label} className="rounded-full bg-sage-100 px-3 py-1 text-sage-700">
              {label}: {value}
            </span>
          ))}
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-xs text-sage-500">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-stone-200 px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      {recipe.ingredients.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold text-sage-800">Ingredients</h2>
          <ul className="mt-2 space-y-1 text-sage-700">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between gap-2 text-sm">
                <span>
                  {ing.qty ? `${ing.qty} ` : ''}
                  {ing.unit ? `${ing.unit} ` : ''}
                  {ing.name}
                </span>
                {ing.preferredStore && (
                  <span className="shrink-0 text-xs text-sage-400">{STORE_LABEL[ing.preferredStore]}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold text-sage-800">Steps</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-sage-700">
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
